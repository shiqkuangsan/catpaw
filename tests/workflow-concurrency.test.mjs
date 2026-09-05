import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "../src/runtime/lib/args.mjs";
import { runWorkCommand } from "../src/runtime/lib/commands/work.mjs";
import { runEvidenceCommand } from "../src/runtime/lib/commands/evidence.mjs";
import { runMilestoneCommand } from "../src/runtime/lib/commands/milestone.mjs";
import { createMutationPlan } from "../src/runtime/lib/commands/workflow.mjs";
import { snapshotTree } from "../src/runtime/lib/patch-plan.mjs";

const CLI = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));
const commands = { work: runWorkCommand, proof: runEvidenceCommand, milestone: runMilestoneCommand };
const finishWork = ["work", "finish", "--id", "FR-950"];
const addScope = ["milestone", "add", "--milestone", "MS-950", "--work", "FR-950"];
const finishMilestone = ["milestone", "finish", "--id", "MS-950"];
const cases = [
  ["work start", ["work", "start", "--id", "FR-951", "--title", "Another Work"], []],
  ["work update", ["work", "update", "--id", "FR-950", "--next", "Continue review"], []],
  ["work finish", finishWork, []],
  ["work terminal noop", finishWork, [finishWork]],
  ["proof add", ["proof", "add", "--work", "FR-950", "--title", "Test", "--type", "test", "--body", "Focused tests passed."], []],
  ["milestone start", ["milestone", "start", "--id", "MS-951", "--title", "Another Phase"], []],
  ["milestone add", addScope, []],
  ["milestone finish", finishMilestone, [addScope, finishWork]],
  ["milestone terminal noop", finishMilestone, [addScope, finishWork, finishMilestone]],
];

test("read-only workflow queries do not hash unrelated board files", async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "catpaw-query-io-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const args of [["board", "init"], ["work", "start", "--id", "FR-950", "--title", "Read only"]]) {
    const result = spawnSync(process.execPath, [CLI, ...args, "--project", root, "--apply"], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
  }
  const unrelated = path.join(root, ".catpaw/unrelated.bin");
  await fs.writeFile(unrelated, "Unrelated payload");
  const originalReadFile = fs.readFile;
  let reads = 0;
  fs.readFile = async function (file, ...rest) {
    if (file === unrelated) reads += 1;
    return originalReadFile.call(this, file, ...rest);
  };
  syncBuiltinESMExports();
  try {
    for (const args of [["work", "show", "--id", "FR-950"], ["proof", "list"]]) {
      const result = await commands[args[0]](parseCliArgs([...args, "--project", root]));
      assert.equal(result.exitCode, 0);
    }
  } finally {
    fs.readFile = originalReadFile;
    syncBuiltinESMExports();
  }
  assert.equal(reads, 0);
  await assert.rejects(createMutationPlan({ boardPath: path.join(root, ".catpaw") }, {}, []), { code: "ERR_WORKFLOW_PREIMAGE_REQUIRED" });
});

for (const [name, args, setup] of cases) {
  test(`${name} refuses drift between board analysis and patch planning`, async (t) => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "catpaw-analysis-race-")));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const boardPath = path.join(root, ".catpaw");
    for (const command of [
      ["board", "init"],
      ["work", "start", "--id", "FR-950", "--title", "Race"],
      ["milestone", "start", "--id", "MS-950", "--title", "Phase"],
      ...setup,
    ]) {
      const result = spawnSync(process.execPath, [CLI, ...command, "--project", root, "--apply", "--json"], { encoding: "utf8", timeout: 10000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const target = path.join(boardPath, "work/FR-950-race.md");
    const originalReadFile = fs.readFile;
    let injected = false;
    let editedDigest;
    // The board parser reads UTF-8; snapshots read bytes. Inject after the
    // parser receives old text, precisely before the resulting plan is made.
    fs.readFile = async function (file, ...rest) {
      const text = await originalReadFile.call(this, file, ...rest);
      if (file === target && rest[0] === "utf8" && !injected) {
        injected = true;
        await fs.writeFile(target, `${text}\nConcurrent user note: MUST PRESERVE\n`);
        editedDigest = (await snapshotTree(boardPath)).digest;
      }
      return text;
    };
    syncBuiltinESMExports();
    let result;
    try {
      result = await commands[args[0]](parseCliArgs([...args, "--project", root, "--apply", "--json"]));
    } finally {
      fs.readFile = originalReadFile;
      syncBuiltinESMExports();
    }
    assert.equal(injected, true, "the concurrent edit must reach the targeted read");
    assert.equal(result.exitCode, 1, JSON.stringify(result.report));
    assert.equal(result.report.status, "blocked");
    assert.match(result.report.patch.text, /stale-analysis-preimage/);
    assert.match(await fs.readFile(target, "utf8"), /MUST PRESERVE/);
    assert.equal((await snapshotTree(boardPath)).digest, editedDigest);
  });
}
