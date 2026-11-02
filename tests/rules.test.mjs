import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { git, gitRepo, project, run, runError, tempDir } from "./helpers.mjs";

test("normal Work finishes without checks and records the snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "Small change");
  const result = await run(dir, "finish", "W-001", "done here");
  assert.match(result.text, /W-001 done on snapshot [0-9a-f]{16}/);
  assert.equal((await run(dir, "gate")).exitCode, 0);
});

test("open gaps block finish until closed or accepted", async () => {
  const dir = await project();
  await run(dir, "start", "Feature");
  await run(dir, "gap", "W-001", "add", "production path not verified");
  const blocked = await runError(dir, "finish", "W-001");
  assert.equal(blocked.code, "ERR_RULES");
  assert.match(blocked.message, /open gap G1/);
  await run(dir, "gap", "W-001", "accept", "G1", "user: development-only delivery");
  await run(dir, "finish", "W-001");
  const work = await readFile(path.join(dir, ".catpaw/work/W-001/WORK.md"), "utf8");
  assert.match(work, /- \[accepted\] G1: production path not verified — accepted: user: development-only delivery/);
});

test("closed gaps leave WORK.md and stay in the log", async () => {
  const dir = await project();
  await run(dir, "start", "Feature");
  await run(dir, "gap", "W-001", "add", "first");
  await run(dir, "gap", "W-001", "add", "second");
  await run(dir, "gap", "W-001", "close", "G1", "verified in staging");
  await run(dir, "gap", "W-001", "add", "third");
  const work = await readFile(path.join(dir, ".catpaw/work/W-001/WORK.md"), "utf8");
  assert.doesNotMatch(work, /G1:/);
  assert.match(work, /- \[open\] G3: third/);
  const log = await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8");
  assert.match(log, /Closed G1 \(first\): verified in staging/);
});

test("risk high needs passed self and independent checks on the current snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "Release", "--risk", "high");
  await writeFile(path.join(dir, "a.txt"), "b\n");
  await run(dir, "check", "W-001", "passed", "unit tests");
  assert.match((await runError(dir, "finish", "W-001")).message, /needs a passed independent check/);
  await run(dir, "check", "W-001", "passed", "review", "--independent", "--actor", "reviewer");
  await run(dir, "finish", "W-001");
});

test("a later failure supersedes an earlier pass on the same snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "Fix");
  await run(dir, "check", "W-001", "passed", "first run");
  await run(dir, "check", "W-001", "failed", "flaky rerun");
  assert.match((await runError(dir, "finish", "W-001")).message, /latest self check on this snapshot is failed/);
  await run(dir, "check", "W-001", "passed", "fixed and rerun");
  await run(dir, "finish", "W-001");
});

test("changing code makes earlier checks stale", async () => {
  const dir = await project();
  await run(dir, "start", "Release", "--risk", "high");
  await run(dir, "check", "W-001", "passed", "tests");
  await run(dir, "check", "W-001", "passed", "review", "--independent");
  await writeFile(path.join(dir, "a.txt"), "changed after review\n");
  const error = await runError(dir, "finish", "W-001");
  assert.match(error.message, /needs a passed self check/);
  assert.match(error.message, /needs a passed independent check/);
});

test("board writes do not change the snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "Release", "--risk", "high");
  await run(dir, "check", "W-001", "passed", "tests");
  await run(dir, "note", "W-001", "decided something");
  await run(dir, "gap", "W-001", "add", "x");
  await run(dir, "gap", "W-001", "close", "G1", "y");
  await run(dir, "check", "W-001", "passed", "review", "--independent");
  await run(dir, "finish", "W-001");
});

test("snapshots cover sibling repositories", async () => {
  const root = await tempDir();
  const dir = await gitRepo(path.join(root, "app"));
  await gitRepo(path.join(root, "lib"), { "b.txt": "b\n" });
  await run(dir, "init");
  await run(dir, "start", "Cross repo", "--risk", "high", "--repos", ".,../lib");
  await run(dir, "check", "W-001", "passed", "tests");
  await run(dir, "check", "W-001", "passed", "review", "--independent");
  await writeFile(path.join(root, "lib", "new.txt"), "untracked\n");
  assert.equal((await runError(dir, "finish", "W-001")).code, "ERR_RULES");
  git(path.join(root, "lib"), "add", "-A");
  git(path.join(root, "lib"), "commit", "-qm", "lib change");
  const status = await run(dir, "status", "W-001");
  assert.match(status.text, /\.\.\/lib@[0-9a-f]{12}\+clean/);
  assert.match(status.text, /not finishable/);
});

test("non-git directories use a content hash", async () => {
  const dir = await tempDir();
  await writeFile(path.join(dir, "a.txt"), "a\n");
  await run(dir, "init");
  await run(dir, "start", "Plain", "--risk", "high");
  await run(dir, "check", "W-001", "passed", "tests");
  await run(dir, "check", "W-001", "passed", "review", "--independent");
  await writeFile(path.join(dir, "a.txt"), "b\n");
  assert.equal((await runError(dir, "finish", "W-001")).code, "ERR_RULES");
});

test("gate flags a done status set by hand", async () => {
  const dir = await project();
  await run(dir, "start", "Feature");
  const file = path.join(dir, ".catpaw/work/W-001/WORK.md");
  await writeFile(file, (await readFile(file, "utf8")).replace("status: open", "status: done"));
  const gate = await run(dir, "gate");
  assert.equal(gate.exitCode, 1);
  assert.match(gate.text, /W-001: status is done without a finish record/);
});

test("gate flags a failure recorded after finish on the same snapshot", async () => {
  const dir = await project();
  await run(dir, "start", "Feature");
  await run(dir, "check", "W-001", "passed", "tests");
  await run(dir, "finish", "W-001");
  await run(dir, "check", "W-001", "failed", "regression found");
  const gate = await run(dir, "gate");
  assert.equal(gate.exitCode, 1);
  assert.match(gate.text, /latest self check on this snapshot is failed/);
});

test("gate with an id checks finishability of open Work", async () => {
  const dir = await project();
  await run(dir, "start", "Release", "--risk", "high");
  assert.equal((await run(dir, "gate", "W-001")).exitCode, 1);
  assert.equal((await run(dir, "gate")).exitCode, 0);
});
