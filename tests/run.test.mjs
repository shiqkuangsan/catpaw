import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { git, project, run, runError } from "./helpers.mjs";

const NODE = process.execPath;
const BIN = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));

async function runChecks(dir) {
  return (await run(dir, "status", "W-001", "--json")).data.log.filter((e) => e.kind === "check" && e.run);
}

async function lastCheck(dir) {
  const result = await run(dir, "status", "W-001", "--json");
  return result.data.log.filter((e) => e.kind === "check").at(-1);
}

test("a passing command is recorded by CatPaw with its output", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const result = await run(dir, "check", "W-001", "unit tests", "--", NODE, "-e", "console.log('all 3 passed')");
  assert.equal(result.exitCode, 0);
  assert.match(result.text, /check passed \(self, run\)/);
  const entry = await lastCheck(dir);
  assert.equal(entry.result, "passed");
  assert.equal(entry.run.exit, 0);
  assert.deepEqual(entry.run.command.slice(1), ["-e", "console.log('all 3 passed')"]);
  assert.match(await readFile(path.join(dir, entry.output[0]), "utf8"), /all 3 passed/);
  assert.equal(await readFile(path.join(dir, ".catpaw/runs/.gitignore"), "utf8"), "*\n");
  assert.equal(git(dir, "status", "--porcelain", "--", ".catpaw/runs"), "");
  await run(dir, "finish", "W-001");
});

test("a failing command records failed, exits 1 and shows the output tail", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const script = "console.log('1 failing: login'); process.exit(3)";
  const result = await run(dir, "check", "W-001", "unit tests", "--", NODE, "-e", script);
  assert.equal(result.exitCode, 1);
  assert.match(result.text, /exit 3/);
  assert.match(result.text, /1 failing: login/);
  assert.equal((await lastCheck(dir)).result, "failed");
  assert.match((await runError(dir, "finish", "W-001")).message, /latest self check on this snapshot is failed/);
});

test("a command that cannot start or times out does not pass", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  assert.match((await run(dir, "check", "W-001", "x", "--", "catpaw-no-such-command")).text, /blocked.*could not start: ENOENT/s);
  const slow = await run(dir, "check", "W-001", "x", "--timeout", "0.3", "--", NODE, "-e", "setTimeout(() => {}, 10000)");
  assert.equal(slow.exitCode, 1);
  assert.match(slow.text, /check failed .*timed out after 0.3s/s);
  assert.equal((await readdir(path.join(dir, ".catpaw/runs/W-001"))).length, 2);
});

test("files changed during the run keep the result on the earlier snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const script = "require('fs').writeFileSync('generated.txt', 'x')";
  const result = await run(dir, "check", "W-001", "build", "--", NODE, "-e", script);
  assert.match(result.text, /files changed during the run/);
  const entry = await lastCheck(dir);
  assert.ok(entry.run.drift && entry.run.drift !== entry.snapshot);
  const status = await run(dir, "status", "W-001", "--json");
  assert.notEqual(status.data.snapshot.id, entry.snapshot);
});

test("a run check does not accept a hand-written result", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const error = await runError(dir, "check", "W-001", "passed", "tests", "--", NODE, "-e", "");
  assert.equal(error.code, "ERR_ARGS");
  assert.equal((await runError(dir, "check", "W-001", "tests", "--")).code, "ERR_ARGS");
});

test("piped stdin reaches the command and is saved with the run", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const script = "console.log('from stdin'); process.exit(4)";
  const child = spawnSync(NODE, [BIN, "check", "W-001", "stdin script", "--", NODE, "-"], { cwd: dir, input: script, encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.match(child.stdout, /with \d+ bytes of stdin/);
  assert.match(child.stdout, /from stdin/);
  const [entry] = await runChecks(dir);
  assert.equal(entry.result, "failed");
  assert.equal(entry.run.stdin.bytes, Buffer.byteLength(script));
  assert.equal(await readFile(path.join(dir, entry.run.stdin.file), "utf8"), script);
});

test("empty stdin records no input", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const child = spawnSync(NODE, [BIN, "check", "W-001", "plain", "--", NODE, "-e", ""], { cwd: dir, input: "", encoding: "utf8" });
  assert.equal(child.status, 0);
  const [entry] = await runChecks(dir);
  assert.equal(entry.run.stdin, undefined);
});

test("an open stdin pipe does not keep catpaw waiting after the command exits", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const child = spawn(NODE, [BIN, "check", "W-001", "quick", "--", NODE, "-e", ""], { cwd: dir, stdio: ["pipe", "ignore", "ignore"] });
  const code = await Promise.race([
    new Promise((resolve) => child.on("close", resolve)),
    new Promise((resolve) => setTimeout(() => resolve("hung"), 10_000)),
  ]);
  child.kill();
  assert.equal(code, 0);
});
