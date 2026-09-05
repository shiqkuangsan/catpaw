import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, readdir, rm, chmod, symlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const cli = new URL("../src/runtime/bin/catpaw.mjs", import.meta.url).pathname;
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  await writeFile(path.join(root, "app.txt"), "first\n");
  function run(...args) {
    const result = spawnSync(process.execPath, [cli, ...args, "--project", root, "--json"], { encoding: "utf8" });
    let report;
    try { report = JSON.parse(result.stdout); } catch { report = { stderr: result.stderr, stdout: result.stdout }; }
    return { code: result.status, report };
  }
  assert.equal(run("board", "init", "--apply").code, 0);
  assert.equal(run("work", "start", "--id", "FR-001", "--title", "Accept current app", "--high-risk", "--acceptance", "App matches expected output", "--scope", "app.txt", "--apply").code, 0);
  return { root, run };
}
function passed(run, type, title, candidate, extra = []) {
  return run("evidence", "add", "--work", "FR-001", "--type", type, "--title", title, "--body", "Checked the declared acceptance against this candidate.", "--result", "passed", "--candidate", candidate, ...extra, "--apply");
}
test("new Work is one record; Evidence binds candidate, result, reviewer and cycle", async t => {
  const { root, run } = await fixture(t);
  assert.deepEqual(await readdir(path.join(root, ".catpaw/plans")), []);
  let show = run("work", "show", "--id", "FR-001");
  assert.equal(show.code, 0, JSON.stringify(show.report));
  const candidate = show.report.candidate;
  assert.match(candidate, /^[a-f0-9]{64}$/);
  assert.equal(passed(run, "test", "first test", candidate).code, 0);
  assert.equal(passed(run, "review", "self review", candidate, ["--independent", "--agent", "primary"]).code, 0);
  assert.equal(run("work", "finish", "--id", "FR-001", "--apply").code, 1);
  assert.equal(passed(run, "review", "independent review", candidate, ["--independent", "--agent", "checker"]).code, 0);
  assert.equal(run("evidence", "add", "--work", "FR-001", "--type", "test", "--title", "later failure", "--body", "Regression failed.", "--result", "failed", "--candidate", candidate, "--apply").code, 0);
  assert.equal(run("work", "finish", "--id", "FR-001", "--apply").code, 1);
  assert.equal(passed(run, "test", "repaired test", candidate).code, 0);
  await writeFile(path.join(root, "app.txt"), "second\n");
  assert.equal(run("work", "finish", "--id", "FR-001", "--apply").code, 1);
  const next = run("work", "show", "--id", "FR-001").report.candidate;
  assert.notEqual(next, candidate);
  assert.equal(passed(run, "test", "current test", next).code, 0);
  assert.equal(passed(run, "review", "current review", next, ["--independent", "--agent", "checker"]).code, 0);
  assert.equal(run("evidence", "add", "--work", "FR-001", "--type", "test", "--title", "unusable failure", "--body", "_No body supplied._", "--result", "failed", "--candidate", next, "--apply").code, 0);
  assert.equal(run("work", "finish", "--id", "FR-001", "--apply").code, 1, "latest unusable failure must not revive an old pass");
  assert.equal(passed(run, "test", "final test", next).code, 0);
  const finish = run("work", "finish", "--id", "FR-001", "--apply");
  assert.equal(finish.code, 0, JSON.stringify(finish.report));
  await writeFile(path.join(root, "app.txt"), "later work\n");
  assert.equal(run("board", "doctor").code, 0, "historical completion stays valid");
  const resumed = run("work", "continue", "--id", "FR-001", "--next", "Handle follow-up", "--apply");
  assert.equal(resumed.code, 0, JSON.stringify(resumed.report));
  show = run("work", "show", "--id", "FR-001");
  assert.equal(show.report.contract.cycle, 2);
  assert.equal(run("work", "finish", "--id", "FR-001", "--apply").code, 1);
  const files = await readdir(path.join(root, ".catpaw/evidence/FR-001"));
  assert.ok(files.some(name => name.includes("closure-cycle-1")));
});
test("candidate includes modes and acceptance, excludes board progress and Git metadata", async t => {
  const { root, run } = await fixture(t);
  const first = run("work", "show", "--id", "FR-001").report.candidate;
  assert.equal(run("work", "update", "--id", "FR-001", "--next", "Inspect output", "--apply").code, 0);
  assert.equal(run("work", "show", "--id", "FR-001").report.candidate, first);
  await chmod(path.join(root, "app.txt"), 0o755);
  const executable = run("work", "show", "--id", "FR-001").report.candidate;
  assert.notEqual(executable, first);
  await chmod(path.join(root, "app.txt"), 0o4755);
  assert.notEqual(run("work", "show", "--id", "FR-001").report.candidate, executable);
  const workPath = path.join(root, ".catpaw/work/FR-001-accept-current-app.md");
  await writeFile(workPath, (await readFile(workPath, "utf8")).replace("App matches expected output", "Different acceptance"));
  assert.notEqual(run("work", "show", "--id", "FR-001").report.candidate, first);
});

test("only bound Plan content and identity affect the candidate, not Plan timestamps", async t => {
  const { root, run } = await fixture(t);
  const candidate = () => run("work", "show", "--id", "FR-001").report.candidate;
  const original = candidate();
  const plan = path.join(root, ".catpaw/plans/FR-001-contract.md");
  await writeFile(plan, "---\nwork: FR-001\nupdated: 2026-09-05\n---\n\n# Verification\nRequire a changed result.\n");
  const bound = candidate();
  assert.notEqual(bound, original);
  await writeFile(plan, (await readFile(plan, "utf8")).replace("2026-09-05", "2026-09-06"));
  assert.equal(candidate(), bound);
  await writeFile(plan, (await readFile(plan, "utf8")).replace("changed result", "different acceptance"));
  assert.notEqual(candidate(), bound);
});

test("captured commands execute only with apply, retain failures, and never persist raw output", async t => {
  const { root, run } = await fixture(t);
  const args = [cli, "evidence", "run", "--work", "FR-001", "--title", "captured", "--project", root, "--json"];
  const script = "console.log('private-output'); process.exit(7)";
  const preview = spawnSync(process.execPath, [...args, "--", process.execPath, "-e", script], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).status, "dry-run");
  assert.equal(run("evidence", "list").report.proof.length, 0);
  const failed = spawnSync(process.execPath, [...args, "--apply", "--", process.execPath, "-e", script], { encoding: "utf8" });
  assert.equal(failed.status, 1, failed.stderr);
  const report = JSON.parse(failed.stdout);
  assert.equal(report.executionResult, "failed");
  const stored = await readFile(path.join(root, ".catpaw", report.artifacts[0].path), "utf8");
  assert.match(stored, /origin: captured/);
  assert.match(stored, /exitCode: 7/);
  assert.doesNotMatch(stored, /private-output/);
});

test("scoped Evidence repair is incremental and leaves unrelated records and dashboard untouched", async t => {
  const { root, run } = await fixture(t);
  const legacy = path.join(root, ".catpaw/work/BUG-099-broken-history.md");
  const content = "---\nid: BUG-099\ntype: bug\nmode: gated\nstatus: done\nstage: reflect\ncreated: 2026-09-05\nupdated: 2026-09-05\nclosed: 2026-09-05\n---\n\n# Broken history\n";
  await writeFile(legacy, content);
  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.equal(run("board", "doctor").code, 1);
  const changed = run("work", "update", "--id", "FR-001", "--next", "Proceed safely", "--apply");
  assert.equal(changed.code, 0, JSON.stringify(changed.report));
  assert.equal(await readFile(legacy, "utf8"), content);
  assert.equal(await readFile(path.join(root, ".catpaw/index.md"), "utf8"), index);
  assert.equal(run("evidence", "add", "--work", "BUG-099", "--type", "test", "--title", "recovered test", "--body", "Original retained test result checked.", "--apply").code, 0);
  assert.equal(run("board", "doctor").code, 1);
  assert.equal(run("evidence", "add", "--work", "BUG-099", "--type", "review", "--title", "recovered review", "--body", "Original reviewer result checked.", "--agent", "checker", "--independent", "--apply").code, 0);
  assert.equal(run("board", "doctor").code, 0);
  assert.equal(await readFile(legacy, "utf8"), content);
  await writeFile(legacy, content.replace("mode: gated", "mode: unsafe"));
  assert.equal(run("work", "update", "--id", "FR-001", "--next", "Must refuse malformed schema", "--apply").code, 1);
});

test("non-Git candidate excludes board writes through a project path alias", async t => {
  const { root, run } = await fixture(t);
  await rm(path.join(root, ".git"), { recursive: true });
  const workPath = path.join(root, ".catpaw/work/FR-001-accept-current-app.md");
  await writeFile(workPath, (await readFile(workPath, "utf8")).replace("scope: app.txt", "scope: ."));
  const alias = `${root}-alias`;
  await symlink(root, alias);
  t.after(() => rm(alias));
  const invoke = (...args) => {
    const r = spawnSync(process.execPath, [cli, ...args, "--project", alias, "--json"], { encoding: "utf8" });
    return { code: r.status, report: JSON.parse(r.stdout) };
  };
  const candidate = invoke("work", "show", "--id", "FR-001").report.candidate;
  assert.equal(passed(invoke, "test", "alias test", candidate).code, 0);
  assert.equal(passed(invoke, "review", "alias review", candidate, ["--independent", "--agent", "checker"]).code, 0);
  assert.equal(invoke("work", "finish", "--id", "FR-001", "--apply").code, 0);
  assert.equal(run("board", "doctor").code, 0);
});

test("capture timeout settles even when an escaped descendant holds an output pipe", async t => {
  const { root } = await fixture(t);
  const script = `require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(()=>{},2000)'], { detached:true, stdio:['ignore',1,2] }).unref()`;
  const started = Date.now();
  const result = spawnSync(process.execPath, [cli, "evidence", "run", "--work", "FR-001", "--title", "escaped pipe", "--timeout-ms", "100", "--project", root, "--json", "--apply", "--", process.execPath, "-e", script], { encoding: "utf8", timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).executionResult, "blocked");
  assert.ok(Date.now() - started < 1600, "capture must not await the escaped two-second descendant");
});

test("a checkout without an empty plans directory remains usable", async t => {
  const { root, run } = await fixture(t);
  const before = run("work", "show", "--id", "FR-001").report.candidate;
  await rmdir(path.join(root, ".catpaw/plans"));
  const shown = run("work", "show", "--id", "FR-001");
  assert.equal(shown.code, 0, JSON.stringify(shown.report));
  assert.equal(shown.report.candidate, before);
  assert.equal(run("work", "start", "--id", "FR-002", "--title", "Optional Plan", "--with-plan", "--apply").code, 0);
  assert.equal(run("work", "finish", "--id", "FR-002", "--apply").code, 0);
});
