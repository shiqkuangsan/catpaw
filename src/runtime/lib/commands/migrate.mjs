import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyPatchPlan } from "../atomic-write.mjs";
import { loadBoard, pathKind, SCHEMA_2_LAYOUT } from "../board.mjs";
import { collectBoardFindings } from "../findings.mjs";
import { buildArtifactGraph } from "../graph.mjs";
import { analyzeV1ToV2Migration } from "../migrate-v1-v2.mjs";
import { createPatchPlan, renderPatchPlan, snapshotTree } from "../patch-plan.mjs";

const LEGACY_ARCHIVE_ROOT = "legacy/schema-1";
const LEGACY_MANIFEST_PATH = `${LEGACY_ARCHIVE_ROOT}/manifest.json`;

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

async function schema2Errors(projectRoot, boardPath) {
  const board = await loadBoard({ projectRoot, boardPath });
  const graph = buildArtifactGraph(board);
  const findings = collectBoardFindings(board, graph);
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    if (await pathKind(path.join(boardPath, directory)) !== "directory") {
      findings.push({
        severity: "error",
        code: "missing-board-directory",
        path: directory,
        message: `Schema 2 board directory ${directory}/ is missing.`,
      });
    }
  }
  return findings.filter((item) => item.severity === "error");
}

function archiveFinding(code, artifactPath, message) {
  return {
    severity: "error",
    code,
    path: artifactPath,
    filePath: artifactPath,
    message,
  };
}

function validMode(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0o7777;
}

function canonicalArchivePath(value) {
  return typeof value === "string" &&
    value !== LEGACY_MANIFEST_PATH &&
    !path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    value.startsWith(`${LEGACY_ARCHIVE_ROOT}/`) &&
    !value.endsWith("/");
}

async function archiveFilesystemEntries(stageRoot, errors) {
  const entries = new Set();
  const root = path.join(stageRoot, LEGACY_ARCHIVE_ROOT);

  async function visit(absoluteDirectory, relativeDirectory) {
    let names;
    try {
      names = await readdir(absoluteDirectory);
    } catch (error) {
      errors.push(archiveFinding(
        "missing-legacy-archive",
        relativeDirectory,
        `Could not read legacy archive directory: ${error.message}`,
      ));
      return;
    }
    names.sort((left, right) => left.localeCompare(right, "en"));
    for (const name of names) {
      const absolute = path.join(absoluteDirectory, name);
      const relative = path.posix.join(relativeDirectory, name);
      const stats = await lstat(absolute);
      if (stats.isDirectory()) {
        await visit(absolute, relative);
      } else if (stats.isFile()) {
        entries.add(relative);
      } else {
        errors.push(archiveFinding(
          "unsafe-legacy-archive-entry",
          relative,
          "Legacy archive may contain only regular files and directories.",
        ));
      }
    }
  }

  await visit(root, LEGACY_ARCHIVE_ROOT);
  return entries;
}

async function legacyArchiveErrors(stageRoot, expectedLegacy) {
  const errors = [];
  const manifestPath = path.join(stageRoot, LEGACY_MANIFEST_PATH);
  let manifest;
  try {
    const stats = await lstat(manifestPath);
    if (!stats.isFile()) {
      return [archiveFinding(
        "invalid-legacy-manifest",
        LEGACY_MANIFEST_PATH,
        "Legacy manifest is not a regular file.",
      )];
    }
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    return [archiveFinding(
      "invalid-legacy-manifest",
      LEGACY_MANIFEST_PATH,
      `Could not read legacy manifest: ${error.message}`,
    )];
  }

  if (
    manifest?.format !== 1 ||
    manifest?.schema !== 1 ||
    manifest?.root !== LEGACY_ARCHIVE_ROOT ||
    !Array.isArray(manifest?.entries)
  ) {
    return [archiveFinding(
      "invalid-legacy-manifest",
      LEGACY_MANIFEST_PATH,
      "Legacy manifest must declare format 1, schema 1, its canonical root, and entries.",
    )];
  }
  if (
    Array.isArray(expectedLegacy) &&
    JSON.stringify(manifest.entries) !== JSON.stringify(expectedLegacy)
  ) {
    errors.push(archiveFinding(
      "legacy-manifest-report-mismatch",
      LEGACY_MANIFEST_PATH,
      "Legacy manifest entries differ from the analyzed preservation report.",
    ));
  }

  const destinations = new Set();
  for (const entry of manifest.entries) {
    if (!entry || typeof entry !== "object" || !canonicalArchivePath(entry.to)) {
      errors.push(archiveFinding(
        "invalid-legacy-manifest-entry",
        LEGACY_MANIFEST_PATH,
        "Legacy manifest contains a non-canonical archive destination.",
      ));
      continue;
    }
    if (destinations.has(entry.to)) {
      errors.push(archiveFinding(
        "duplicate-legacy-archive-entry",
        entry.to,
        "Legacy manifest contains a duplicate archive destination.",
      ));
      continue;
    }
    destinations.add(entry.to);
    if (
      typeof entry.from !== "string" ||
      !Number.isInteger(entry.bytes) || entry.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? "") ||
      !validMode(entry.mode) ||
      (entry.sourceType !== undefined && entry.sourceType !== "symlink") ||
      (entry.sourceType === "symlink" &&
        (typeof entry.linkTarget !== "string" || !validMode(entry.sourceMode)))
    ) {
      errors.push(archiveFinding(
        "invalid-legacy-manifest-entry",
        entry.to,
        "Legacy manifest entry metadata is invalid.",
      ));
      continue;
    }

    const absolute = path.join(stageRoot, ...entry.to.split("/"));
    let stats;
    let bytes;
    try {
      stats = await lstat(absolute);
      if (!stats.isFile()) throw new Error("archive destination is not a regular file");
      bytes = await readFile(absolute);
    } catch (error) {
      errors.push(archiveFinding(
        "missing-legacy-archive-entry",
        entry.to,
        `Could not read archived legacy entry: ${error.message}`,
      ));
      continue;
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (
      bytes.length !== entry.bytes ||
      digest !== entry.sha256 ||
      (stats.mode & 0o7777) !== entry.mode ||
      (entry.sourceType === "symlink" && !bytes.equals(Buffer.from(entry.linkTarget)))
    ) {
      errors.push(archiveFinding(
        "legacy-archive-digest-mismatch",
        entry.to,
        "Archived legacy bytes, digest, mode, or symlink target differ from the manifest.",
      ));
    }
  }

  const actualFiles = await archiveFilesystemEntries(stageRoot, errors);
  actualFiles.delete(LEGACY_MANIFEST_PATH);
  for (const destination of destinations) {
    if (!actualFiles.has(destination)) {
      errors.push(archiveFinding(
        "missing-legacy-archive-entry",
        destination,
        "Manifest destination is absent from the legacy archive.",
      ));
    }
  }
  for (const actual of actualFiles) {
    if (!destinations.has(actual)) {
      errors.push(archiveFinding(
        "unlisted-legacy-archive-entry",
        actual,
        "Legacy archive file is not listed in the manifest.",
      ));
    }
  }
  return errors.sort((left, right) =>
    `${left.path}\0${left.code}\0${left.message}`.localeCompare(
      `${right.path}\0${right.code}\0${right.message}`,
      "en",
    )
  );
}

export async function validateMigratedStage(projectRoot, stageRoot, expectedLegacy = null) {
  const errors = [
    ...await schema2Errors(projectRoot, stageRoot),
    ...await legacyArchiveErrors(stageRoot, expectedLegacy),
  ];
  const board = await loadBoard({ projectRoot, boardPath: stageRoot });
  if (board.schema !== 2 || errors.length > 0) {
    throw migrationError(
      "ERR_BOARD_MIGRATION_STAGED_VALIDATION",
      "Staged migration failed schema 2 or legacy archive validation.",
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
    preservedLegacy: migration.preservedLegacy,
    preservedUnknown: migration.preservedUnknown,
    linkRewrites: migration.linkRewrites,
  };
}

export async function runMigrationCommand(options, {
  analyzeMigration = analyzeV1ToV2Migration,
  createPlan = createPatchPlan,
  applyPlan = applyPatchPlan,
} = {}) {
  const mode = options.apply ? "apply" : "dry-run";
  const analysisPreimage = await snapshotTree(options.boardPath);
  const migration = await analyzeMigration(options);
  const base = reportBase(options, migration, mode);

  if (migration.status === "noop") {
    const errors = await schema2Errors(options.projectRoot, options.boardPath);
    if (errors.length > 0) {
      return {
        exitCode: 1,
        report: {
          ...base,
          status: "blocked",
          blockers: errors.map((item) => ({
            code: item.code,
            path: item.filePath,
            message: item.message,
          })),
          patch: null,
          backupPath: null,
          applyWarnings: [],
          nextAction: "Run board doctor and resolve schema 2 errors.",
        },
      };
    }
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

  const plan = await createPlan({
    root: options.boardPath,
    operations: migration.operations,
    expectedRootDigest: analysisPreimage.digest,
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

  const result = await applyPlan(plan, {
    backupPath: plan.status === "ready"
      ? migrationBackupPath({ projectRoot: options.projectRoot })
      : undefined,
    validate: ({ stageRoot }) =>
      validateMigratedStage(options.projectRoot, stageRoot, migration.preservedLegacy),
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
