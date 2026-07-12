import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { applyPatchPlan } from "../atomic-write.mjs";
import { loadBoard, pathKind, SCHEMA_2_LAYOUT } from "../board.mjs";
import { collectBoardFindings } from "../findings.mjs";
import { buildArtifactGraph } from "../graph.mjs";
import { analyzeV1ToV2Migration } from "../migrate-v1-v2.mjs";
import { createPatchPlan, renderPatchPlan } from "../patch-plan.mjs";

function migrationError(code, message, findings = []) {
  const error = new Error(message);
  error.code = code;
  error.findings = findings;
  return error;
}

function patchReport(plan) {
  return {
    status: plan.status,
    operationCount: plan.operations.length,
    blockers: plan.blockers,
    text: renderPatchPlan(plan),
  };
}

function safeProjectLabel(projectRoot) {
  const label = path.basename(projectRoot)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
  const digest = createHash("sha256")
    .update(path.resolve(projectRoot))
    .digest("hex")
    .slice(0, 12);
  return `${label}-${digest}`;
}

function utcTimestamp(now) {
  return now.toISOString().replace(/[-:.]/g, "");
}

export function migrationBackupPath({
  projectRoot,
  catpawHome = process.env.CATPAW_HOME || path.join(os.homedir(), ".catpaw"),
  now = new Date(),
}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  return path.join(
    path.resolve(catpawHome),
    "backups",
    safeProjectLabel(projectRoot),
    utcTimestamp(now),
  );
}

async function validateMigratedStage(projectRoot, stageRoot) {
  const board = await loadBoard({ projectRoot, boardPath: stageRoot });
  const graph = buildArtifactGraph(board);
  const findings = collectBoardFindings(board, graph);
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    if (await pathKind(path.join(stageRoot, directory)) !== "directory") {
      findings.push({
        severity: "error",
        code: "missing-board-directory",
        path: directory,
        message: `Schema 2 board directory ${directory}/ is missing.`,
      });
    }
  }
  const errors = findings.filter((item) => item.severity === "error");
  if (board.schema !== 2 || errors.length > 0) {
    throw migrationError(
      "ERR_BOARD_MIGRATION_STAGED_VALIDATION",
      "Staged migration failed schema 2 graph validation.",
      errors,
    );
  }
}

function reportBase(options, migration, mode) {
  return {
    command: "board migrate",
    projectRoot: options.projectRoot,
    boardPath: options.boardPath,
    mode,
    fromSchema: migration.fromSchema,
    toSchema: migration.toSchema,
    mappings: migration.mappings,
    blockers: migration.blockers,
    warnings: migration.warnings,
    preservedUnknown: migration.preservedUnknown,
    linkRewrites: migration.linkRewrites,
  };
}

export async function runMigrationCommand(options) {
  const mode = options.apply ? "apply" : "dry-run";
  const migration = await analyzeV1ToV2Migration(options);
  const base = reportBase(options, migration, mode);

  if (migration.status === "noop") {
    return {
      exitCode: 0,
      report: {
        ...base,
        status: "noop",
        patch: null,
        backupPath: null,
        applyWarnings: [],
        nextAction: "Board already uses schema 2.",
      },
    };
  }
  if (migration.status === "blocked") {
    return {
      exitCode: 1,
      report: {
        ...base,
        status: "blocked",
        patch: null,
        backupPath: null,
        applyWarnings: [],
        nextAction: "Resolve the migration blockers.",
      },
    };
  }

  const plan = await createPatchPlan({
    root: options.boardPath,
    operations: migration.operations,
  });
  const patch = patchReport(plan);
  if (plan.status === "blocked") {
    return {
      exitCode: 1,
      report: {
        ...base,
        status: "blocked",
        patch,
        backupPath: null,
        applyWarnings: [],
        nextAction: "Resolve the patch blockers.",
      },
    };
  }

  if (!options.apply) {
    return {
      exitCode: 0,
      report: {
        ...base,
        status: plan.status === "noop" ? "noop" : "preview",
        patch,
        backupPath: null,
        applyWarnings: [],
        nextAction: plan.status === "noop"
          ? "No migration changes are required."
          : "Run board migrate --apply to migrate the board.",
      },
    };
  }

  const result = await applyPatchPlan(plan, {
    backupPath: plan.status === "ready"
      ? migrationBackupPath({ projectRoot: options.projectRoot })
      : undefined,
    validate: ({ stageRoot }) =>
      validateMigratedStage(options.projectRoot, stageRoot),
  });
  return {
    exitCode: 0,
    report: {
      ...base,
      status: result.status,
      patch,
      backupPath: result.backupPath,
      applyWarnings: result.warnings,
      nextAction: result.status === "noop"
        ? "No migration changes are required."
        : "Run board doctor to inspect the migrated board.",
    },
  };
}
