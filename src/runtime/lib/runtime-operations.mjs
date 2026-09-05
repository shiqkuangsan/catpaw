import { randomUUID } from "node:crypto";
import { open, readFile, mkdir, cp, rm, rename, link, unlink, rmdir, chmod, chown, lchown, lstat } from "node:fs/promises";
import path from "node:path";
import { adapterCandidate, contains, fail, hash, inspectPackage, readSurface, runtimeCandidate, safePath, stable, surfaceDigest, verifyRuntime } from "./runtime-package.mjs";

const PLAN_FORMAT = "catpaw-operation-plan/v1";
const RECEIPT_FORMAT = "catpaw-operation-receipt/v1";
const ABSENT = "absent-root";
const DIGEST = /^(?:[a-f0-9]{64}|absent-root)$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PLAN_KEYS = ["format", "id", "kind", "target", "packageRoot", "scope", "version", "runtimeHash", "packageDigest", "targetDigest", "candidateDigest", "changes", "preservedRoots"];
const RECEIPT_KEYS = ["format", "id", "kind", "target", "packageRoot", "version", "planId", "beforeDigest", "candidateDigest", "capturedDigest", "backupRoot", "backup", "stage", "receipt", "lock", "phase", "verification", "error", "integrity"];
const LOCK_LEASES = new WeakMap();
const sealed = (value) => ({ ...value, integrity: hash(stable(value)) });
function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || stable(Object.keys(value).sort()) !== stable([...keys].sort())) fail("DECLARATION", `Invalid ${label} fields`);
}
function checkPlan(plan) {
  exactKeys(plan, PLAN_KEYS, "plan");
  const { id, ...body } = plan;
  if (plan.format !== PLAN_FORMAT || !["runtime", "adapter"].includes(plan.kind) || id !== hash(stable(body))) fail("DECLARATION", "Invalid plan declaration or digest");
}
async function context(options) {
  const kind = options.kind;
  if (!["runtime", "adapter"].includes(kind)) fail("KIND", "Operation kind must be runtime or adapter");
  const target = await safePath(options.target);
  if (target === path.parse(target).root) fail("PATH", "Filesystem root is not a valid target");
  const pkg = await inspectPackage(options.packageRoot);
  if (target !== pkg.root && (contains(target, pkg.root) || contains(pkg.root, target))) fail("PATH", "Package and target surfaces must be disjoint or identical");
  const before = await readSurface(target);
  const expectedType = kind === "runtime" ? "dir" : "file";
  if (before.exists && before.rootType !== expectedType) fail("TARGET_TYPE", `${kind} target must be a regular ${expectedType}`);
  const scope = kind === "adapter" ? options.scope : null;
  const candidate = kind === "runtime" ? { entries: await runtimeCandidate(pkg, before, target) } : await adapterCandidate(pkg, target, before, scope);
  return { kind, target, pkg, before, candidate, scope };
}
function declaration(ctx) {
  const { kind, target, pkg, before, candidate, scope } = ctx;
  const paths = [...new Set([...before.entries.keys(), ...candidate.entries.keys()])].sort();
  const changes = paths.filter((relative) => stable(before.entries.get(relative)) !== stable(candidate.entries.get(relative))).map((relative) => ({
    path: relative || ".", action: !before.entries.has(relative) ? "create" : !candidate.entries.has(relative) ? "remove" : "replace",
    before: before.entries.has(relative) ? hash(stable(before.entries.get(relative))) : null,
    after: candidate.entries.has(relative) ? hash(stable(candidate.entries.get(relative))) : null,
  }));
  const preservedRoots = kind === "runtime" ? [...before.entries.keys()].filter((relative) => relative && !relative.includes("/") && !pkg.canonical.includes(relative) && candidate.entries.has(relative)).sort() : [];
  const body = { format: PLAN_FORMAT, kind, target, packageRoot: pkg.root, scope, version: pkg.manifest.version, runtimeHash: pkg.runtimeHash,
    packageDigest: pkg.snapshot.digest, targetDigest: before.digest, candidateDigest: surfaceDigest(candidate.entries), changes, preservedRoots };
  return { ...body, id: hash(stable(body)) };
}
export async function createOperationPlan(options) { return declaration(await context(options)); }
async function rebuild(plan, options) {
  checkPlan(plan);
  if (await safePath(options.target) !== plan.target) fail("TARGET", "Explicit target differs from plan target");
  if (options.kind && options.kind !== plan.kind) fail("KIND", "Plan belongs to another command");
  if (options.packageRoot && await safePath(options.packageRoot, "packageRoot") !== plan.packageRoot) fail("PACKAGE", "Explicit packageRoot differs from plan");
  const ctx = await context({ kind: plan.kind, target: options.target, packageRoot: plan.packageRoot, scope: plan.scope });
  if (stable(declaration(ctx)) !== stable(plan)) fail("DRIFT", "Package, target, or plan drift: generate and review a fresh plan");
  return ctx;
}
async function syncDirectory(directory) {
  let handle;
  try { handle = await open(directory, "r"); await handle.sync(); }
  catch (error) { if (!["EINVAL", "ENOTSUP", "EISDIR"].includes(error.code)) throw error; }
  finally { await handle?.close(); }
}
async function writeExclusive(file, content) {
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
  await syncDirectory(path.dirname(file));
}
function disjointAuxiliary(auxiliary, target, packageRoot, label) {
  if (contains(target, auxiliary) || contains(auxiliary, target) || contains(packageRoot, auxiliary) || contains(auxiliary, packageRoot)) fail("PATH", `${label} must be disjoint from target and package`);
}
export async function writeOperationPlan(plan, output) {
  checkPlan(plan);
  const out = await safePath(output, "out");
  disjointAuxiliary(out, plan.target, plan.packageRoot, "Plan output");
  await writeExclusive(out, `${JSON.stringify(plan, null, 2)}\n`);
  return out;
}
export async function readOperationPlan(input) {
  const file = await safePath(input, "planFile");
  const plan = JSON.parse(await readFile(file, "utf8"));
  checkPlan(plan);
  return plan;
}
function pathsFor(target, backupRoot, id) {
  const transaction = path.join(backupRoot, `operation-${id}`);
  return { transaction, backup: path.join(transaction, "preimage"), stage: path.join(path.dirname(target), `.${path.basename(target)}.catpaw-stage-${id}`),
    lock: path.join(path.dirname(target), `.${path.basename(target)}.catpaw-operation.lock`), receipt: path.join(transaction, "receipt.json") };
}
async function journal(value, existingText = null) {
  let previous = existingText;
  async function save(phase, updates = {}) {
    Object.assign(value, updates, { phase });
    const text = `${JSON.stringify(sealed(value), null, 2)}\n`;
    if (previous === null) await writeExclusive(value.receipt, text);
    else {
      if (await safePath(value.receipt, "receipt") !== value.receipt || await readFile(value.receipt, "utf8") !== previous) fail("RECEIPT_DRIFT", "Receipt changed during operation; retain all recovery surfaces");
      const temporary = `${value.receipt}.tmp-${randomUUID()}`;
      await writeExclusive(temporary, text);
      await rename(temporary, value.receipt);
      await syncDirectory(path.dirname(value.receipt));
    }
    previous = text;
  }
  return { value, save };
}
async function setMetadata(root, entries) {
  // Metadata comes from observed package/preimage entries, never serialized operations.
  for (const [relative, entry] of [...entries].sort(([a], [b]) => b.length - a.length)) {
    const file = path.join(root, relative);
    const stat = await lstat(file);
    if (stat.uid !== entry.uid || stat.gid !== entry.gid) await (entry.type === "symlink" ? lchown : chown)(file, entry.uid, entry.gid);
    if (entry.type !== "symlink") await chmod(file, entry.mode);
  }
}
async function syncSurface(root, entries) {
  for (const [relative, entry] of entries) if (entry.type === "file") {
    const handle = await open(path.join(root, relative), "r");
    try { await handle.sync(); } finally { await handle.close(); }
  }
  for (const [relative, entry] of [...entries].reverse()) if (entry.type === "dir") await syncDirectory(path.join(root, relative));
  await syncDirectory(path.dirname(root));
}
async function stageCandidate(ctx, stage) {
  if ((await readSurface(stage)).exists) fail("PATH", "Stage already exists");
  if (ctx.kind === "runtime") {
    if (ctx.before.exists) await cp(ctx.target, stage, { recursive: true, dereference: false, verbatimSymlinks: true, preserveTimestamps: true, errorOnExist: true, force: false });
    else await mkdir(stage);
    const retiredOwned = ctx.pkg.retired.filter((relative) => ctx.before.entries.has(relative) && !ctx.candidate.entries.has(relative));
    for (const relative of [...ctx.pkg.canonical, ...retiredOwned]) await rm(path.join(stage, relative), { recursive: true, force: true });
    for (const relative of ctx.pkg.canonical) await cp(path.join(ctx.pkg.root, relative), path.join(stage, relative), { recursive: true, dereference: false, preserveTimestamps: true, errorOnExist: true, force: false });
  } else await writeExclusive(stage, ctx.candidate.content);
  await setMetadata(stage, ctx.candidate.entries);
  await syncSurface(stage, ctx.candidate.entries);
}
async function requireDigest(root, digest, label) {
  const actual = await readSurface(root);
  if (actual.digest !== digest) fail("DRIFT", `${label} drift; retain all copies and inspect the receipt`);
  return actual;
}
async function moveToAbsent(source, destination) {
  if ((await readSurface(destination)).exists) fail("DRIFT", `Refusing to replace an occupied recovery/publication path: ${destination}`);
  const stat = await lstat(source);
  if (stat.isFile()) {
    // A hard link fails with EEXIST instead of overwriting a concurrent file.
    await link(source, destination);
    await unlink(source);
  } else await rename(source, destination);
  await syncDirectory(path.dirname(source));
  await syncDirectory(path.dirname(destination));
}
async function acquireLock(value, allowExisting = false) {
  const owner = { id: value.id, target: value.target, receipt: value.receipt, pid: process.pid, nonce: randomUUID() };
  const current = await readSurface(value.lock);
  if (current.exists) {
    if (!allowExisting) fail("LOCKED", `Another operation owns the target lock: ${value.lock}`);
    const previous = await lockOwner(value.lock);
    if (previous.id !== value.id || previous.target !== value.target || previous.receipt !== value.receipt) fail("LOCKED", "Recovery cannot take over another receipt's lock");
    let alive = true;
    try { process.kill(previous.pid, 0); } catch (error) { if (error.code === "ESRCH") alive = false; }
    if (alive) fail("LOCKED", `Operation owner process ${previous.pid} is still alive; recovery cannot run concurrently`);
    // Keep a nonempty tombstone keyed to the observed generation. Competing
    // takeovers of that generation cannot rename a newer lock over it.
    const retired = `${value.lock}.retired-${previous.nonce}`;
    await rename(value.lock, retired);
    if (stable(await lockOwner(retired)) !== stable(previous)) fail("LOCKED", "Retired lock identity drift; retain lock records");
    await syncDirectory(path.dirname(value.lock));
  }
  const prepared = `${value.lock}.prepared-${owner.nonce}`;
  await mkdir(prepared, { mode: 0o700 });
  await writeExclusive(path.join(prepared, "owner.json"), `${stable(owner)}\n`);
  await syncDirectory(prepared);
  try { await moveToAbsent(prepared, value.lock); }
  catch (error) {
    await unlink(path.join(prepared, "owner.json"));
    await rmdir(prepared);
    fail("LOCKED", `Target lock was acquired concurrently: ${error.message}`);
  }
  LOCK_LEASES.set(value, owner);
}
async function lockOwner(root) {
  if (await safePath(root, "operation lock") !== root || !(await lstat(root)).isDirectory()) fail("LOCKED", "Operation lock is not a canonical directory");
  const file = path.join(root, "owner.json");
  if (await safePath(file, "lock owner") !== file || !(await lstat(file)).isFile()) fail("LOCKED", "Operation lock owner record is invalid");
  const owner = JSON.parse(await readFile(file, "utf8"));
  exactKeys(owner, ["id", "target", "receipt", "pid", "nonce"], "lock owner");
  if (!UUID.test(owner.nonce) || !UUID.test(owner.id) || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) fail("LOCKED", "Operation lock identity is invalid");
  return owner;
}
async function releaseLock(value) {
  const owner = LOCK_LEASES.get(value);
  if (!owner || stable(await lockOwner(value.lock)) !== stable(owner)) fail("LOCKED", "Operation lock drift; do not remove it");
  const released = `${value.lock}.released-${owner.nonce}`;
  await rename(value.lock, released);
  if (stable(await lockOwner(released)) !== stable(owner)) fail("LOCKED", "Released lock identity drift; retain lock records");
  await unlink(path.join(released, "owner.json"));
  await rmdir(released);
  await syncDirectory(path.dirname(value.lock));
  LOCK_LEASES.delete(value);
}
async function recoveryState(value) {
  const [live, backup, stage] = await Promise.all([readSurface(value.target), readSurface(value.backup), readSurface(value.stage)]);
  const original = value.capturedDigest ?? value.beforeDigest;
  if (live.digest === original && [ABSENT, original].includes(backup.digest)) return { action: "already-restored", original, live, backup, stage };
  if (original === ABSENT && live.digest === ABSENT && backup.digest === ABSENT) return { action: "already-restored", original, live, backup, stage };
  if (backup.digest !== original) fail("DRIFT", "Recovery backup drift; no surface was changed");
  if (live.digest !== ABSENT && live.digest !== value.candidateDigest) fail("DRIFT", "Recovery live target drift; no surface was changed");
  if (stage.digest !== ABSENT && stage.digest !== value.candidateDigest) fail("DRIFT", "Recovery stage drift; no surface was changed");
  let duplicatePublication = false;
  if (live.exists && stage.exists) {
    const [left, right] = await Promise.all([lstat(value.target), lstat(value.stage)]);
    duplicatePublication = left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino;
    if (!duplicatePublication) fail("DRIFT", "Both live and stage are occupied; preserve both and inspect the receipt");
  }
  return { action: "restore", original, live, backup, stage, duplicatePublication };
}
async function restore(journalEntry) {
  const value = journalEntry.value;
  const state = await recoveryState(value);
  if (state.action === "already-restored") {
    await journalEntry.save("rolled-back");
    return "already-restored";
  }
  await journalEntry.save("rolling-back");
  if (state.live.exists) {
    await requireDigest(value.target, value.candidateDigest, "Live target");
    await requireDigest(value.backup, state.original, "Backup");
    if (state.duplicatePublication) {
      await requireDigest(value.stage, value.candidateDigest, "Retained candidate");
      const [left, right] = await Promise.all([lstat(value.target), lstat(value.stage)]);
      if (!left.isFile() || left.dev !== right.dev || left.ino !== right.ino) fail("DRIFT", "Candidate hard-link identity drift");
      await unlink(value.target);
      await syncDirectory(path.dirname(value.target));
    } else await moveToAbsent(value.target, value.stage);
  }
  await requireDigest(value.target, ABSENT, "Restore destination");
  await requireDigest(value.backup, state.original, "Backup");
  if (state.original !== ABSENT) await moveToAbsent(value.backup, value.target);
  await requireDigest(value.target, state.original, "Restored target");
  await journalEntry.save("rolled-back");
  return "rolled-back";
}
export async function applyOperationPlan(plan, options = {}) {
  const ctx = await rebuild(plan, options);
  if (!options.apply) return { status: "preview", plan };
  if (plan.targetDigest === plan.candidateDigest) return { status: "unchanged", plan };
  const id = randomUUID();
  const backupRoot = await safePath(options.backupRoot ?? path.join(path.dirname(ctx.target), ".catpaw-operations", path.basename(ctx.target)), "backupRoot");
  disjointAuxiliary(backupRoot, ctx.target, ctx.pkg.root, "backupRoot");
  const locations = pathsFor(ctx.target, backupRoot, id);
  const receipt = options.receipt ? await safePath(options.receipt, "receipt") : locations.receipt;
  disjointAuxiliary(receipt, ctx.target, ctx.pkg.root, "receipt");
  if ([locations.stage, locations.backup, locations.lock].some((item) => contains(item, receipt) || contains(receipt, item))) fail("PATH", "Receipt overlaps a transaction surface");
  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(path.dirname(ctx.target))).dev !== (await lstat(backupRoot)).dev) fail("FILESYSTEM", "backupRoot must be on the target filesystem for recoverable rename");
  await mkdir(locations.transaction, { mode: 0o700 });
  await syncDirectory(backupRoot);
  const entry = await journal({ format: RECEIPT_FORMAT, id, kind: ctx.kind, target: ctx.target, packageRoot: ctx.pkg.root, version: plan.version, planId: plan.id,
    beforeDigest: plan.targetDigest, candidateDigest: plan.candidateDigest, capturedDigest: null, backupRoot, backup: locations.backup, stage: locations.stage, receipt,
    lock: locations.lock, phase: "preparing", verification: null, error: null });
  await entry.save("preparing");
  await acquireLock(entry.value);
  let claimed = false;
  try {
    await stageCandidate(ctx, locations.stage);
    await requireDigest(locations.stage, plan.candidateDigest, "Staged candidate");
    if (ctx.kind === "runtime") await verifyRuntime(locations.stage, ctx.pkg);
    await requireDigest(locations.stage, plan.candidateDigest, "Verified staged candidate");
    if ((await inspectPackage(ctx.pkg.root)).snapshot.digest !== plan.packageDigest) fail("DRIFT", "Managed package drift");
    await requireDigest(ctx.target, plan.targetDigest, "Target preimage");
    await entry.save("prepared");
    await options.fault?.("prepared", { ...entry.value });
    await entry.save("claiming");
    await options.fault?.("before-claim", { ...entry.value });
    claimed = true;
    if (ctx.before.exists) {
      await moveToAbsent(ctx.target, locations.backup);
      const captured = await readSurface(locations.backup);
      await entry.save("claimed", { capturedDigest: captured.digest });
      if (captured.digest !== plan.targetDigest) fail("DRIFT", "Target drift in the last claim window; restore the actual captured preimage");
    } else await entry.save("claimed", { capturedDigest: ABSENT });
    await options.fault?.("claimed", { ...entry.value });
    await requireDigest(locations.stage, plan.candidateDigest, "Staged candidate");
    await requireDigest(locations.backup, entry.value.capturedDigest, "Captured preimage");
    await entry.save("publishing");
    await moveToAbsent(locations.stage, ctx.target);
    await entry.save("published");
    await options.fault?.("published", { ...entry.value });
    await requireDigest(ctx.target, plan.candidateDigest, "Published candidate");
    const verification = ctx.kind === "runtime" ? await verifyRuntime(ctx.target, ctx.pkg) : { adapter: "passed" };
    await requireDigest(ctx.target, plan.candidateDigest, "Verified published candidate");
    await requireDigest(locations.backup, entry.value.capturedDigest, "Retained preimage");
    await entry.save("applied", { verification });
    const warnings = [];
    try { await releaseLock(entry.value); } catch (error) { warnings.push(`Published and verified; lock cleanup needs attention: ${error.message}`); }
    return { status: "applied", receipt, backup: locations.backup, verification, planId: plan.id, publication: "guarded-renames-with-recovery-journal", warnings };
  } catch (error) {
    try {
      if (claimed) {
        if (entry.value.capturedDigest === null) {
          const captured = await readSurface(locations.backup);
          if (captured.exists && !(await readSurface(ctx.target)).exists) await entry.save("claimed", { capturedDigest: captured.digest });
        }
        try { await restore(entry); await releaseLock(entry.value); }
        catch (recoveryError) { await entry.save("recovery-required", { error: `${error.message}; recovery: ${recoveryError.message}` }); }
      } else { await entry.save("failed-before-claim", { error: error.message }); await releaseLock(entry.value); }
    } catch (journalError) { error.message += `; journal/recovery: ${journalError.message}`; }
    error.receipt = receipt;
    throw error;
  }
}
export async function readReceipt(input) {
  const receipt = await safePath(input, "receipt");
  const value = JSON.parse(await readFile(receipt, "utf8"));
  exactKeys(value, RECEIPT_KEYS, "receipt");
  const { integrity, ...body } = value;
  if (value.format !== RECEIPT_FORMAT || !UUID.test(value.id) || !["runtime", "adapter"].includes(value.kind) || integrity !== hash(stable(body)) || !DIGEST.test(value.beforeDigest) || !DIGEST.test(value.candidateDigest) || (value.capturedDigest !== null && !DIGEST.test(value.capturedDigest))) fail("RECEIPT", "Invalid receipt declaration or integrity digest");
  for (const key of ["target", "packageRoot", "backupRoot", "backup", "stage", "receipt", "lock"]) if (typeof value[key] !== "string" || await safePath(value[key], key) !== value[key]) fail("RECEIPT", `Receipt path is not canonical: ${key}`);
  if (receipt !== value.receipt || value.target === path.parse(value.target).root) fail("RECEIPT", "Receipt location or target mismatch");
  disjointAuxiliary(value.backupRoot, value.target, value.packageRoot, "backupRoot");
  disjointAuxiliary(value.receipt, value.target, value.packageRoot, "receipt");
  const expected = pathsFor(value.target, value.backupRoot, value.id);
  for (const key of ["backup", "stage", "lock"]) if (value[key] !== expected[key]) fail("RECEIPT", `Unexpected receipt ${key} path`);
  return value;
}
export async function recoverOperation(options) {
  const value = await readReceipt(options.receipt);
  if (await safePath(options.target) !== value.target || (options.kind && options.kind !== value.kind)) fail("TARGET", "Explicit recovery target/kind differs from receipt");
  const state = await recoveryState(value);
  if (!options.apply) return { status: "preview", action: state.action, receipt: value.receipt, target: value.target, backup: value.backup };
  await acquireLock(value, true);
  const text = await readFile(value.receipt, "utf8");
  const { integrity, ...body } = value;
  const entry = await journal(body, text);
  try {
    await options.fault?.("recovering", { ...value });
    const status = await restore(entry);
    await releaseLock(value);
    return { status, receipt: value.receipt, target: value.target, retainedCandidate: value.stage };
  } catch (error) {
    try { await entry.save("recovery-required", { error: error.message }); } catch { /* Preserve a concurrently changed receipt. */ }
    error.receipt = value.receipt;
    throw error;
  }
}

export async function runOperationCommand(kind, options) {
  try {
    let report;
    if (["inspect", "plan"].includes(options.command)) {
      const plan = await createOperationPlan({ ...options, kind });
      report = { status: "preview", plan };
      if (options.command === "plan" && options.apply) report = { status: "planned", plan, planFile: await writeOperationPlan(plan, options.out) };
    } else if (options.command === "apply") report = await applyOperationPlan(await readOperationPlan(options.planFile), { ...options, kind });
    else if (options.command === "recover") report = await recoverOperation({ ...options, kind });
    else fail("COMMAND", `Unknown ${kind} command: ${options.command}`);
    return { exitCode: 0, report: { command: `${kind} ${options.command}`, ...report } };
  } catch (error) {
    const code = (typeof error.code === "string" ? error.code : "ERR_OPERATION_FAILED").replace(/^ERR_OPERATION_/, `ERR_${kind.toUpperCase()}_`);
    return { exitCode: 1, report: { command: `${kind} ${options.command}`, status: "blocked", error: { code, message: error.message }, ...(error.receipt ? { receipt: error.receipt } : {}) } };
  }
}
