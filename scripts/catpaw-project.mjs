#!/usr/bin/env node

import {
  access,
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const NON_PRIMARY_PROVIDER_PATTERN =
  /\b(current-tool subagent|subagent|Laoer|laoer|老二|second opinion|second reviewer|Laosan|laosan|老三|third opinion|third reviewer|Claude Code|Codex|Gemini|cc|cx|gemini)\b/i;

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readText(target) {
  return readFile(target, "utf8");
}

async function readJson(target) {
  return JSON.parse(await readText(target));
}

async function listMarkdownFiles(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function listReviewSummaries(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summary = path.join(dir, entry.name, "summary.md");
    if (await pathExists(summary)) summaries.push(summary);
  }
  return summaries.sort();
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { data: {}, body: text };

  const raw = text.slice(4, end);
  const data = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim();
    data[key] = value === "null" ? null : value.replace(/^["']|["']$/g, "");
  }
  return { data, body: text.slice(end + "\n---".length) };
}

function reqIdFromPath(filePath) {
  return path.basename(filePath, ".md").match(/^(FR|BUG|CHORE)-\d+/)?.[0] ?? null;
}

function firstHeading(text) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function titleFromText(text, fallback) {
  const heading = firstHeading(text);
  if (!heading) return fallback;
  return heading.replace(/^(FR|BUG|CHORE)-\d+\s*:?\s*/i, "").trim() || fallback;
}

function normalizeReq(record, filePath, text) {
  const id = record.id ?? reqIdFromPath(filePath) ?? path.basename(filePath, ".md");
  return {
    ...record,
    id,
    filePath,
    text,
    terminal: TERMINAL_STATUSES.has(record.status),
  };
}

function normalizeArtifact(record, filePath, text) {
  return {
    ...record,
    filePath,
    text,
  };
}

function relative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath) || ".";
}

function finding(severity, code, req, area, filePath, message, suggestion) {
  return { severity, code, req, area, filePath, message, suggestion };
}

function indexMentionsReq(indexText, req) {
  return indexText.includes(req.id) || indexText.includes(path.basename(req.filePath));
}

function artifactMatchesReq(artifact, reqId) {
  return artifact.req === reqId || path.basename(artifact.filePath).includes(reqId);
}

function markdownLink(label, projectRoot, filePath) {
  return `[${label}](${relative(projectRoot, filePath)})`;
}

function activeWorkLinks(projectRoot, artifacts, req) {
  const links = [markdownLink("Req", projectRoot, req.filePath)];
  const plan = artifacts.activePlans.find((item) => artifactMatchesReq(item, req.id));
  const test = artifacts.tests.find((item) => artifactMatchesReq(item, req.id));
  const review = artifacts.reviews.find((item) => artifactMatchesReq(item, req.id));

  if (plan) links.push(markdownLink("Plan", projectRoot, plan.filePath));
  if (test) links.push(markdownLink("Tests", projectRoot, test.filePath));
  if (review) links.push(markdownLink("Review", projectRoot, review.filePath));

  return links.join(" · ");
}

function artifactHasPendingRows(text) {
  return /\|\s*[^|\n]+\s*\|\s*[^|\n]+\s*\|\s*pending\s*\|/i.test(text) ||
    /^\s*pending\s*$/im.test(text) ||
    /\bpending\b/i.test(text);
}

function hasNonPrimaryProvider(text) {
  return NON_PRIMARY_PROVIDER_PATTERN.test(text);
}

function hasAcceptedProviderGap(text) {
  return /Provider gaps?/i.test(text) &&
    /(accepted by user|user accepted|explicitly accepted|accepted the provider gap)/i.test(text);
}

function isFormalReview(review) {
  return review.mode === "formal" || /^## Mode\s*\n\s*formal\s*$/im.test(review.text);
}

async function readArtifacts(projectRoot, boardPath) {
  const indexPath = path.join(boardPath, "index.md");
  const indexText = (await pathExists(indexPath)) ? await readText(indexPath) : "";
  const indexFrontmatter = parseFrontmatter(indexText).data;

  const reqs = [];
  for (const filePath of await listMarkdownFiles(path.join(boardPath, "reqs"))) {
    const text = await readText(filePath);
    reqs.push(normalizeReq(parseFrontmatter(text).data, filePath, text));
  }

  const activePlans = [];
  for (const filePath of await listMarkdownFiles(path.join(boardPath, "plans", "active"))) {
    const text = await readText(filePath);
    activePlans.push(normalizeArtifact(parseFrontmatter(text).data, filePath, text));
  }

  const archivedPlans = [];
  for (const filePath of await listMarkdownFiles(path.join(boardPath, "plans", "archive"))) {
    const text = await readText(filePath);
    archivedPlans.push(normalizeArtifact(parseFrontmatter(text).data, filePath, text));
  }

  const tests = [];
  for (const filePath of await listMarkdownFiles(path.join(boardPath, "tests", "matrices"))) {
    const text = await readText(filePath);
    tests.push(normalizeArtifact(parseFrontmatter(text).data, filePath, text));
  }

  const reviews = [];
  for (const filePath of await listReviewSummaries(path.join(boardPath, "reviews"))) {
    const text = await readText(filePath);
    reviews.push(normalizeArtifact(parseFrontmatter(text).data, filePath, text));
  }

  return {
    indexPath,
    indexText,
    indexRuntime: indexFrontmatter.runtime ?? null,
    reqs,
    activePlans,
    archivedPlans,
    tests,
    reviews,
  };
}

function buildStatus(projectRoot, artifacts) {
  const activeReqs = artifacts.reqs
    .filter((req) => !req.terminal)
    .map((req) => ({
      id: req.id,
      title: titleFromText(req.text, req.id),
      status: req.status ?? "unknown",
      file: req.filePath,
      links: activeWorkLinks(projectRoot, artifacts, req),
    }));
  const activePlans = artifacts.activePlans.map((plan) => ({
    id: plan.id ?? path.basename(plan.filePath, ".md"),
    req: plan.req ?? null,
    status: plan.status ?? "unknown",
    file: plan.filePath,
  }));

  let nextRecommendedAction = "none";
  if (activeReqs.length || activePlans.length) {
    nextRecommendedAction = "continue active work";
  }

  return {
    activeReqs,
    activePlans,
    nextRecommendedAction,
    needsUserDecision: false,
  };
}

function findArtifactByReq(artifacts, reqId) {
  return artifacts.filter((artifact) => artifact.req === reqId);
}

function checkReqLifecycle(projectRoot, artifacts) {
  const findings = [];

  for (const req of artifacts.reqs) {
    if (req.terminal && !req.closed) {
      findings.push(
        finding(
          "error",
          "terminal-req-missing-closed",
          req.id,
          "req",
          relative(projectRoot, req.filePath),
          `Terminal req ${req.id} has status ${req.status} but no closed date.`,
          "Set closed: YYYY-MM-DD or keep the req non-terminal.",
        ),
      );
    }
    if (!req.terminal && req.closed) {
      findings.push(
        finding(
          "error",
          "active-req-has-closed",
          req.id,
          "req",
          relative(projectRoot, req.filePath),
          `Non-terminal req ${req.id} has closed date ${req.closed}.`,
          "Set closed: null until the req is terminal.",
        ),
      );
    }
    if (req.terminal && indexMentionsReq(artifacts.indexText, req)) {
      findings.push(
        finding(
          "error",
          "index-lists-terminal-req",
          req.id,
          "index",
          relative(projectRoot, artifacts.indexPath),
          `Index lists terminal req ${req.id} under active work.`,
          "Run catpaw:reconcile --dry-run or remove the active dashboard entry.",
        ),
      );
    }
  }

  return findings;
}

function checkTerminalReqArtifacts(projectRoot, artifacts) {
  const findings = [];
  const terminalReqs = artifacts.reqs.filter((req) => req.terminal);

  for (const req of terminalReqs) {
    for (const plan of findArtifactByReq(artifacts.activePlans, req.id)) {
      findings.push(
        finding(
          "error",
          "terminal-req-active-plan",
          req.id,
          "plan",
          relative(projectRoot, plan.filePath),
          `Terminal req ${req.id} still has active plan ${path.basename(plan.filePath)}.`,
          "Archive decision-bearing plans or remove purely procedural plans after user confirmation.",
        ),
      );
    }

    for (const matrix of findArtifactByReq(artifacts.tests, req.id)) {
      if (!artifactHasPendingRows(matrix.text)) continue;
      findings.push(
        finding(
          "warning",
          "terminal-req-pending-tests",
          req.id,
          "tests",
          relative(projectRoot, matrix.filePath),
          `Terminal req ${req.id} has pending test matrix rows.`,
          "Resolve pending rows or record them as deferred/not addressed risk.",
        ),
      );
    }

    for (const review of findArtifactByReq(artifacts.reviews, req.id)) {
      if (!review.text.includes("plans/active/")) continue;
      findings.push(
        finding(
          "warning",
          "review-points-active-plan",
          req.id,
          "review",
          relative(projectRoot, review.filePath),
          `Review still points to active plan for terminal req ${req.id}.`,
          "Update review links to the archived plan path when a plan is archived.",
        ),
      );
    }
  }

  return findings;
}

function checkProviderGates(projectRoot, artifacts) {
  const findings = [];
  const reqsById = new Map(artifacts.reqs.map((req) => [req.id, req]));
  const plans = [...artifacts.activePlans, ...artifacts.archivedPlans];

  for (const plan of plans) {
    const req = reqsById.get(plan.req);
    if (req?.level !== "L3") continue;
    if (hasNonPrimaryProvider(plan.text) || hasAcceptedProviderGap(plan.text)) continue;

    findings.push(
      finding(
        "error",
        "l3-plan-missing-provider-gate",
        req.id,
        "plan",
        relative(projectRoot, plan.filePath),
        `L3 plan for ${req.id} does not name a non-primary provider or accepted provider gap.`,
        "Add Provider gate / Council provider evidence before implementation.",
      ),
    );
  }

  for (const review of artifacts.reviews) {
    if (!isFormalReview(review)) continue;
    if (hasNonPrimaryProvider(review.text) || hasAcceptedProviderGap(review.text)) continue;

    findings.push(
      finding(
        "error",
        "formal-review-missing-non-primary-provider",
        review.req ?? "global",
        "review",
        relative(projectRoot, review.filePath),
        "Formal review does not include a non-primary provider or accepted provider gap.",
        "Record a non-primary provider in Participants or an explicitly accepted Provider gaps entry.",
      ),
    );
  }

  return findings;
}

async function checkRegistry(projectRoot, boardPath, boardRuntime, registryPath) {
  if (!registryPath || !(await pathExists(registryPath))) return { registry: null, findings: [] };

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
        registryPath,
        `Registry stamp mismatch: registry ${project.stamp}, board ${boardRuntime}.`,
        "Run catpaw:upgrade-project --dry-run for this board before applying changes.",
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
      status: {
        activeReqs: [],
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
          boardPath,
          `No .catpaw board found at ${boardPath}.`,
          "Run catpaw:init-project if this project should be tracked.",
        ),
      ],
    };
  }

  const boardStat = await stat(boardPath);
  if (!boardStat.isDirectory()) {
    throw new Error(`CatPaw board path is not a directory: ${boardPath}`);
  }

  const artifacts = await readArtifacts(projectRoot, boardPath);
  const registryResult = await checkRegistry(
    projectRoot,
    boardPath,
    artifacts.indexRuntime,
    registryPath,
  );
  const findings = [
    ...checkReqLifecycle(projectRoot, artifacts),
    ...checkTerminalReqArtifacts(projectRoot, artifacts),
    ...checkProviderGates(projectRoot, artifacts),
    ...registryResult.findings,
  ];
  const status = buildStatus(projectRoot, artifacts);
  if (findings.length > 0) {
    status.nextRecommendedAction = "run catpaw:doctor";
    status.needsUserDecision = true;
  }

  return {
    ok: !findings.some((item) => item.severity === "error"),
    projectRoot,
    boardPath,
    runtime: artifacts.indexRuntime,
    status,
    registry: registryResult.registry,
    findings,
  };
}

export function renderStatus(result) {
  const activeWorkTable = renderActiveWorkTable(result.status.activeReqs);

  return [
    "Current status:",
    `- Project: ${result.projectRoot}`,
    `- Board: ${result.boardPath}`,
    `- Runtime stamp: ${result.runtime ?? "missing"}`,
    `- Active reqs: ${result.status.activeReqs.length}`,
    `- Active plans: ${result.status.activePlans.length}`,
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

  if (args.command === "doctor" && !result.ok) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
