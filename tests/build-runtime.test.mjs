import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = path.join(REPO, "src", "runtime");
const DIST = path.join(REPO, "dist", "runtime");
const BUILD = path.join(REPO, "scripts", "build-runtime.mjs");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
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

async function fileHashes(root) {
  const hashes = {};
  async function visit(relativePath = "") {
    const directory = path.join(root, relativePath);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const child = path.join(relativePath, entry.name);
      const target = path.join(root, child);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) {
        hashes[child.split(path.sep).join("/")] = createHash("sha256")
          .update(await readFile(target))
          .digest("hex");
      } else {
        hashes[child] = `unsupported:${(await lstat(target)).mode}`;
      }
    }
  }
  await visit();
  return hashes;
}

test("runtime manifest declares schema 2 and executable CLI package entries", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(SOURCE, "runtime-manifest.json"), "utf8"),
  );
  assert.equal(manifest.version, "3.0.1");
  assert.equal(manifest.boardSchemaVersion, 2);
  assert.equal(manifest.cli.entrypoint, "bin/catpaw.mjs");
  assert.deepEqual(manifest.cli.commands, [
    "board init|status|doctor|migrate",
    "work start|close",
    "milestone start|add|close",
    "evidence add",
    "agent check|open|send|status|read|close",
  ]);
  for (const entry of [
    "bin/",
    "lib/",
    "schemas/",
    "guidance/",
    "lenses/",
    "providers/",
  ]) {
    assert.ok(manifest.canonicalFiles.includes(entry), entry);
  }
  for (const removed of ["commands/", "specs/", "roles/", "tools/"]) {
    assert.equal(manifest.canonicalFiles.includes(removed), false, removed);
  }
});

test("build replaces stale dist with a hash-identical executable package", async () => {
  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, "stale.txt"), "stale\n");

  const result = await run(process.execPath, [BUILD], { cwd: REPO });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Built CatPaw runtime 3\.0\.1/);
  assert.deepEqual(await fileHashes(DIST), await fileHashes(SOURCE));
  await assert.rejects(stat(path.join(DIST, "stale.txt")), { code: "ENOENT" });
  const cliMode = (await stat(path.join(DIST, "bin", "catpaw.mjs"))).mode;
  assert.notEqual(cliMode & 0o111, 0);
});
