import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));

function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function boardFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-facade-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const initialized = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ], root);
  assert.equal(initialized.code, 0, initialized.stderr || initialized.stdout);
  return root;
}

test("work start --high-risk maps to internal gated metadata", async (t) => {
  const root = await boardFixture(t);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-900",
    "--title",
    "High Risk Facade",
    "--high-risk",
    "--apply",
    "--json",
  ], root);
  assert.equal(started.code, 0, started.stderr || started.stdout);

  const content = await readFile(
    path.join(root, ".catpaw", "work", "FR-900-high-risk-facade.md"),
    "utf8",
  );
  assert.match(content, /^mode: gated$/m);

  const conflict = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-901",
    "--title",
    "Conflicting Risk Inputs",
    "--high-risk",
    "--mode",
    "tracked",
  ], root);
  assert.equal(conflict.code, 2);
  assert.match(conflict.stderr, /--high-risk and --mode are mutually exclusive/);
});

test("ordinary work start keeps tracked storage compatibility", async (t) => {
  const root = await boardFixture(t);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-902",
    "--title",
    "Ordinary Facade",
    "--apply",
    "--json",
  ], root);
  assert.equal(started.code, 0, started.stderr || started.stdout);
  const content = await readFile(
    path.join(root, ".catpaw", "work", "FR-902-ordinary-facade.md"),
    "utf8",
  );
  assert.match(content, /^mode: tracked$/m);
});

test("proof add stores typed Evidence while evidence add remains compatible", async (t) => {
  const root = await boardFixture(t);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-903",
    "--title",
    "Proof Facade",
    "--apply",
    "--json",
  ], root);
  assert.equal(started.code, 0, started.stderr || started.stdout);

  const emptyProof = await runCli([
    "proof",
    "add",
    "--project",
    root,
    "--work",
    "FR-903",
    "--type",
    "test",
    "--title",
    "Empty Proof",
    "--apply",
  ], root);
  assert.equal(emptyProof.code, 2);
  assert.match(emptyProof.stderr, /--body or --body-file is required to record Proof/);

  const proof = await runCli([
    "proof",
    "add",
    "--project",
    root,
    "--work",
    "FR-903",
    "--type",
    "test",
    "--title",
    "Facade Test",
    "--body",
    "Executed the facade regression test; all assertions passed.",
    "--apply",
    "--json",
  ], root);
  assert.equal(proof.code, 0, proof.stderr || proof.stdout);
  const proofReport = JSON.parse(proof.stdout);
  assert.equal(proofReport.command, "proof add");
  assert.equal(proofReport.storageKind, "evidence");
  assert.equal(proofReport.proof.type, "test");
  assert.equal(proofReport.artifacts[0].kind, "evidence");

  const stored = await readFile(
    path.join(root, ".catpaw", proofReport.artifacts[0].path),
    "utf8",
  );
  assert.match(stored, /^type: test$/m);
  assert.match(stored, /^work: FR-903$/m);

  const evidence = await runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--work",
    "FR-903",
    "--type",
    "review",
    "--title",
    "Compatibility Review",
    "--body",
    "Confirmed the compatibility command still emits schema 2 Evidence.",
    "--json",
  ], root);
  assert.equal(evidence.code, 0, evidence.stderr || evidence.stdout);
  const evidenceReport = JSON.parse(evidence.stdout);
  assert.equal(evidenceReport.command, "evidence add");
  assert.equal(evidenceReport.evidence.type, "review");
  assert.equal(Object.hasOwn(evidenceReport, "proof"), false);
});

test("help and version make the preferred CLI discoverable", async (t) => {
  const root = await boardFixture(t);
  const general = await runCli([], root);
  const work = await runCli(["work", "update", "--help"], root);
  const version = await runCli(["--version"], root);

  assert.equal(general.code, 0, general.stderr);
  assert.match(general.stdout, /Core commands:/);
  assert.match(general.stdout, /catpaw status/);
  assert.match(general.stdout, /transport check\|open\|send\|status\|read\|close/);
  assert.equal(work.code, 0, work.stderr);
  assert.match(work.stdout, /--phase understand\|execute\|check\|finish/);
  assert.equal(version.code, 0, version.stderr);
  assert.match(version.stdout, /^catpaw 3\.4\.1 \(board schema 2\)\n$/);
});

test("status and Work commands expose Phase, Proof, and Next without schema leakage", async (t) => {
  const root = await boardFixture(t);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-910",
    "--title",
    "Visible Work Flow",
    "--apply",
    "--json",
  ], root);
  assert.equal(started.code, 0, started.stderr || started.stdout);
  const workPath = path.join(root, ".catpaw/work/FR-910-visible-work-flow.md");
  const before = await readFile(workPath, "utf8");

  const preview = await runCli([
    "work",
    "update",
    "--project",
    root,
    "--id",
    "FR-910",
    "--phase",
    "execute",
    "--next",
    "Run the focused regression suite",
    "--json",
  ], root);
  assert.equal(preview.code, 0, preview.stderr || preview.stdout);
  assert.equal(JSON.parse(preview.stdout).mode, "dry-run");
  assert.equal(await readFile(workPath, "utf8"), before);

  const applied = await runCli([
    "work",
    "update",
    "--project",
    root,
    "--id",
    "FR-910",
    "--phase",
    "execute",
    "--next",
    "Run the focused regression suite",
    "--apply",
    "--json",
  ], root);
  assert.equal(applied.code, 0, applied.stderr || applied.stdout);
  assert.equal(JSON.parse(applied.stdout).work.phase, "Execute");

  const shown = await runCli([
    "work",
    "show",
    "--project",
    root,
    "--id",
    "FR-910",
    "--json",
  ], root);
  const shownReport = JSON.parse(shown.stdout);
  assert.equal(shownReport.work.phase, "Execute");
  assert.equal(shownReport.work.next, "Run the focused regression suite");

  const status = await runCli(["status", "--project", root], root);
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /CatPaw 3\.4\.1/);
  assert.match(status.stdout, /Phase: Execute \| Risk: Normal/);
  assert.match(status.stdout, /Next: Run the focused regression suite/);
  assert.doesNotMatch(status.stdout, /Schema:|Mode:|Evidence:/);

  const dashboard = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.match(dashboard, /\| ID \| Outcome \| State \| Phase \| Risk \| Next \| Details \|/);
  assert.doesNotMatch(dashboard, /\| Mode \||\| Stage \|/);

  const finished = await runCli([
    "work",
    "finish",
    "--project",
    root,
    "--id",
    "FR-910",
    "--apply",
    "--json",
  ], root);
  assert.equal(finished.code, 0, finished.stderr || finished.stdout);
  assert.equal(JSON.parse(finished.stdout).command, "work finish");
  assert.equal(JSON.parse(finished.stdout).closure.status, "done");
  const closed = await readFile(workPath, "utf8");
  assert.match(closed, /^status: done$/m);
  assert.match(closed, /^- Phase: Finish$/m);
  assert.match(closed, /^- Next: Completed$/m);
});

test("Proof file input, list, and show preserve typed schema 2 storage", async (t) => {
  const root = await boardFixture(t);
  await writeFile(
    path.join(root, "proof-body.txt"),
    "Executed node --test; all focused assertions passed.\n",
  );
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-911",
    "--title",
    "Proof Queries",
    "--apply",
    "--json",
  ], root);
  assert.equal(started.code, 0, started.stderr || started.stdout);

  const added = await runCli([
    "proof",
    "add",
    "--project",
    root,
    "--work",
    "FR-911",
    "--type",
    "test",
    "--title",
    "Focused Test",
    "--body-file",
    "proof-body.txt",
    "--apply",
    "--json",
  ], root);
  assert.equal(added.code, 0, added.stderr || added.stdout);
  const proofPath = JSON.parse(added.stdout).artifacts[0].path;

  const listed = await runCli([
    "proof",
    "list",
    "--project",
    root,
    "--work",
    "FR-911",
    "--json",
  ], root);
  assert.equal(listed.code, 0, listed.stderr || listed.stdout);
  assert.deepEqual(JSON.parse(listed.stdout).proof.map((item) => item.path), [proofPath]);

  const shown = await runCli([
    "proof",
    "show",
    "--project",
    root,
    "--path",
    proofPath,
    "--json",
  ], root);
  assert.equal(shown.code, 0, shown.stderr || shown.stdout);
  const report = JSON.parse(shown.stdout);
  assert.equal(report.proof.type, "test");
  assert.equal(report.proof.work, "FR-911");
  assert.match(report.proof.body, /all focused assertions passed/);
});

test("preferred intent and transport namespaces retain Agent aliases", async (t) => {
  const root = await boardFixture(t);
  const preferredIntent = await runCli([
    "intent",
    "list",
    "--project",
    root,
    "--json",
  ], root);
  const compatibleIntent = await runCli([
    "agent",
    "intents",
    "--project",
    root,
    "--json",
  ], root);
  assert.equal(JSON.parse(preferredIntent.stdout).command, "intent list");
  assert.equal(JSON.parse(compatibleIntent.stdout).command, "agent intents");
  assert.deepEqual(
    JSON.parse(preferredIntent.stdout).intents,
    JSON.parse(compatibleIntent.stdout).intents,
  );

  const preferredTransport = await runCli([
    "transport",
    "check",
    "--project",
    root,
    "--agent",
    "cx",
    "--json",
  ], root);
  const compatibleAgent = await runCli([
    "agent",
    "check",
    "--project",
    root,
    "--agent",
    "cx",
    "--json",
  ], root);
  assert.equal(JSON.parse(preferredTransport.stdout).command, "transport check");
  assert.equal(JSON.parse(compatibleAgent.stdout).command, "agent check");
});
