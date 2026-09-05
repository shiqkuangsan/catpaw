import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, chmod, lstat, symlink, readlink, readdir, cp, rename, unlink, link } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createOperationPlan, applyOperationPlan, recoverOperation, readReceipt } from "../src/runtime/lib/runtime-operations.mjs";
import { runRuntimeCommand } from "../src/runtime/lib/commands/runtime.mjs";
import { runAdapterCommand } from "../src/runtime/lib/commands/adapter.mjs";
import { inspectPackage, readSurface } from "../src/runtime/lib/runtime-package.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-operations-test-"));
  // Retain task-owned fixtures for failure diagnosis; never clean a supplied root.
  const packageRoot = path.join(root, "package");
  const target = path.join(root, "live");
  await mkdir(path.join(packageRoot, "bin"), { recursive: true });
  await mkdir(path.join(packageRoot, "snippets"));
  const manifest = { name: "catpaw-runtime", version: "4.0.0", boardSchemaVersion: 2,
    canonicalFiles: ["VERSION", "runtime-manifest.json", "runtime-policy.md", "bin/", "snippets/"],
    legacyRuntimePaths: ["retired/"], cli: { entrypoint: "bin/catpaw.mjs", commands: ["runtime", "adapter"] } };
  await writeFile(path.join(packageRoot, "runtime-manifest.json"), JSON.stringify(manifest));
  await writeFile(path.join(packageRoot, "VERSION"), "4.0.0\n");
  await writeFile(path.join(packageRoot, "runtime-policy.md"), "# Policy\n");
  await writeFile(path.join(packageRoot, "bin/catpaw.mjs"), 'console.log("catpaw 4.0.0 (board schema 2)");\n');
  await chmod(path.join(packageRoot, "bin/catpaw.mjs"), 0o755);
  for (const scope of ["global", "project"]) await writeFile(path.join(packageRoot, `snippets/${scope}-adapter.md`),
    `<!-- CATPAW:BEGIN -->\n# ${scope}\nRead ~/.catpaw/runtime-policy.md\n<!-- CATPAW:END -->\n`);
  await mkdir(path.join(target, "state"), { recursive: true });
  await mkdir(path.join(target, "backups"));
  await mkdir(path.join(target, "retired"));
  await writeFile(path.join(target, "VERSION"), "3.4.4\n");
  await writeFile(path.join(target, "runtime-manifest.json"), JSON.stringify({ ...manifest, version: "3.4.4", canonicalFiles: ["VERSION", "runtime-manifest.json", "retired/"] }));
  await writeFile(path.join(target, "state/session"), "private-state\n");
  await chmod(path.join(target, "state/session"), 0o600);
  await writeFile(path.join(target, "unknown"), "user-owned\n");
  await symlink("unknown", path.join(target, "local-link"));
  return { root, packageRoot, target, backupRoot: path.join(root, "operations") };
}

test("runtime plan and apply preview do not write; publication preserves unknown roots and a recoverable backup", async (t) => {
  const f = await fixture(t);
  const out = path.join(f.root, "plan.json");
  const before = await readdir(f.root);
  const preview = await runRuntimeCommand({ ...f, command: "plan", out });
  assert.equal(preview.exitCode, 0);
  assert.deepEqual(await readdir(f.root), before);
  assert.equal(preview.report.plan.kind, "runtime");
  assert.equal("operations" in preview.report.plan, false);
  assert.equal((await runRuntimeCommand({ ...f, command: "plan", out, apply: true })).exitCode, 0);
  const dry = await runRuntimeCommand({ ...f, command: "apply", planFile: out });
  assert.equal(dry.report.status, "preview");
  assert.equal(await readFile(path.join(f.target, "VERSION"), "utf8"), "3.4.4\n");
  const result = await runRuntimeCommand({ ...f, command: "apply", planFile: out, apply: true });
  assert.equal(result.exitCode, 0, JSON.stringify(result));
  assert.equal(await readFile(path.join(f.target, "VERSION"), "utf8"), "4.0.0\n");
  assert.equal(await readFile(path.join(f.target, "state/session"), "utf8"), "private-state\n");
  assert.equal((await lstat(path.join(f.target, "state/session"))).mode & 0o777, 0o600);
  assert.equal(await readlink(path.join(f.target, "local-link")), "unknown");
  assert.equal((await readdir(f.target)).includes("retired"), false);
  const receipt = await readReceipt(result.report.receipt);
  assert.equal(await readFile(path.join(receipt.backup, "VERSION"), "utf8"), "3.4.4\n");
  const recovered = await recoverOperation({ target: f.target, receipt: result.report.receipt, apply: true, kind: "runtime" });
  assert.equal(recovered.status, "rolled-back");
  assert.equal(await readFile(path.join(f.target, "VERSION"), "utf8"), "3.4.4\n");
  assert.equal((await recoverOperation({ target: f.target, receipt: result.report.receipt, apply: true, kind: "runtime" })).status, "already-restored");
});

test("package drift, target drift, forged plan fields, and target substitution fail before publication", async (t) => {
  for (const mutation of ["package", "target", "forged", "substitution"]) {
    const f = await fixture(t);
    const plan = await createOperationPlan({ ...f, kind: "runtime" });
    let target = f.target;
    if (mutation === "package") await writeFile(path.join(f.packageRoot, "runtime-policy.md"), "changed\n");
    if (mutation === "target") await writeFile(path.join(f.target, "unknown"), "concurrent\n");
    if (mutation === "forged") plan.operations = [{ type: "remove-dir", path: f.target }];
    if (mutation === "substitution") target = path.join(f.root, "different");
    await assert.rejects(applyOperationPlan(plan, { ...f, target, apply: true }), /drift|plan|target/i);
    assert.equal(await readFile(path.join(f.target, "VERSION"), "utf8"), "3.4.4\n");
  }
});

test("adapter changes exactly one block, preserving BOM, CRLF, suffix, and mode", async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, "AGENTS.md");
  const prefix = "\ufeff# Strict Git\r\nNever push.\r\n";
  const suffix = "\r\n# User rules\r\nKeep this.\r\n";
  await writeFile(target, `${prefix}<!-- CATPAW:BEGIN -->\r\nold\r\n<!-- CATPAW:END -->${suffix}`);
  await chmod(target, 0o640);
  const plan = await createOperationPlan({ ...f, target, kind: "adapter", scope: "global" });
  const applied = await applyOperationPlan(plan, { ...f, target, apply: true });
  const actual = await readFile(target, "utf8");
  assert.ok(actual.startsWith(prefix));
  assert.ok(actual.endsWith(suffix));
  assert.ok(actual.includes("# global\r\n"));
  assert.equal((await lstat(target)).mode & 0o777, 0o640);
  await recoverOperation({ target, receipt: applied.receipt, apply: true, kind: "adapter" });
  assert.ok((await readFile(target, "utf8")).includes("\r\nold\r\n"));
});

test("adapter rejects duplicate or partial markers and symlink targets", async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, "AGENTS.md");
  for (const content of ["<!-- CATPAW:BEGIN -->", "<!-- CATPAW:END -->", "<!-- CATPAW:BEGIN --><!-- CATPAW:END --><!-- CATPAW:BEGIN --><!-- CATPAW:END -->"]) {
    await writeFile(target, content);
    assert.equal((await runAdapterCommand({ ...f, target, scope: "global", command: "plan" })).exitCode, 1);
  }
  await symlink(target, path.join(f.root, "alias.md"));
  await assert.rejects(createOperationPlan({ ...f, target: path.join(f.root, "alias.md"), kind: "adapter", scope: "global" }), /symlink/i);
});

test("durable receipt precedes claim; last-window preimage changes restore the actual captured old root", async (t) => {
  const f = await fixture(t);
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  let receiptPath;
  await assert.rejects(applyOperationPlan(plan, { ...f, apply: true, fault: async (event, receipt) => {
    if (event === "before-claim") {
      receiptPath = receipt.receipt;
      assert.equal((await readReceipt(receiptPath)).phase, "claiming");
      await writeFile(path.join(f.target, "state/session"), "last-window-state\n");
    }
  } }), /drift/i);
  assert.equal(await readFile(path.join(f.target, "state/session"), "utf8"), "last-window-state\n");
  assert.equal((await readReceipt(receiptPath)).phase, "rolled-back");
});

test("post-publication validation failure rolls back; drift on either surface retains both copies", async (t) => {
  for (const drift of ["none", "live", "backup"]) {
    const f = await fixture(t);
    const plan = await createOperationPlan({ ...f, kind: "runtime" });
    let receiptPath;
    await assert.rejects(applyOperationPlan(plan, { ...f, apply: true, fault: async (event, receipt) => {
      if (event === "published") {
        receiptPath = receipt.receipt;
        if (drift === "live") await writeFile(path.join(f.target, "unknown"), "new-live-state\n");
        if (drift === "backup") await writeFile(path.join(receipt.backup, "unknown"), "new-backup-state\n");
        throw new Error("forced strict verification failure");
      }
    } }), /verification failure/);
    const receipt = await readReceipt(receiptPath);
    assert.equal(receipt.phase, drift === "none" ? "rolled-back" : "recovery-required");
    assert.equal(await readFile(path.join(f.target, "VERSION"), "utf8"), drift === "none" ? "3.4.4\n" : "4.0.0\n");
    if (drift !== "none") await assert.rejects(recoverOperation({ target: f.target, receipt: receiptPath, kind: "runtime", apply: true }), /drift/i);
  }
});

test("installed package sources exclude local extras and allow a no-op self inspection", async (t) => {
  const f = await fixture(t);
  const before = await inspectPackage(f.packageRoot);
  await mkdir(path.join(f.packageRoot, "state"));
  await writeFile(path.join(f.packageRoot, "state/private"), "do not package this");
  await symlink("/definitely-not-readable", path.join(f.packageRoot, "unknown-link"));
  const after = await inspectPackage(f.packageRoot);
  assert.equal(after.snapshot.digest, before.snapshot.digest);
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  assert.equal(plan.changes.some((change) => change.path === "state/private" || change.path === "unknown-link"), false);
  const self = await createOperationPlan({ ...f, target: f.packageRoot, kind: "runtime" });
  assert.equal(self.targetDigest, self.candidateDigest);
});

test("new canonical collisions and unowned nonempty targets block; unowned retired roots survive", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.target, "runtime-policy.md"), "user owns this file");
  await assert.rejects(createOperationPlan({ ...f, kind: "runtime" }), /unowned/);
  await unlink(path.join(f.target, "runtime-policy.md"));
  const oldManifest = JSON.parse(await readFile(path.join(f.target, "runtime-manifest.json"), "utf8"));
  oldManifest.canonicalFiles = ["VERSION", "runtime-manifest.json"];
  await writeFile(path.join(f.target, "runtime-manifest.json"), JSON.stringify(oldManifest));
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  assert.ok(plan.preservedRoots.includes("retired"));
  await applyOperationPlan(plan, { ...f, apply: true });
  assert.ok((await lstat(path.join(f.target, "retired"))).isDirectory());
  const unowned = path.join(f.root, "unowned");
  await mkdir(unowned);
  await writeFile(path.join(unowned, "VERSION"), "somebody else's version");
  await assert.rejects(createOperationPlan({ ...f, target: unowned, kind: "runtime" }), /ownership/i);
});

test("protected manifest roots and managed symlinks cannot become package input", async (t) => {
  const f = await fixture(t);
  const manifestPath = path.join(f.packageRoot, "runtime-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const relative of ["state/", "backups/", "../escape/", "/absolute/", "bin/../escape/"]) {
    await writeFile(manifestPath, JSON.stringify({ ...manifest, legacyRuntimePaths: [relative] }));
    await assert.rejects(inspectPackage(f.packageRoot), /manifest/i);
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
  await unlink(path.join(f.packageRoot, "runtime-policy.md"));
  await symlink(path.join(f.target, "unknown"), path.join(f.packageRoot, "runtime-policy.md"));
  await assert.rejects(inspectPackage(f.packageRoot), /symlink/i);
});

test("an actual post-publication CLI failure restores the original runtime", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.packageRoot, "bin/catpaw.mjs"), 'console.log(import.meta.url.includes("catpaw-stage-") ? "catpaw 4.0.0 (board schema 2)" : "broken version");\n');
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  let receipt;
  await assert.rejects(applyOperationPlan(plan, { ...f, apply: true }).catch((error) => { receipt = error.receipt; throw error; }), /CLI --version/);
  assert.equal((await readReceipt(receipt)).phase, "rolled-back");
  assert.equal((await readSurface(f.target)).digest, plan.targetDigest);
});

test("process interruption after claim or publication is recovered from durable disk state", async (t) => {
  for (const event of ["claimed", "published"]) {
    const f = await fixture(t);
    const plan = await createOperationPlan({ ...f, kind: "runtime" });
    const receipt = path.join(f.root, "receipt.json");
    const moduleUrl = new URL("../src/runtime/lib/runtime-operations.mjs", import.meta.url).href;
    const script = `import {applyOperationPlan} from ${JSON.stringify(moduleUrl)}; await applyOperationPlan(${JSON.stringify(plan)}, {...${JSON.stringify(f)},receipt:${JSON.stringify(receipt)},apply:true,fault:async(event)=>{if(event===${JSON.stringify(event)})process.exit(73)}});`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 73, result.stderr);
    const persisted = await readReceipt(receipt);
    assert.equal(persisted.phase, event);
    const before = (await readSurface(f.target)).digest;
    assert.equal((await recoverOperation({ target: f.target, receipt, kind: "runtime" })).status, "preview");
    assert.equal((await readSurface(f.target)).digest, before);
    await recoverOperation({ target: f.target, receipt, kind: "runtime", apply: true });
    assert.equal((await readSurface(f.target)).digest, plan.targetDigest);
  }
});

test("adapter recovery handles an interrupted exclusive hard-link publication and a fresh target", async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, "new-rule.md");
  const plan = await createOperationPlan({ ...f, target, kind: "adapter", scope: "project" });
  let receiptPath;
  await assert.rejects(applyOperationPlan(plan, { ...f, target, apply: true, fault: async (event, value) => {
    if (event === "published") {
      receiptPath = value.receipt;
      // Recreate the link-before-unlink crash window without touching other files.
      await link(target, value.stage);
      throw new Error("hard-link crash simulation");
    }
  } }), /crash simulation/);
  assert.equal((await readReceipt(receiptPath)).phase, "rolled-back");
  assert.equal((await readSurface(target)).exists, false);
});

test("receipt tampering, target substitution, and changed preimages do not authorize recovery", async (t) => {
  const f = await fixture(t);
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  const applied = await applyOperationPlan(plan, { ...f, apply: true });
  await assert.rejects(recoverOperation({ target: path.join(f.root, "wrong"), receipt: applied.receipt, kind: "runtime", apply: true }), /target/i);
  const receipt = JSON.parse(await readFile(applied.receipt, "utf8"));
  receipt.backup = f.packageRoot;
  await writeFile(applied.receipt, JSON.stringify(receipt));
  await assert.rejects(recoverOperation({ target: f.target, receipt: applied.receipt, kind: "runtime", apply: true }), /integrity/i);
  assert.equal((await readSurface(f.target)).digest, plan.candidateDigest);
});

test("the real source manifest and packaged CLI install successfully into an isolated target", async (t) => {
  const f = await fixture(t);
  const source = new URL("../src/runtime/", import.meta.url);
  const realPackage = path.join(f.root, "real-package");
  await cp(source, realPackage, { recursive: true, preserveTimestamps: true });
  const pkg = await inspectPackage(realPackage);
  assert.equal(pkg.manifest.boardSchemaVersion, 2);
  const target = path.join(f.root, "real-live");
  const plan = await createOperationPlan({ ...f, packageRoot: realPackage, target, kind: "runtime" });
  const result = await applyOperationPlan(plan, { ...f, packageRoot: realPackage, target, apply: true });
  assert.equal(result.verification.cliVersion, "passed");
  const cli = spawnSync(process.execPath, [path.join(target, pkg.manifest.cli.entrypoint), "--version"], { encoding: "utf8", timeout: 15000 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout.trim(), `catpaw ${pkg.manifest.version} (board schema 2)`);
  await rename(realPackage, `${realPackage}-removed`);
  await recoverOperation({ target, receipt: result.receipt, kind: "runtime", apply: true });
  assert.equal((await readSurface(target)).exists, false);
});

test("recovery cannot overlap a live publisher or a second recovery", async (t) => {
  const f = await fixture(t);
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  const applied = await applyOperationPlan(plan, { ...f, apply: true, fault: async (event, value) => {
    if (event === "published") {
      await assert.rejects(recoverOperation({ target: f.target, receipt: value.receipt, kind: "runtime", apply: true }), /still alive/);
      assert.equal((await readSurface(f.target)).digest, plan.candidateDigest);
    }
  } });
  let announce;
  const acquired = new Promise(resolve => { announce = resolve; });
  let resume;
  const held = new Promise(resolve => { resume = resolve; });
  const first = recoverOperation({ target: f.target, receipt: applied.receipt, kind: "runtime", apply: true, fault: async () => { announce(); await held; } });
  await acquired;
  await assert.rejects(recoverOperation({ target: f.target, receipt: applied.receipt, kind: "runtime", apply: true }), /still alive/);
  assert.equal((await readSurface(f.target)).digest, plan.candidateDigest);
  resume();
  assert.equal((await first).status, "rolled-back");
});

test("a crashed recovery owner can be replaced after its PID is dead", async (t) => {
  const f = await fixture(t);
  const plan = await createOperationPlan({ ...f, kind: "runtime" });
  const applied = await applyOperationPlan(plan, { ...f, apply: true });
  const moduleUrl = new URL("../src/runtime/lib/runtime-operations.mjs", import.meta.url).href;
  const script = `import {recoverOperation} from ${JSON.stringify(moduleUrl)}; await recoverOperation({...${JSON.stringify({ target: f.target, receipt: applied.receipt, kind: "runtime", apply: true })},fault:async()=>process.exit(73)});`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 30000 });
  assert.equal(child.status, 73, child.stderr);
  assert.equal((await recoverOperation({ target: f.target, receipt: applied.receipt, kind: "runtime", apply: true })).status, "rolled-back");
  assert.equal((await readSurface(f.target)).digest, plan.targetDigest);
});
