import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  assert.match(emptyProof.stderr, /--body is required when --apply records Proof/);

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
