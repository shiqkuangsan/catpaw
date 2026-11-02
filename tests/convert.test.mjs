import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseLog } from "../src/runtime/lib/log.mjs";
import { gitRepo, run, runError, tempDir } from "./helpers.mjs";

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
    [["note", null], ["note", null], ["check", "failed"], ["check", "passed"], ["done", null]],
  );
  assert.match(log[0].body, /## Handoff\n\nkeep this/);
  assert.equal(log[2].snapshot, "schema2:abc");
  assert.equal(log[3].by, "independent");
  assert.equal(log[3].actor, "rev");

  const followup = parseLog(await readFile(path.join(dir, ".catpaw/work/FR-002/LOG.md"), "utf8"));
  assert.deepEqual(followup.map((e) => e.kind), ["note", "note"]);
  const work = await readFile(path.join(dir, ".catpaw/work/FR-002/WORK.md"), "utf8");
  assert.match(work, /parent: MS-001/);
  assert.match(work, /- Follow-up passes/);
  assert.match(work, /rerun staging/);

  const status = await run(dir, "status");
  assert.match(status.text, /CatPaw: 2 active Work \(1 done, 1 dropped\)/);
  assert.equal((await run(dir, "gate")).exitCode, 0);
  assert.match((await run(dir, "convert")).text, /already uses schema 3/);
});

test("imported checks never count as current", async () => {
  const dir = await schema2Board();
  await run(dir, "convert", "--apply");
  const status = await run(dir, "status", "FR-001");
  assert.doesNotMatch(status.text, /current snapshot\]: .*Final review/);
  assert.match(status.text, /done record consistent/);
});
