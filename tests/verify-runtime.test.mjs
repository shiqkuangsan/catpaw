import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const RUNTIME_SOURCE = path.join(REPO, "src", "runtime");
const VERIFY = path.join(REPO, "scripts", "verify-runtime.mjs");

function run(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VERIFY, ...args], {
      cwd: REPO,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({
      code,
      signal,
      stdout,
      stderr,
    }));
  });
}

async function treeDigest(root) {
  const hash = createHash("sha256");
  async function visit(relativePath = "") {
    const entries = await readdir(path.join(root, relativePath), {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const child = path.join(relativePath, entry.name);
      hash.update(`${entry.isDirectory() ? "d" : "f"}\0${child}\0`);
      if (entry.isDirectory()) await visit(child);
      else hash.update(await readFile(path.join(root, child)));
    }
  }
  await visit();
  return hash.digest("hex");
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-verify-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const dist = path.join(root, "dist");
  const installed = path.join(root, "installed");
  await cp(RUNTIME_SOURCE, source, { recursive: true });
  await cp(RUNTIME_SOURCE, dist, { recursive: true });
  await mkdir(installed);
  await writeFile(path.join(installed, "VERSION"), "2.1.7\n");
  await writeFile(
    path.join(installed, "runtime-manifest.json"),
    `${JSON.stringify({
      name: "catpaw-runtime",
      version: "2.1.7",
      artifactSchemaVersion: 1,
      canonicalFiles: ["VERSION", "runtime-manifest.json"],
    }, null, 2)}\n`,
  );
  return {
    root,
    source,
    dist,
    installed,
    env: {
      CATPAW_SOURCE_ROOT: source,
      CATPAW_DIST_ROOT: dist,
      CATPAW_HOME: installed,
    },
  };
}

test("default verification passes with installed runtime pending activation", async (t) => {
  const box = await fixture(t);
  const before = await treeDigest(box.installed);

  const result = await run(["--json"], box);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.source.version, "3.0.3");
  assert.equal(report.source.boardSchemaVersion, 2);
  assert.equal(report.dist.matchesSource, true);
  assert.equal(report.installed.version, "2.1.7");
  assert.equal(report.installed.status, "pending-activation");
  assert.ok(report.checks.some((item) =>
    item.name === "source CLI behavior" && item.ok
  ));
  assert.ok(report.checks.some((item) =>
    item.name === "dist CLI behavior" && item.ok
  ));
  assert.equal(await treeDigest(box.installed), before);
});

test("strict activation fails safely when installed runtime is stale", async (t) => {
  const box = await fixture(t);
  const before = await treeDigest(box.installed);

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "fail");
  assert.equal(report.installed.status, "pending-activation");
  assert.ok(report.checks.some((item) =>
    item.name === "installed activation" && !item.ok
  ));
  assert.equal(await treeDigest(box.installed), before);
});

test("strict activation preserves local state and unknown installed files", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await mkdir(path.join(box.installed, "state"));
  await writeFile(path.join(box.installed, "state", "projects.json"), "{}\n");
  await writeFile(path.join(box.installed, ".user-note"), "preserve me\n");
  const before = await treeDigest(box.installed);

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.installed.status, "current");
  assert.equal(report.installed.matchesSource, true);
  assert.ok(report.checks.some((item) =>
    item.name === "installed canonical coverage" &&
    item.ok &&
    item.detail === "missing=0, localExtras=2"
  ));
  assert.equal(await treeDigest(box.installed), before);
});

test("strict activation ignores preserved unknown symlinks", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await symlink("missing-user-target", path.join(box.installed, ".user-link"));

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "current");
  assert.equal(report.installed.matchesSource, true);
});

test("strict activation rejects retired runtime paths", async (t) => {
  const box = await fixture(t);
  for (const root of [box.source, box.dist]) {
    const manifestPath = path.join(root, "runtime-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.legacyRuntimePaths = ["commands/"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await mkdir(path.join(box.installed, "commands"));
  await writeFile(path.join(box.installed, "commands", "stale.md"), "stale\n");

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "drift");
  assert.ok(report.checks.some((item) =>
    item.name === "installed retired paths" &&
    !item.ok &&
    item.detail.includes("commands/")
  ));
});

test("runtime path contract rejects protected or ambiguous retired paths", async (t) => {
  for (const retiredPath of [
    "./",
    "state/",
    "State/",
    "backups/",
    "BACKUPS/",
    "commands",
    "commands/nested/",
  ]) {
    await t.test(retiredPath, async (t) => {
      const box = await fixture(t);
      for (const root of [box.source, box.dist]) {
        const manifestPath = path.join(root, "runtime-manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.legacyRuntimePaths = [retiredPath];
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      }

      const result = await run(["--json"], box);

      assert.equal(result.code, 1, result.stderr || result.stdout);
      const report = JSON.parse(result.stdout);
      assert.ok(report.checks.some((item) =>
        item.name === "runtime path contract" && !item.ok
      ));
    });
  }
});

test("runtime path contract requires explicit canonical and retired arrays", async (t) => {
  for (const field of ["canonicalFiles", "legacyRuntimePaths"]) {
    for (const value of [undefined, null]) {
      await t.test(`${field}=${String(value)}`, async (t) => {
        const box = await fixture(t);
        for (const root of [box.source, box.dist]) {
          const manifestPath = path.join(root, "runtime-manifest.json");
          const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
          if (value === undefined) delete manifest[field];
          else manifest[field] = value;
          await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        }

        const result = await run(["--json"], box);

        assert.equal(result.code, 1, result.stderr || result.stdout);
        const report = JSON.parse(result.stdout);
        assert.ok(report.checks.some((item) =>
          item.name === "runtime path contract" && !item.ok
        ));
      });
    }
  }
});

test("strict activation rejects a non-executable installed CLI", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await chmod(path.join(box.installed, "bin", "catpaw.mjs"), 0o644);

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "drift");
  assert.ok(report.checks.some((item) =>
    item.name === "installed CLI executable" && !item.ok
  ));
});

test("strict activation rejects extra files inside managed directories", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await writeFile(path.join(box.installed, "templates", "stale.md"), "stale\n");

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "drift");
  assert.equal(report.installed.matchesSource, false);
});

test("strict activation rejects extra empty managed directories", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  await mkdir(path.join(box.installed, "templates", "stale-empty"));

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "drift");
  assert.equal(report.installed.matchesSource, false);
});

test("strict activation never executes a drifted installed CLI", async (t) => {
  const box = await fixture(t);
  await rm(box.installed, { recursive: true, force: true });
  await cp(box.source, box.installed, { recursive: true });
  const marker = path.join(box.root, "drifted-cli-ran");
  await writeFile(
    path.join(box.installed, "bin", "catpaw.mjs"),
    `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran\\n");\n`,
  );
  await chmod(path.join(box.installed, "bin", "catpaw.mjs"), 0o755);

  const result = await run(["--strict-activation", "--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.installed.status, "drift");
  assert.ok(report.checks.some((item) =>
    item.name === "installed CLI behavior" &&
    !item.ok &&
    /skipped.*parity/i.test(item.detail)
  ));
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

test("CLI smoke has a bounded timeout", async (t) => {
  const box = await fixture(t);
  const slowCli = `#!/usr/bin/env node
process.on("SIGTERM", () => setTimeout(() => process.exit(0), 500));
setInterval(() => {}, 1000);
`;
  for (const root of [box.source, box.dist]) {
    await writeFile(path.join(root, "bin", "catpaw.mjs"), slowCli);
  }
  const startedAt = Date.now();

  const result = await run(["--json"], {
    ...box,
    env: {
      ...box.env,
      CATPAW_VERIFY_SMOKE_TIMEOUT_MS: "50",
    },
  });

  assert.equal(result.code, 1, result.stderr || result.stdout);
  assert.ok(Date.now() - startedAt < 800, `elapsed=${Date.now() - startedAt}`);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source CLI behavior" &&
    !item.ok &&
    /timed out|ETIMEDOUT/i.test(item.detail)
  ));
});

test("CLI smoke reports the failing status stage", async (t) => {
  const box = await fixture(t);
  const stagedCli = `#!/usr/bin/env node
if (process.argv.includes("status")) {
  process.stderr.write("STATUS_FAILED\\n");
  process.exit(1);
}
process.stdout.write('{"schema":2,"status":"applied"}\\n');
`;
  for (const root of [box.source, box.dist]) {
    await writeFile(path.join(root, "bin", "catpaw.mjs"), stagedCli);
  }

  const result = await run(["--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source CLI behavior" &&
    !item.ok &&
    item.detail.includes("STATUS_FAILED")
  ));
});

test("CLI smoke reports a non-array status findings payload", async (t) => {
  const box = await fixture(t);
  const stagedCli = `#!/usr/bin/env node
if (process.argv.includes("status")) {
  process.stdout.write('{"schema":2,"findings":{}}\\n');
} else {
  process.stdout.write('{"schema":2,"status":"applied"}\\n');
}
`;
  for (const root of [box.source, box.dist]) {
    await writeFile(path.join(root, "bin", "catpaw.mjs"), stagedCli);
  }

  const result = await run(["--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source CLI behavior" &&
    !item.ok &&
    item.detail === "status returned unusable schema 2 output"
  ));
});

test("active runtime links cannot escape the package root", async (t) => {
  const box = await fixture(t);
  await writeFile(path.join(box.root, "host-note.md"), "host\n");
  for (const root of [box.source, box.dist]) {
    const readmePath = path.join(root, "README.md");
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, `${readme}\n[escape](../host-note.md)\n`);
  }

  const result = await run(["--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source active links" && !item.ok
  ));
});

test("active runtime links reject absolute filesystem targets", async (t) => {
  for (const target of [
    "/tmp/catpaw-host-note.md",
    "/tmp/{{name}}",
    "file:///etc/passwd",
    "file:///etc/{{name}}",
    "javascript:{{payload}}",
  ]) {
    await t.test(target, async (t) => {
      const box = await fixture(t);
      for (const root of [box.source, box.dist]) {
        const readmePath = path.join(root, "README.md");
        const readme = await readFile(readmePath, "utf8");
        await writeFile(readmePath, `${readme}\n[escape](${target})\n`);
      }

      const result = await run(["--json"], box);

      assert.equal(result.code, 1, result.stderr || result.stdout);
      const report = JSON.parse(result.stdout);
      assert.ok(report.checks.some((item) =>
        item.name === "source active links" && !item.ok
      ));
    });
  }
});

test("active runtime links allow explicit web, mail, and relative template targets", async (t) => {
  const box = await fixture(t);
  for (const root of [box.source, box.dist]) {
    const readmePath = path.join(root, "README.md");
    const readme = await readFile(readmePath, "utf8");
    await writeFile(
      readmePath,
      `${readme}\n[web](https://example.com)\n[mail](mailto:catpaw@example.com)\n[template](guidance/{{topic}}.md)\n`,
    );
  }

  const result = await run(["--json"], box);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source active links" && item.ok
  ));
});

test("source and dist reject undeclared empty root directories", async (t) => {
  const box = await fixture(t);
  await mkdir(path.join(box.source, "stale-empty"));
  await mkdir(path.join(box.dist, "stale-empty"));

  const result = await run(["--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) =>
    item.name === "source canonical coverage" && !item.ok
  ));
});

test("verification detects a source/dist hash drift", async (t) => {
  const box = await fixture(t);
  await writeFile(path.join(box.dist, "README.md"), "drift\n");

  const result = await run(["--json"], box);

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "fail");
  assert.equal(report.dist.matchesSource, false);
  assert.ok(report.checks.some((item) =>
    item.name === "source/dist hashes" && !item.ok
  ));
});
