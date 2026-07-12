import path from "node:path";

import { applyPatchPlan } from "../atomic-write.mjs";
import {
  loadBoard,
  pathExists,
  pathKind,
  projectRelative,
  SCHEMA_2_LAYOUT,
} from "../board.mjs";
import { collectBoardFindings, finding } from "../findings.mjs";
import { stringifyFrontmatter } from "../frontmatter.mjs";
import { buildArtifactGraph } from "../graph.mjs";
import {
  createPatchPlan,
  renderPatchPlan,
} from "../patch-plan.mjs";
import { loadBoardSchema } from "../schema.mjs";
import { runMigrationCommand } from "./migrate.mjs";
import { rebuildDashboard } from "./workflow.mjs";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const EVIDENCE_TYPES = loadBoardSchema().artifacts.evidence.properties.type.enum;

function initOperations() {
  return [
    ...SCHEMA_2_LAYOUT.requiredDirectories.map((directory) => ({
      type: "ensure-dir",
      path: directory,
    })),
    {
      type: "write-file",
      path: "index.md",
      content: rebuildDashboard(
        `${stringifyFrontmatter({ schema: 2 }, ["schema"])}\n# CatPaw Board\n`,
        { milestones: [], workItems: [], plans: [] },
      ),
      mode: "create",
    },
  ];
}

function patchReport(plan) {
  return {
    status: plan.status,
    operationCount: plan.operations.length,
    text: renderPatchPlan(plan),
  };
}

function boardError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function validateInitializedBoard(projectRoot, stageRoot) {
  const board = await loadBoard({ projectRoot, boardPath: stageRoot });
  const graph = buildArtifactGraph(board);
  const findings = collectBoardFindings(board, graph);
  const invalidLayout = await layoutFindings(board);

  if (
    board.schema !== 2 ||
    findings.some((finding) => finding.severity === "error") ||
    invalidLayout.length > 0
  ) {
    throw boardError(
      "ERR_BOARD_INIT_STAGED_VALIDATION",
      "Staged board failed schema 2 validation.",
    );
  }
}

function inspectBoard(options) {
  return loadBoard({
    projectRoot: options.projectRoot,
    boardPath: options.boardPath,
  }).then((board) => {
    const graph = buildArtifactGraph(board);
    return { board, graph, findings: collectBoardFindings(board, graph) };
  });
}

function boardCounts(board) {
  const activeWorkItems = board.workItems.filter((item) => !item.terminal);
  const activeWorkIds = new Set(activeWorkItems.map((item) => item.id));
  const activePlans = board.schema === 1
    ? board.activePlans
    : board.plans.filter((plan) => activeWorkIds.has(plan.work));
  const evidence = Object.fromEntries(EVIDENCE_TYPES.map((type) => [type, 0]));
  for (const item of board.evidence) {
    const type = item.type ?? item.kind;
    if (Object.hasOwn(evidence, type)) evidence[type] += 1;
  }

  return {
    active: {
      milestones: board.milestones.filter(
        (milestone) => !TERMINAL_STATUSES.has(milestone.status),
      ).length,
      work: activeWorkItems.length,
      plans: activePlans.length,
    },
    evidence,
  };
}

function nextStatusAction(counts, findings, migrationRequired) {
  if (findings.some((finding) => finding.severity === "error")) {
    return "Run board doctor.";
  }
  if (migrationRequired) return "Run board migrate.";
  if (counts.active.milestones > 0) return "Continue active milestone work.";
  if (counts.active.work > 0 || counts.active.plans > 0) {
    return "Continue active work.";
  }
  return "No active work.";
}

async function runInit(options) {
  const existing = await inspectBoard(options);
  if (existing.board.schema === 1) {
    return {
      exitCode: 0,
      report: {
        command: "board init",
        projectRoot: options.projectRoot,
        boardPath: options.boardPath,
        schema: 1,
        mode: "read-only",
        status: "migration-required",
        migrationRequired: true,
        patch: null,
        nextAction: "Run board migrate.",
      },
    };
  }
  const boardExists = await pathExists(options.boardPath);
  const existingLayout = await layoutFindings(existing.board);
  const existingFindings = [...existing.findings, ...existingLayout];
  const existingErrors = existingFindings.some(
    (item) => item.severity === "error",
  );
  if (
    boardExists &&
    (existing.board.schema !== 2 || existingErrors)
  ) {
    return {
      exitCode: 1,
      report: {
        command: "board init",
        projectRoot: options.projectRoot,
        boardPath: options.boardPath,
        schema: existing.board.schema,
        mode: "read-only",
        status: "invalid-board",
        findings: existingFindings,
        migrationRequired: false,
        patch: null,
        nextAction: "Resolve the existing board errors.",
      },
    };
  }

  let operations = initOperations();
  if (boardExists && existing.board.schema === 2) {
    operations = existingLayout
      .filter((item) => item.code === "missing-board-directory")
      .map((item) => ({
        type: "ensure-dir",
        path: item.directory,
      }));
  }
  const plan = await createPatchPlan({
    root: options.boardPath,
    operations,
  });
  if (plan.status === "blocked") {
    return {
      exitCode: 1,
      report: {
        command: "board init",
        projectRoot: options.projectRoot,
        boardPath: options.boardPath,
        schema: 2,
        mode: options.apply ? "apply" : "dry-run",
        status: "blocked",
        migrationRequired: false,
        patch: patchReport(plan),
        nextAction: "Resolve the patch blockers.",
      },
    };
  }
  let applyResult = null;
  if (options.apply) {
    applyResult = await applyPatchPlan(plan, {
      validate: ({ stageRoot }) => validateInitializedBoard(options.projectRoot, stageRoot),
    });
  }

  return {
    exitCode: 0,
    report: {
      command: "board init",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      mode: options.apply ? "apply" : "dry-run",
      status: applyResult?.status ?? "preview",
      migrationRequired: false,
      patch: patchReport(plan),
      ...(applyResult
        ? { warnings: applyResult.warnings, backupPath: applyResult.backupPath }
        : {}),
      nextAction: plan.status === "noop"
        ? "Board already initialized."
        : options.apply
          ? "Board is ready."
          : "Run board init --apply to create the board.",
    },
  };
}

async function runStatus(options) {
  const { board, findings: sharedFindings } = await inspectBoard(options);
  const findings = [
    ...sharedFindings,
    ...(await layoutFindings(board)).filter((item) => item.severity === "error"),
  ];
  const counts = boardCounts(board);
  const migrationRequired = board.schema === 1;
  const hasErrors = findings.some((finding) => finding.severity === "error");
  const readableSchema1 = board.schema === 1 && !board.index.parseError;

  return {
    exitCode: readableSchema1 || (board.schema === 2 && !hasErrors) ? 0 : 1,
    report: {
      command: "board status",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: board.schema,
      counts,
      findings,
      migrationRequired,
      nextAction: nextStatusAction(counts, findings, migrationRequired),
    },
  };
}

async function layoutFindings(board) {
  if (board.schema !== 2) return [];
  const findings = [];
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    const target = path.join(board.boardPath, directory);
    const kind = await pathKind(target);
    if (kind === "directory") continue;
    if (kind === "missing") {
      findings.push(
        finding(
          "warning",
          "missing-board-directory",
          "global",
          "layout",
          projectRelative(board.projectRoot, target),
          `Schema 2 board directory ${directory}/ is missing.`,
          `Run board doctor --fix --apply to create ${directory}/.`,
          { directory, actualType: "missing", fixable: true },
        ),
      );
      continue;
    }
    findings.push(
      finding(
        "error",
        "invalid-board-directory",
        "global",
        "layout",
        projectRelative(board.projectRoot, target),
        `Schema 2 board path ${directory}/ must be a directory; found ${kind}.`,
        "Move or remove the conflicting entry manually; board doctor will not replace it.",
        { directory, actualType: kind, fixable: false },
      ),
    );
  }
  return findings;
}

async function validateDoctorStage(projectRoot, stageRoot, repairedDirectories) {
  const inspected = await inspectBoard({
    projectRoot,
    boardPath: stageRoot,
  });
  const malformed = inspected.findings.some(
    (item) => item.code === "frontmatter-parse" ||
      item.code === "missing-index" ||
      item.code.startsWith("schema-"),
  );
  let invalidRepair = false;
  for (const directory of repairedDirectories) {
    if (await pathKind(path.join(stageRoot, directory)) !== "directory") {
      invalidRepair = true;
      break;
    }
  }
  if (
    inspected.board.schema !== 2 ||
    malformed ||
    invalidRepair
  ) {
    throw boardError(
      "ERR_BOARD_DOCTOR_STAGED_VALIDATION",
      "Staged board failed schema 2 layout validation.",
    );
  }
}

function nextDoctorAction(findings, migrationRequired, fix, mode) {
  if (migrationRequired) return "Run board migrate.";
  if (fix?.status === "blocked") return "Resolve the patch blockers.";
  if (findings.some((item) => item.severity === "error")) {
    return "Resolve the reported errors.";
  }
  if (fix?.status === "preview" && mode === "dry-run") {
    return "Run board doctor --fix --apply to create missing directories.";
  }
  if (findings.some((item) => item.code === "missing-board-directory")) {
    return "Run board doctor --fix to preview layout repairs.";
  }
  return "No action required.";
}

async function runDoctor(options) {
  let inspected = await inspectBoard(options);
  let findings = [
    ...inspected.findings,
    ...(await layoutFindings(inspected.board)),
  ];
  const migrationRequired = inspected.board.schema === 1;
  if (options.fix && migrationRequired) {
    const fix = {
      status: "refused",
      reason: "Schema 1 boards require migration.",
    };
    return {
      exitCode: 1,
      report: {
        command: "board doctor",
        projectRoot: options.projectRoot,
        boardPath: options.boardPath,
        schema: 1,
        mode: "read-only",
        findings,
        migrationRequired: true,
        fix,
        nextAction: "Run board migrate.",
      },
    };
  }
  const mode = options.fix ? (options.apply ? "apply" : "dry-run") : "read-only";
  let fix = null;
  if (options.fix && inspected.board.schema === 2) {
    const directories = findings
      .filter((item) => item.code === "missing-board-directory")
      .map((item) => item.directory);
    const plan = await createPatchPlan({
      root: options.boardPath,
      operations: directories.map((directory) => ({
        type: "ensure-dir",
        path: directory,
      })),
    });
    let fixStatus = plan.status === "blocked"
      ? "blocked"
      : plan.status === "noop"
        ? "noop"
        : "preview";
    let applyResult = null;
    if (options.apply && plan.status !== "blocked") {
      applyResult = await applyPatchPlan(plan, {
        validate: ({ stageRoot }) =>
          validateDoctorStage(options.projectRoot, stageRoot, directories),
      });
      fixStatus = applyResult.status;
      inspected = await inspectBoard(options);
      findings = [
        ...inspected.findings,
        ...(await layoutFindings(inspected.board)),
      ];
    }
    fix = {
      status: fixStatus,
      patch: patchReport(plan),
      ...(applyResult
        ? { warnings: applyResult.warnings, backupPath: applyResult.backupPath }
        : {}),
    };
  }

  return {
    exitCode: fix?.status === "blocked" ||
        findings.some((item) => item.severity === "error")
      ? 1
      : 0,
    report: {
      command: "board doctor",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: inspected.board.schema,
      mode,
      findings,
      migrationRequired,
      fix,
      nextAction: nextDoctorAction(findings, migrationRequired, fix, mode),
    },
  };
}

export async function runBoardCommand(options) {
  if (options.command === "init") return runInit(options);
  if (options.command === "status") return runStatus(options);
  if (options.command === "doctor") return runDoctor(options);
  if (options.command === "migrate") return runMigrationCommand(options);
  throw new TypeError(`Unsupported board command: ${options.command}`);
}

function renderFindingLines(findings) {
  return findings.map(
    (item) =>
      `- ${(item.severity ?? "error").toUpperCase()} ${item.code} [${item.filePath ?? item.path ?? "."}] ${item.message}`,
  );
}

function appendApplyDiagnostics(lines, result) {
  if (result?.backupPath) lines.push(`Backup: ${result.backupPath}`);
  if (!result?.warnings?.length) return;
  lines.push(
    `Warnings: ${result.warnings.length}`,
    ...result.warnings.map(
      (warning) => `- ${warning.code} [${warning.path}] ${warning.message}`,
    ),
  );
}

export function renderBoardReport(report) {
  if (report.command === "board init") {
    const lines = [
      "Board init",
      `Schema: ${report.schema ?? "unknown"}`,
      `Mode: ${report.mode}`,
      `Status: ${report.status}`,
      `Migration required: ${report.migrationRequired ? "yes" : "no"}`,
    ];
    if (report.findings) {
      lines.push(
        `Findings: ${report.findings.length}`,
        ...renderFindingLines(report.findings),
      );
    }
    if (report.patch) lines.push("Patch:", report.patch.text.trimEnd());
    appendApplyDiagnostics(lines, report);
    lines.push(`Next: ${report.nextAction}`, "");
    return lines.join("\n");
  }

  if (report.command === "board status") {
    const { active, evidence } = report.counts;
    return [
      "Board status",
      `Schema: ${report.schema ?? "unknown"}`,
      `Active: milestones ${active.milestones}, work ${active.work}, plans ${active.plans}`,
      `Evidence: ${EVIDENCE_TYPES.map((type) => `${type} ${evidence[type]}`).join(", ")}`,
      `Migration required: ${report.migrationRequired ? "yes" : "no"}`,
      `Findings: ${report.findings.length}`,
      ...renderFindingLines(report.findings),
      `Next: ${report.nextAction}`,
      "",
    ].join("\n");
  }

  if (report.command === "board doctor") {
    const lines = [
      "Board doctor",
      `Schema: ${report.schema ?? "unknown"}`,
      `Mode: ${report.mode}`,
      `Migration required: ${report.migrationRequired ? "yes" : "no"}`,
      `Findings: ${report.findings.length}`,
      ...renderFindingLines(report.findings),
    ];
    if (report.fix) {
      lines.push(`Fix: ${report.fix.status}`);
      if (report.fix.reason) lines.push(`Reason: ${report.fix.reason}`);
      if (report.fix.patch) {
        lines.push("Patch:", report.fix.patch.text.trimEnd());
      }
      appendApplyDiagnostics(lines, report.fix);
    }
    lines.push(`Next: ${report.nextAction}`, "");
    return lines.join("\n");
  }

  if (report.command === "board migrate") {
    const lines = [
      "Board migrate",
      `Mode: ${report.mode}`,
      `Status: ${report.status}`,
      `Schema: ${report.fromSchema ?? "unknown"} -> ${report.toSchema}`,
      `Mappings: ${report.mappings.length}`,
      `Blockers: ${report.blockers.length}`,
      ...renderFindingLines(report.blockers),
      `Warnings: ${report.warnings.length}`,
      ...renderFindingLines(report.warnings),
      `Preserved unknown: ${report.preservedUnknown.length}`,
      ...report.preservedUnknown.map((item) => `- ${item}`),
      `Link rewrites: ${report.linkRewrites.length}`,
      ...report.linkRewrites.map(
        (item) => `- [${item.from}] ${item.oldTarget} -> ${item.newTarget}`,
      ),
    ];
    if (report.patch) lines.push("Patch:", report.patch.text.trimEnd());
    appendApplyDiagnostics(lines, {
      backupPath: report.backupPath,
      warnings: report.applyWarnings,
    });
    lines.push(`Next: ${report.nextAction}`, "");
    return lines.join("\n");
  }

  return `${report.command}\nStatus: ${report.status}\nNext: ${report.nextAction}\n`;
}
