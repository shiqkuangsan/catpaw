import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  assertPatchPlan,
  resolvePhysicalPath,
  snapshotTree,
} from "./patch-plan.mjs";

const COPY_OPTIONS = {
  recursive: true,
  dereference: false,
  errorOnExist: true,
  force: false,
  preserveTimestamps: true,
  verbatimSymlinks: true,
};

function patchError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function assertFresh(plan) {
  await assertTreeDigest(
    plan.root,
    plan.rootDigest,
    "Patch plan is stale because the live root has changed.",
  );
}

async function normalizeBackupPath(backupPath, root) {
  if (backupPath === undefined) return null;
  if (typeof backupPath !== "string" || backupPath.length === 0) {
    throw new TypeError("backupPath must be a non-empty path string.");
  }

  const canonicalBackupPath = path.resolve(backupPath);
  const [physicalRoot, physicalBackupPath] = await Promise.all([
    resolvePhysicalPath(root),
    resolvePhysicalPath(canonicalBackupPath),
  ]);
  const relative = path.relative(physicalRoot, physicalBackupPath);
  const isInsideRoot = relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
  if (isInsideRoot) {
    throw patchError(
      "ERR_PATCH_BACKUP_INSIDE_ROOT",
      "backupPath must not be inside the patch root.",
    );
  }
  return canonicalBackupPath;
}

async function assertBackupAbsent(backupPath) {
  if (backupPath && await pathExists(backupPath)) {
    throw patchError(
      "ERR_PATCH_BACKUP_EXISTS",
      `backupPath already exists: ${backupPath}`,
    );
  }
}

async function assertTreeDigest(root, expectedDigest, message) {
  if ((await snapshotTree(root)).digest !== expectedDigest) {
    throw patchError("ERR_PATCH_PLAN_STALE", message);
  }
}

async function validateStage(stageRoot, validate) {
  const beforeDigest = (await snapshotTree(stageRoot)).digest;
  if (!validate) return beforeDigest;
  await validate({ stageRoot });
  const afterDigest = (await snapshotTree(stageRoot)).digest;
  if (afterDigest !== beforeDigest) {
    throw patchError(
      "ERR_PATCH_VALIDATION_MUTATION",
      "Validator mutated the staged postimage.",
    );
  }
  return afterDigest;
}

async function prepareBackup(sourceRoot, backupPath, expectedDigest) {
  await assertBackupAbsent(backupPath);
  await mkdir(path.dirname(backupPath), { recursive: true });
  const temporaryPath = await mkdtemp(
    path.join(path.dirname(backupPath), `.${path.basename(backupPath)}.catpaw-backup-`),
  );

  try {
    await rmdir(temporaryPath);
    await cp(sourceRoot, temporaryPath, COPY_OPTIONS);
    await assertTreeDigest(
      temporaryPath,
      expectedDigest,
      "Backup preimage changed while it was being copied.",
    );
    await assertBackupAbsent(backupPath);
    return temporaryPath;
  } catch (error) {
    try {
      await rm(temporaryPath, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Backup preparation failed and its temporary path could not be removed.",
        { cause: error },
      );
    }
    throw error;
  }
}

function targetPath(stageRoot, relativePath) {
  return path.join(stageRoot, ...relativePath.split("/"));
}

async function replaceFile(target, content) {
  const handle = await open(target, "r+");
  try {
    await handle.truncate(0);
    await handle.writeFile(content);
  } finally {
    await handle.close();
  }
}

async function applyOperations(stageRoot, operations) {
  for (const operation of operations) {
    switch (operation.type) {
      case "ensure-dir":
        await mkdir(targetPath(stageRoot, operation.path), { recursive: true });
        if (operation.dirMode !== undefined) {
          await chmod(targetPath(stageRoot, operation.path), operation.dirMode);
        }
        break;
      case "write-file": {
        const target = targetPath(stageRoot, operation.path);
        if (operation.mode === "create") {
          await writeFile(target, operation.content, {
            flag: "wx",
            ...(operation.fileMode === undefined ? {} : { mode: operation.fileMode }),
          });
        } else {
          await replaceFile(target, operation.content);
        }
        if (operation.fileMode !== undefined) {
          await chmod(target, operation.fileMode);
        }
        break;
      }
      case "move-file":
        await rename(
          targetPath(stageRoot, operation.from),
          targetPath(stageRoot, operation.to),
        );
        break;
      case "remove-file":
        await unlink(targetPath(stageRoot, operation.path));
        break;
      case "remove-symlink":
        await unlink(targetPath(stageRoot, operation.path));
        break;
      case "remove-dir":
        await rmdir(targetPath(stageRoot, operation.path));
        break;
    }
  }
}

async function restoreRollback(root, rollbackRoot, transactionError) {
  try {
    await rename(rollbackRoot, root);
  } catch (restoreError) {
    throw new AggregateError(
      [transactionError, restoreError],
      "Patch transaction failed and the live root rollback could not be restored.",
      { cause: transactionError },
    );
  }
}

function attachBackupPath(error, backupPath) {
  if (backupPath && error && typeof error === "object") error.backupPath = backupPath;
  return error;
}

function cleanupWarning(code, cleanupPath, error) {
  return { code, path: cleanupPath, message: error.message };
}

export async function applyPatchPlan(plan, { validate, backupPath } = {}) {
  assertPatchPlan(plan);
  if (plan.status === "blocked") {
    throw patchError("ERR_PATCH_PLAN_BLOCKED", "Cannot apply a blocked patch plan.");
  }
  await assertFresh(plan);
  if (plan.status === "noop") {
    return { status: "noop", backupPath: null, warnings: [] };
  }

  if (validate !== undefined && typeof validate !== "function") {
    throw new TypeError("validate must be a function.");
  }
  const canonicalBackupPath = await normalizeBackupPath(backupPath, plan.root);
  await assertBackupAbsent(canonicalBackupPath);

  const rootExisted = plan.rootDigest !== "absent-root";
  const stageRoot = await mkdtemp(
    path.join(path.dirname(plan.root), `.${path.basename(plan.root)}.catpaw-stage-`),
  );
  const rollbackRoot = `${stageRoot}.rollback`;
  const warnings = [];
  let backupTemporaryPath = null;
  let publishedBackupPath = null;
  let rollbackClaimed = false;
  let stagePublished = false;
  let failure = null;

  try {
    await rmdir(stageRoot);
    if (rootExisted) {
      await cp(plan.root, stageRoot, COPY_OPTIONS);
      await assertTreeDigest(
        stageRoot,
        plan.rootDigest,
        "Patch plan is stale because the staged preimage differs from the planned root.",
      );
    } else {
      await mkdir(stageRoot);
    }
    await applyOperations(stageRoot, plan.operations);
    const validatedStageDigest = await validateStage(stageRoot, validate);

    if (!rootExisted) {
      await assertFresh(plan);
      await assertTreeDigest(
        stageRoot,
        validatedStageDigest,
        "Staged postimage changed after validation.",
      );
      await rename(stageRoot, plan.root);
      stagePublished = true;
    } else {
      try {
        await rename(plan.root, rollbackRoot);
        rollbackClaimed = true;
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw patchError(
            "ERR_PATCH_PLAN_STALE",
            "Patch plan is stale because the live root disappeared before claim.",
            error,
          );
        }
        throw error;
      }

      // Pathname races are closed by the claim; already-open file descriptors remain unavoidable.
      await assertTreeDigest(
        rollbackRoot,
        plan.rootDigest,
        "Patch plan is stale because the claimed preimage has changed.",
      );

      if (canonicalBackupPath) {
        backupTemporaryPath = await prepareBackup(
          rollbackRoot,
          canonicalBackupPath,
          plan.rootDigest,
        );
        await assertTreeDigest(
          rollbackRoot,
          plan.rootDigest,
          "Patch plan is stale because the claimed preimage changed during backup.",
        );
        await rename(backupTemporaryPath, canonicalBackupPath);
        backupTemporaryPath = null;
        publishedBackupPath = canonicalBackupPath;
      }

      await assertTreeDigest(
        stageRoot,
        validatedStageDigest,
        "Staged postimage changed after validation.",
      );
      try {
        await rename(stageRoot, plan.root);
        stagePublished = true;
      } catch (commitError) {
        throw patchError(
          "ERR_PATCH_COMMIT",
          "Patch commit failed before the staged root was published.",
          commitError,
        );
      }

      try {
        await rm(rollbackRoot, { recursive: true, force: true });
        rollbackClaimed = false;
      } catch (cleanupError) {
        warnings.push(
          cleanupWarning("rollback-cleanup-failed", rollbackRoot, cleanupError),
        );
      }
    }
  } catch (error) {
    if (rollbackClaimed && !stagePublished) {
      try {
        await restoreRollback(plan.root, rollbackRoot, error);
        rollbackClaimed = false;
      } catch (restoreError) {
        error = restoreError;
      }
    }
    failure = attachBackupPath(error, publishedBackupPath);
  }

  if (backupTemporaryPath) {
    try {
      await rm(backupTemporaryPath, { recursive: true, force: true });
    } catch (cleanupError) {
      if (failure) failure.cleanupError = cleanupError;
      else failure = cleanupError;
    }
  }

  try {
    await rm(stageRoot, { recursive: true, force: true });
  } catch (cleanupError) {
    if (stagePublished) {
      warnings.push(cleanupWarning("stage-cleanup-failed", stageRoot, cleanupError));
    } else if (failure) {
      failure.cleanupError = cleanupError;
    } else {
      failure = cleanupError;
    }
  }

  if (failure) throw failure;
  return { status: "applied", backupPath: publishedBackupPath, warnings };
}
