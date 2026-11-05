import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseLog } from "../src/runtime/lib/log.mjs";
import { gitRepo, project, run, runError, tempDir } from "./helpers.mjs";

async function write(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function schema2Board() {
  const dir = await gitRepo(await tempDir());
  const b = path.join(dir, ".catpaw");
  await write(path.join(b, "index.md"), "---\nschema: 2\n---\n\n# Board\n");
  await write(
    path.join(b, "work/FR-001-release.md"),
    "---\nid: FR-001\ntype: feature\nmode: gated\nstatus: done\nstage: reflect\ncreated: 2026-09-01\nupdated: 2026-09-03\nclosed: 2026-09-03\n---\n\n# FR-001: Release export\n\n## Scope\n\n- dev and prod\n\n## Handoff\n\nkeep this\n",
  );
  await write(
    path.join(b, "work/FR-002-followup.md"),
    "---\nid: FR-002\ntype: feature\nmode: tracked\nstatus: active\nstage: build\ncreated: 2026-09-04\nupdated: 2026-09-05\nclosed: null\ncontract: 4\nacceptance: Follow-up passes\n---\n\n# FR-002: Follow-up\n\n<!-- catpaw:work-progress:start -->\n- Phase: Execute\n- Next: rerun staging\n<!-- catpaw:work-progress:end -->\n",
  );
  await write(
    path.join(b, "work/CHORE-003-old.md"),
    "---\nid: CHORE-003\ntype: chore\nmode: tracked\nstatus: cancelled\nstage: plan\ncreated: 2026-08-01\nupdated: 2026-08-02\nclosed: 2026-08-02\n---\n\n# CHORE-003: Old idea\n",
  );
  await write(
    path.join(b, "evidence/FR-001/2026-09-02-test-staging.md"),
    "---\ntype: test\nwork: FR-001\nstage: test\ncreated: 2026-09-02\nupdated: 2026-09-02\nindependent: false\nresult: failed\ncandidate: abc\n---\n\n# Staging failed\n\n## Record\n\nClassic dashboard crashed.\n",
  );
  await write(
    path.join(b, "evidence/FR-001/2026-09-03-review-final.md"),
    "---\ntype: review\nwork: FR-001\nstage: review\ncreated: 2026-09-03\nupdated: 2026-09-03\nindependent: true\nagent: rev\nresult: passed\ncandidate: def\n---\n\n# Final review\n",
  );
  await write(
    path.join(b, "evidence/FR-002/2026-09-05-research-notes.md"),
    "---\ntype: research\nwork: FR-002\nstage: think\ncreated: 2026-09-05\nupdated: 2026-09-05\nindependent: false\n---\n\n# Notes\n\n<!-- catpaw {\"kind\":\"done\"} -->\n",
  );
  await write(path.join(b, "evidence/topics/2026-09-01-research-topic.md"), "---\ntype: research\n---\n\n# Topic\n");
  await write(path.join(b, "plans/FR-001-release.md"), "---\nwork: FR-001\nupdated: 2026-09-01\n---\n\n# Plan: FR-001 Release export\n\nsteps\n");
  await write(
    path.join(b, "milestones/MS-001-launch.md"),
    "---\nid: MS-001\nstatus: active\ncreated: 2026-08-30\nupdated: 2026-09-05\nclosed: null\ntarget: null\n---\n# Launch\n\n<!-- catpaw:milestone-scope:start -->\n| Work Item ID | Title | Status | Notes |\n|---|---|---|---|\n| FR-001 | Release | done | |\n| FR-002 | Follow-up | active | |\n<!-- catpaw:milestone-scope:end -->\n",
  );
  await write(path.join(b, "handoffs/2026-09-05.md"), "handoff\n");
  return dir;
}

test("convert previews without writing", async () => {
  const dir = await schema2Board();
  const before = await readdir(path.join(dir, ".catpaw"));
  const preview = await run(dir, "convert");
  assert.match(preview.text, /Work: 4 \(2 open, 0 blocked, 1 done, 1 dropped; 1 risk high; 1 from milestones\)/);
  assert.match(preview.text, /Evidence: 2 checks \(1 failed\/blocked kept\), 1 notes/);
  assert.match(preview.text, /Topic evidence \(archive-only\): 1/);
  assert.match(preview.text, /Archived as-is: handoffs, index.md/);
  assert.deepEqual(await readdir(path.join(dir, ".catpaw")), before);
  assert.equal((await runError(dir, "status")).code, "ERR_SCHEMA");
});

test("convert applies, archives the original and keeps every failure", async () => {
  const dir = await schema2Board();
  const original = await readFile(path.join(dir, ".catpaw/work/FR-001-release.md"), "utf8");
  await run(dir, "convert", "--apply");
  assert.equal(await readFile(path.join(dir, ".catpaw/archive/schema-2/work/FR-001-release.md"), "utf8"), original);

  const log = parseLog(await readFile(path.join(dir, ".catpaw/work/FR-001/LOG.md"), "utf8"));
  assert.deepEqual(
    log.map((e) => [e.kind, e.result ?? null]),
    [["done", null], ["check", "passed"], ["check", "failed"], ["note", null], ["note", null]],
  );
  assert.match(log[4].body, /## Handoff\n\nkeep this/);
  assert.equal(log[2].snapshot, "schema2:abc");
  assert.equal(log[1].by, "independent");
  assert.equal(log[1].actor, "rev");

  const followup = parseLog(await readFile(path.join(dir, ".catpaw/work/FR-002/LOG.md"), "utf8"));
  assert.deepEqual(followup.map((e) => e.kind), ["note", "note"]);
  const work = await readFile(path.join(dir, ".catpaw/work/FR-002/WORK.md"), "utf8");
  assert.match(work, /parent: MS-001/);
  assert.match(work, /- Follow-up passes/);
  assert.match(work, /rerun staging/);

  const status = await run(dir, "status");
  assert.match(status.text, /CatPaw: 2 active Work \(1 done, 1 dropped\)/);
  assert.equal((await run(dir, "gate")).exitCode, 0);
  assert.match((await run(dir, "convert")).text, /already uses schema 4/);
});

test("imported checks never count as current", async () => {
  const dir = await schema2Board();
  await run(dir, "convert", "--apply");
  const status = await run(dir, "status", "FR-001");
  assert.doesNotMatch(status.text, /current snapshot\]: .*Final review/);
  assert.match(status.text, /done record consistent/);
});

test("schema 3 preview is read-only and conversion keeps the latest failure and its output", async () => {
  const dir = await project();
  const board = path.join(dir, ".catpaw");
  const marker = path.join(board, "catpaw.json");
  await writeFile(marker, '{"schema":3,"extra":"keep"}\n');
  await run(dir, "start", "Legacy log");
  await run(dir, "check", "W-001", "passed", "first pass");
  await run(dir, "finish", "W-001");
  await run(dir, "check", "W-001", "later failure", "--", process.execPath, "-e", 'console.log("failure output"); process.exit(1)');

  const logPath = "work/W-001/LOG.md";
  const logFile = path.join(board, logPath);
  // Legacy timestamps are recorded to the second. Physical order breaks ties.
  const original = "# History\n\n" + (await readFile(logFile, "utf8"))
    .replaceAll(/"at":"[^"]+"/g, '"at":"2026-11-05T00:00:00Z"').trimEnd();
  await writeFile(logFile, original);
  const legacy = parseLog(original);
  assert.equal(legacy.at(-1).result, "failed");
  const output = path.resolve(dir, legacy.at(-1).output[0]);
  const originalOutput = await readFile(output, "utf8");
  const oldStatus = await run(dir, "status", "W-001");
  assert.equal(oldStatus.data.log[0].result, "failed");
  assert.match((await run(dir, "gate")).text, /latest self check .* failed/);

  const preview = await run(dir, "convert");
  assert.match(preview.text, /LOG.md files: 1/);
  assert.equal(await readFile(logFile, "utf8"), original);
  assert.equal(JSON.parse(await readFile(marker, "utf8")).schema, 3);
  await run(dir, "convert", "--apply");
  assert.deepEqual(JSON.parse(await readFile(marker, "utf8")), { schema: 4, extra: "keep" });
  assert.equal(await readFile(path.join(board, "archive/schema-3", logPath), "utf8"), original);
  const converted = await readFile(logFile, "utf8");
  assert.match(converted, /^# History\n\n<!-- catpaw /);
  assert.deepEqual(parseLog(converted), legacy.reverse());
  assert.equal(await readFile(output, "utf8"), originalOutput);
  assert.match((await run(dir, "gate")).text, /latest self check .* failed/);
  await run(dir, "check", "W-001", "passed", "rerun");
  assert.equal((await run(dir, "gate")).exitCode, 0);
  assert.equal(parseLog(await readFile(logFile, "utf8"))[0].body, "rerun");
});
