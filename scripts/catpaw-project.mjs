#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadBoard,
  pathExists,
  projectRelative,
} from "../src/runtime/lib/board.mjs";
import {
  collectBoardFindings,
  finding,
} from "../src/runtime/lib/findings.mjs";
import {
  artifactReferencesWork,
  buildArtifactGraph,
} from "../src/runtime/lib/graph.mjs";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const PROJECT_ADAPTER_FILES = ["AGENTS.md", "agents.md", "CLAUDE.md", "claude.md"];

async function readText(target) {
  return readFile(target, "utf8");
}

async function readJson(target) {
  return JSON.parse(await readText(target));
}

function firstHeading(text) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function titleFromText(text, fallback) {
  const heading = firstHeading(text);
  if (!heading) return fallback;
  return heading.replace(/^(MS|FR|BUG|CHORE)-\d+\s*:?\s*/i, "").trim() || fallback;
}

function markdownLink(label, artifact) {
  return `[${label}](${artifact.path})`;
}

function activeWorkLinks(board, workItem) {
  const links = [markdownLink(board.schema === 2 ? "Work" : "Req", workItem)];
  const plan = board.activePlans.find((item) => artifactReferencesWork(item, workItem.id));
  const test = board.tests.find((item) => artifactReferencesWork(item, workItem.id));
  const review = board.reviews.find((item) => artifactReferencesWork(item, workItem.id));

  if (plan) links.push(markdownLink("Plan", plan));
  if (test) links.push(markdownLink("Tests", test));
  if (review) links.push(markdownLink("Review", review));

  return links.join(" · ");
}

function milestoneLinks(graph, milestone) {
  const links = [markdownLink("Milestone", milestone)];
  for (const edge of graph.edges) {
    if (edge.relation !== "milestone-work" || edge.from.path !== milestone.path) continue;
    if (!edge.resolved) continue;
    links.push(`[${edge.to.id}](${edge.to.path})`);
  }
  return links.join(" · ");
}

function buildStatus(board, graph) {
  const activeMilestones = board.milestones
    .filter((milestone) => !TERMINAL_STATUSES.has(milestone.status))
    .map((milestone) => {
      const id = milestone.id ?? path.basename(milestone.path, ".md");
      const reqIds = graph.edges
        .filter(
          (edge) => edge.relation === "milestone-work" && edge.from.path === milestone.path,
        )
        .map((edge) => edge.to.id);
      return {
        id,
        title: titleFromText(milestone.text, id),
        status: milestone.status ?? "unknown",
        target: milestone.target ?? null,
        file: milestone.filePath,
        reqIds,
        links: milestoneLinks(graph, milestone),
      };
    });

  const activeReqs = board.reqs
    .filter((req) => !req.terminal)
    .map((req) => ({
      id: req.id,
      title: titleFromText(req.text, req.id),
      status: req.status ?? "unknown",
      level: req.level ?? null,
      file: req.filePath,
      links: activeWorkLinks(board, req),
    }));

  const activeWorkIds = new Set(activeReqs.map((item) => item.id));
  const activePlanArtifacts = board.schema === 2
    ? board.plans.filter((plan) => activeWorkIds.has(plan.work))
    : board.activePlans;
  const activePlans = activePlanArtifacts.map((plan) => ({
    id: plan.id ?? path.basename(plan.path, ".md"),
    req: plan.req ?? plan.work ?? null,
    status: plan.status ?? "unknown",
    file: plan.filePath,
  }));

  let nextRecommendedAction = "none";
  let needsUserDecision = false;
  if (activeMilestones.length > 0) {
    nextRecommendedAction = "continue active milestone";
  } else if (activeReqs.length > 0 || activePlans.length > 0) {
    nextRecommendedAction = "continue active work";
  }

  return {
    activeReqs,
    activeMilestones,
    activePlans,
    nextRecommendedAction,
    needsUserDecision,
  };
}

function hasCatPawAdapter(text) {
  return text.includes("CatPaw Protocol") &&
    text.includes("~/.catpaw/runtime-policy.md");
}

async function existingProjectAdapters(projectRoot) {
  const adapters = [];
  for (const fileName of PROJECT_ADAPTER_FILES) {
    const filePath = path.join(projectRoot, fileName);
    if (await pathExists(filePath)) adapters.push(filePath);
  }
  return adapters;
}

async function checkProjectAdapters(projectRoot) {
  const adapters = await existingProjectAdapters(projectRoot);

  if (adapters.length === 0) {
    return [
      finding(
        "warning",
        "project-adapter-missing",
        "global",
        "adapter",
        ".",
        "Project has a CatPaw board but no AGENTS.md or CLAUDE.md project adapter.",
        "Add the CatPaw project adapter snippet so agents load ~/.catpaw/runtime-policy.md.",
      ),
    ];
  }

  for (const adapterPath of adapters) {
    const text = await readText(adapterPath);
    if (hasCatPawAdapter(text)) return [];
  }

  return [
    finding(
      "warning",
      "project-adapter-stale",
      "global",
      "adapter",
      adapters.map((adapterPath) => projectRelative(projectRoot, adapterPath)).join(", "),
      "Project adapter files exist but do not activate CatPaw runtime guidance.",
      "Update one project adapter with the CatPaw project adapter snippet.",
    ),
  ];
}

async function checkRegistry(projectRoot, boardPath, boardRuntime, registryPath) {
  if (!registryPath || !(await pathExists(registryPath))) {
    return { registry: null, findings: [] };
  }

  const registry = await readJson(registryPath);
  const project = (registry.projects ?? []).find((entry) => {
    if (entry.boardPath === boardPath) return true;
    return entry.projectRoot && path.resolve(entry.projectRoot) === projectRoot;
  });

  if (!project) {
    return {
      registry: { registered: false, registryPath },
      findings: [],
    };
  }

  const findings = [];
  if (project.stamp && boardRuntime && project.stamp !== boardRuntime) {
    findings.push(
      finding(
        "error",
        "registry-stamp-mismatch",
        "global",
        "registry",
        projectRelative(projectRoot, registryPath),
        `Registry stamp mismatch: registry ${project.stamp}, board ${boardRuntime}.`,
        "Run catpaw board migrate --project <path> as a dry-run before any board apply.",
      ),
    );
  }

  return {
    registry: {
      registered: true,
      registryPath,
      stamp: project.stamp ?? null,
      lastSeenAt: project.lastSeenAt ?? null,
      lastSeenVia: project.lastSeenVia ?? null,
    },
    findings,
  };
}

export async function analyzeProject(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const boardPath = path.resolve(options.boardPath ?? path.join(projectRoot, ".catpaw"));
  const registryPath = options.registryPath ??
    path.join(process.env.HOME ?? "", ".catpaw", "state", "projects.json");

  if (!(await pathExists(boardPath))) {
    return {
      ok: false,
      projectRoot,
      boardPath,
      schema: null,
      runtime: null,
      status: {
        activeReqs: [],
        activeMilestones: [],
        activePlans: [],
        nextRecommendedAction: "initialize CatPaw or choose a project with .catpaw",
        needsUserDecision: true,
      },
      registry: null,
      findings: [
        finding(
          "error",
          "missing-board",
          "global",
          "board",
          projectRelative(projectRoot, boardPath),
          `No .catpaw board found at ${boardPath}.`,
          "Run catpaw board init --project <path> as a dry-run if this project should be tracked.",
        ),
      ],
    };
  }

  const boardStat = await stat(boardPath);
  if (!boardStat.isDirectory()) {
    throw new Error(`CatPaw board path is not a directory: ${boardPath}`);
  }

  const board = await loadBoard({ projectRoot, boardPath });
  const graph = buildArtifactGraph(board);
  const registryResult = await checkRegistry(
    projectRoot,
    boardPath,
    board.runtime,
    registryPath,
  );
  const findings = [
    ...collectBoardFindings(board, graph),
    ...(await checkProjectAdapters(projectRoot)),
    ...registryResult.findings,
  ];
  const status = buildStatus(board, graph);
  if (findings.length > 0) {
    status.nextRecommendedAction = "run catpaw board doctor";
    status.needsUserDecision = true;
  }

  return {
    ok: !findings.some((item) => item.severity === "error"),
    projectRoot,
    boardPath,
    schema: board.schema,
    runtime: board.runtime,
    status,
    registry: registryResult.registry,
    findings,
  };
}

export function renderStatus(result) {
  const activeWorkTable = renderActiveWorkTable(result.status.activeReqs);
  const activeMilestoneTable = renderActiveMilestoneTable(result.status.activeMilestones);

  return [
    "Current status:",
    `- Project: ${result.projectRoot}`,
    `- Board: ${result.boardPath}`,
    `- Runtime stamp: ${result.runtime ?? "missing"}`,
    `- Active milestones: ${result.status.activeMilestones.length}`,
    `- Active reqs: ${result.status.activeReqs.length}`,
    `- Active plans: ${result.status.activePlans.length}`,
    "",
    "Active Milestones:",
    ...activeMilestoneTable,
    "",
    "Active Work:",
    ...activeWorkTable,
    "",
    "Artifact health:",
    `- Findings: ${result.findings.length}`,
    "",
    `Next recommended action: ${result.status.nextRecommendedAction}`,
    `Needs user decision: ${result.status.needsUserDecision ? "yes" : "no"}`,
  ].join("\n");
}

function renderActiveMilestoneTable(activeMilestones) {
  const header = [
    "| ID | Title | Status | Target | Links |",
    "|---|---|---|---|---|",
  ];
  if (!activeMilestones.length) return [...header, "| _None_ |  |  |  |"];
  return [
    ...header,
    ...activeMilestones.map((milestone) =>
      `| ${tableCell(milestone.id)} | ${tableCell(milestone.title)} | ${tableCell(milestone.status)} | ${tableCell(milestone.target ?? "")} | ${milestone.links} |`,
    ),
  ];
}

function tableCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function renderActiveWorkTable(activeReqs) {
  const header = [
    "| ID | Title | Status | Links |",
    "|---|---|---|---|",
  ];
  if (!activeReqs.length) return [...header, "| _None_ |  |  |  |"];
  return [
    ...header,
    ...activeReqs.map((req) =>
      `| ${tableCell(req.id)} | ${tableCell(req.title)} | ${tableCell(req.status)} | ${req.links} |`,
    ),
  ];
}

export function renderDoctor(result) {
  if (!result.findings.length) {
    return [
      "Artifact health:",
      "- No findings.",
      "",
      `Next recommended action: ${result.status.nextRecommendedAction}`,
      "Needs user decision: no",
    ].join("\n");
  }

  const lines = ["Artifact health:"];
  for (const item of result.findings) {
    lines.push(
      `- [${item.severity}] ${item.req} ${item.area}: ${item.message}`,
      `  File: ${item.filePath}`,
      `  Suggested: ${item.suggestion}`,
    );
  }
  lines.push("", "Next recommended action: inspect findings", "Needs user decision: yes");
  return lines.join("\n");
}

function parseArgs(argv) {
  const [command = "status", ...rest] = argv;
  const args = { command, projectRoot: process.cwd(), json: false };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--project") {
      args.projectRoot = rest[index + 1];
      index += 1;
    } else if (arg === "--board") {
      args.boardPath = rest[index + 1];
      index += 1;
    } else if (arg === "--registry") {
      args.registryPath = rest[index + 1];
      index += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!["status", "doctor"].includes(args.command)) {
    throw new Error(`Unknown command: ${args.command}`);
  }

  const result = await analyzeProject(args);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(args.command === "doctor" ? renderDoctor(result) : renderStatus(result));
  }

  if (args.command === "doctor" && !result.ok) process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
