import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
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
  assert.equal(report.source.version, "3.0.1");
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
