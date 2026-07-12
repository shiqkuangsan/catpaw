import { readFile } from "node:fs/promises";
import path from "node:path";

import { applyPatchPlan } from "../atomic-write.mjs";
import { loadBoard } from "../board.mjs";
import { collectBoardFindings } from "../findings.mjs";
import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter.mjs";
import { buildArtifactGraph } from "../graph.mjs";
import { createPatchPlan, renderPatchPlan } from "../patch-plan.mjs";
import { validateMetadata } from "../schema.mjs";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const DASHBOARD_MARKERS = Object.freeze({
  milestones: Object.freeze({
    start: "<!-- catpaw:active-milestones:start -->",
    end: "<!-- catpaw:active-milestones:end -->",
  }),
  work: Object.freeze({
    start: "<!-- catpaw:active-work:start -->",
    end: "<!-- catpaw:active-work:end -->",
  }),
});

export function workflowError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function asciiSlug(value, fallback = "item") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || fallback;
}

function templateUrl(name) {
  return new URL(`../../templates/${name}`, import.meta.url);
}

export async function instantiateTemplate({
  name,
  kind,
  metadata,
  order,
  replacements,
}) {
  const template = await readFile(templateUrl(name), "utf8");
  let body = parseFrontmatter(template).body;
  body = body.replace(/{{([A-Z_]+)}}/g, (placeholder, token) => {
    if (!Object.hasOwn(replacements, token)) {
      throw workflowError(
        "ERR_WORKFLOW_TEMPLATE_TOKEN",
        `Template ${name} contains an unresolved token.`,
      );
    }
    return replacements[token];
  });
  const findings = validateMetadata(kind, metadata);
  if (findings.length > 0) {
    throw workflowError(
      "ERR_WORKFLOW_TEMPLATE_METADATA",
      `Generated ${kind} metadata is invalid: ${findings[0].message}`,
    );
  }
  return `${stringifyFrontmatter(metadata, order)}${body}`;
}

function compareArtifacts(left, right) {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return boardRelativePath(left).localeCompare(boardRelativePath(right), "en");
}

function boardRelativePath(artifact) {
  if (artifact.boardRelativePath) return artifact.boardRelativePath;
  if (!artifact.filePath || !artifact.boardPath) return artifact.path;
  return path.relative(artifact.boardPath, artifact.filePath).split(path.sep).join("/");
}

function artifactTitle(artifact) {
  if (artifact.title) return artifact.title;
  const heading = artifact.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!heading) return artifact.id;
  return heading.replace(new RegExp(`^${artifact.id}(?::|\\s+-)?\\s*`), "").trim() || artifact.id;
}

export function neutralizeCatPawMarkers(value) {
  return String(value ?? "").replaceAll("<!-- catpaw:", "&lt;!-- catpaw:");
}

export function managedTableCell(value) {
  return neutralizeCatPawMarkers(value)
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function mergeArtifacts(existing, synthetic) {
  const byId = new Map();
  for (const artifact of existing) byId.set(artifact.id, artifact);
  for (const artifact of synthetic) byId.set(artifact.id, artifact);
  return [...byId.values()];
}

function withBoardRelativePaths(artifacts, boardPath) {
  return artifacts.map((artifact) => {
    if (artifact.boardRelativePath || !artifact.filePath || !boardPath) return artifact;
    return {
      ...artifact,
      boardRelativePath: path
        .relative(boardPath, artifact.filePath)
        .split(path.sep)
        .join("/"),
    };
  });
}

function renderMilestones(milestones) {
  const active = milestones
    .filter((item) => !TERMINAL_STATUSES.has(item.status))
    .sort(compareArtifacts);
  if (active.length === 0) return "## Active Milestones\n\n_None._";
  return [
    "## Active Milestones",
    "",
    "| ID | Title | Status | Target | Link |",
    "|---|---|---|---|---|",
    ...active.map((item) => {
      const artifactPath = boardRelativePath(item);
      return `| ${item.id} | ${managedTableCell(artifactTitle(item))} | ${item.status} | ${managedTableCell(item.target)} | [Milestone](${artifactPath}) |`;
    }),
  ].join("\n");
}

function renderWork(workItems, plans) {
  const planByWork = new Map(plans.map((plan) => [plan.work, plan]));
  const active = workItems
    .filter((item) => !TERMINAL_STATUSES.has(item.status))
    .sort(compareArtifacts);
  if (active.length === 0) return "## Active Work\n\n_None._";
  return [
    "## Active Work",
    "",
    "| ID | Title | Mode | Status | Stage | Links |",
    "|---|---|---|---|---|---|",
    ...active.map((item) => {
      const links = [`[Work](${boardRelativePath(item)})`];
      const plan = planByWork.get(item.id);
      if (plan) links.push(`[Plan](${boardRelativePath(plan)})`);
      return `| ${item.id} | ${managedTableCell(artifactTitle(item))} | ${item.mode} | ${item.status} | ${item.stage} | ${links.join(" / ")} |`;
    }),
  ].join("\n");
}

export function markerOccurrenceCount(text, token) {
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(token, index)) !== -1) {
    count += 1;
    index += token.length;
  }
  return count;
}

function replaceMarker(text, marker, content) {
  const startCount = markerOccurrenceCount(text, marker.start);
  const endCount = markerOccurrenceCount(text, marker.end);
  if (startCount > 1 || endCount > 1) {
    throw workflowError(
      "ERR_WORKFLOW_DASHBOARD_MARKER",
      "Dashboard contains duplicate CatPaw marker blocks.",
    );
  }
  const startIndex = text.indexOf(marker.start);
  const endIndex = text.indexOf(marker.end);
  if (startIndex === -1 && endIndex === -1) {
    const separator = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
    return `${text}${separator}${marker.start}\n${content}\n${marker.end}\n`;
  }
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw workflowError(
      "ERR_WORKFLOW_DASHBOARD_MARKER",
      "Dashboard contains an incomplete or out-of-order CatPaw marker block.",
    );
  }
  const contentStart = startIndex + marker.start.length;
  return `${text.slice(0, contentStart)}\n${content}\n${text.slice(endIndex)}`;
}

export function rebuildDashboard(indexText, board, synthetic = {}) {
  const milestones = mergeArtifacts(
    withBoardRelativePaths(board.milestones ?? [], board.boardPath),
    synthetic.milestones ?? [],
  );
  const workItems = mergeArtifacts(
    withBoardRelativePaths(board.workItems ?? [], board.boardPath),
    synthetic.workItems ?? [],
  );
  const plans = [
    ...withBoardRelativePaths(board.plans ?? [], board.boardPath),
    ...(synthetic.plans ?? []),
  ];
  let next = replaceMarker(
    indexText,
    DASHBOARD_MARKERS.milestones,
    renderMilestones(milestones),
  );
  next = replaceMarker(next, DASHBOARD_MARKERS.work, renderWork(workItems, plans));
  return next;
}

export function patchReport(plan) {
  return {
    status: plan.status,
    operationCount: plan.operations.length,
    text: renderPatchPlan(plan),
  };
}

export async function inspectMutationBoard(options) {
  const board = await loadBoard({
    projectRoot: options.projectRoot,
    boardPath: options.boardPath,
  });
  const graph = buildArtifactGraph(board);
  const findings = collectBoardFindings(board, graph);
  return { board, graph, findings };
}

export function schemaRefusal(command, options, board, findings) {
  if (board.schema === 2 && !findings.some((item) => item.severity === "error")) {
    return null;
  }
  const migrationRequired = board.schema === 1;
  return {
    exitCode: 1,
    report: {
      command,
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: board.schema,
      mode: "read-only",
      status: migrationRequired ? "migration-required" : "invalid-board",
      migrationRequired,
      findings,
      patch: null,
      nextAction: migrationRequired
        ? "Run board migrate."
        : "Resolve the board errors before mutation.",
    },
  };
}

export async function createMutationPlan(options, operations) {
  return createPatchPlan({ root: options.boardPath, operations });
}

export async function applyMutationPlan(plan, options) {
  if (!options.apply || plan.status === "blocked") return null;
  return applyPatchPlan(plan, {
    validate: async ({ stageRoot }) => {
      const inspected = await inspectMutationBoard({
        projectRoot: options.projectRoot,
        boardPath: stageRoot,
      });
      if (
        inspected.board.schema !== 2 ||
        inspected.findings.some((item) => item.severity === "error")
      ) {
        throw workflowError(
          "ERR_WORKFLOW_STAGED_VALIDATION",
          "Staged workflow mutation failed schema 2 graph validation.",
        );
      }
    },
  });
}

export function mutationResult({
  command,
  options,
  plan,
  applyResult,
  artifacts = [],
  nextAction,
  reportFields = {},
}) {
  const blocked = plan.status === "blocked";
  return {
    exitCode: blocked ? 1 : 0,
    report: {
      command,
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      mode: options.apply ? "apply" : "dry-run",
      status: blocked ? "blocked" : applyResult?.status ?? "preview",
      migrationRequired: false,
      artifacts,
      ...reportFields,
      patch: patchReport(plan),
      ...(applyResult
        ? { warnings: applyResult.warnings, backupPath: applyResult.backupPath }
        : {}),
      nextAction: blocked ? "Resolve the patch blockers." : nextAction,
    },
  };
}

export function refusedMutation({
  command,
  options,
  reason,
  nextAction,
  reportFields = {},
}) {
  return {
    exitCode: 1,
    report: {
      command,
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      mode: options.apply ? "apply" : "dry-run",
      status: "refused",
      migrationRequired: false,
      reason,
      ...reportFields,
      patch: null,
      nextAction,
    },
  };
}

function appendApplyDiagnostics(lines, report) {
  if (report.backupPath) lines.push(`Backup: ${report.backupPath}`);
  if (!report.warnings?.length) return;
  lines.push(
    `Warnings: ${report.warnings.length}`,
    ...report.warnings.map(
      (warning) => `- ${warning.code} [${warning.path}] ${warning.message}`,
    ),
  );
}

export function renderMutationReport(report) {
  const lines = [
    report.command,
    `Schema: ${report.schema ?? "unknown"}`,
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Migration required: ${report.migrationRequired ? "yes" : "no"}`,
  ];
  if (report.findings) lines.push(`Findings: ${report.findings.length}`);
  if (report.reason) lines.push(`Reason: ${report.reason}`);
  if (report.patch) lines.push("Patch:", report.patch.text.trimEnd());
  appendApplyDiagnostics(lines, report);
  lines.push(`Next: ${report.nextAction}`, "");
  return lines.join("\n");
}
