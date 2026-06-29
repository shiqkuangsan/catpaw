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
const ACTIVE_STATUSES = new Set(["active", "draft"]);
const PROVIDER_STANCES = new Set(["inline", "preferred", "forced"]);
const REQUIRED_MILESTONE_FIELDS = ["id", "status", "created", "updated", "closed"];
const PROJECT_ADAPTER_FILES = ["AGENTS.md", "agents.md", "CLAUDE.md", "claude.md"];
const NON_PRIMARY_PROVIDER_PATTERN =
  /\b(current-tool subagent|subagent|Laoer|laoer|老二|second opinion|second reviewer|Laosan|laosan|老三|third opinion|third reviewer|Claude Code|Codex|Gemini|cc|cx|gemini)\b/i;
const SUBAGENT_PROVIDER_PATTERN = /\b(current-tool subagent|subagent)\b/i;

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
  return heading.replace(/^(MS|FR|BUG|CHORE)-\d+\s*:?\s*/i, "").trim() || fallback;
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

function indexMentionsArtifact(indexText, artifact) {
  return indexText.includes(artifact.id) || indexText.includes(path.basename(artifact.filePath));
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

function hasSubagentProvider(text) {
  return SUBAGENT_PROVIDER_PATTERN.test(text);
}

function hasNonEmptySubagentSkip(text) {
  const match = text.match(/^\s*(?:-\s*)?Subagent skipped:\s*(.+)$/im);
  if (!match) return false;
  const reason = match[1].trim();
  return Boolean(reason) && !/^<.*>$/.test(reason);
}

function hasAcceptedProviderGap(text) {
  return /Provider gaps?/i.test(text) &&
    /(accepted by user|user accepted|explicitly accepted|accepted the provider gap)/i.test(text);
}

function isFormalReview(review) {
  return review.mode === "formal" || /^## Mode\s*\n\s*formal\s*$/im.test(review.text);
}

function providerStanceValues(text) {
  const values = [];
  const pattern = /^\s*(?:-\s*)?Provider stance:\s*`?([A-Za-z_-]+)`?\s*$/gim;
  for (const match of text.matchAll(pattern)) {
    values.push(match[1].toLowerCase());
  }
  return values;
}

function milestoneReqIds(text) {
  return [...new Set([...text.matchAll(/\b(?:FR|BUG|CHORE)-\d+\b/g)].map((match) => match[0]))];
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

async function readArtifacts(projectRoot, boardPath) {
  const indexPath = path.join(boardPath, "index.md");
  const indexText = (await pathExists(indexPath)) ? await readText(indexPath) : "";
  const indexFrontmatter = parseFrontmatter(indexText).data;

  const milestones = [];
  for (const filePath of await listMarkdownFiles(path.join(boardPath, "milestones"))) {
    const text = await readText(filePath);
    milestones.push(normalizeArtifact(parseFrontmatter(text).data, filePath, text));
  }

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
    milestones,
    reqs,
    activePlans,
    archivedPlans,
    tests,
    reviews,
  };
}

function buildStatus(projectRoot, artifacts) {
  const activeMilestones = artifacts.milestones
    .filter((milestone) => !TERMINAL_STATUSES.has(milestone.status))
    .map((milestone) => ({
      id: milestone.id ?? path.basename(milestone.filePath, ".md"),
      title: titleFromText(milestone.text, milestone.id ?? path.basename(milestone.filePath, ".md")),
      status: milestone.status ?? "unknown",
      target: milestone.target ?? null,
      file: milestone.filePath,
      reqIds: milestoneReqIds(milestone.text),
      links: milestoneLinks(projectRoot, artifacts, milestone),
    }));
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
  if (activeMilestones.length) {
    nextRecommendedAction = "continue active milestone";
  } else if (activeReqs.length || activePlans.length) {
    nextRecommendedAction = "continue active work";
  }

  return {
    activeMilestones,
    activeReqs,
    activePlans,
    nextRecommendedAction,
    needsUserDecision: false,
  };
}

function milestoneLinks(projectRoot, artifacts, milestone) {
  const links = [markdownLink("Milestone", projectRoot, milestone.filePath)];
  const reqsById = new Map(artifacts.reqs.map((req) => [req.id, req]));
  for (const reqId of milestoneReqIds(milestone.text)) {
    const req = reqsById.get(reqId);
    if (req) links.push(markdownLink(reqId, projectRoot, req.filePath));
  }
  return links.join(" · ");
}

function findArtifactByReq(artifacts, reqId) {
  return artifacts.filter((artifact) => artifact.req === reqId);
}

function checkMilestones(projectRoot, artifacts) {
  const findings = [];
  const reqsById = new Map(artifacts.reqs.map((req) => [req.id, req]));
  const activeMilestoneReqs = new Map();

  for (const milestone of artifacts.milestones) {
    const id = milestone.id ?? path.basename(milestone.filePath, ".md");
    for (const field of REQUIRED_MILESTONE_FIELDS) {
      if (Object.hasOwn(milestone, field)) continue;
      findings.push(
        finding(
          "error",
          "milestone-missing-frontmatter",
          id,
          "milestone",
          relative(projectRoot, milestone.filePath),
          `Milestone ${id} is missing frontmatter field ${field}.`,
          "Add scalar milestone frontmatter from templates/milestone.md.",
        ),
      );
    }

    const terminal = TERMINAL_STATUSES.has(milestone.status);
    if (terminal && !milestone.closed) {
      findings.push(
        finding(
          "error",
          "terminal-milestone-missing-closed",
          id,
          "milestone",
          relative(projectRoot, milestone.filePath),
          `Terminal milestone ${id} has status ${milestone.status} but no closed date.`,
          "Set closed: YYYY-MM-DD or keep the milestone non-terminal.",
        ),
      );
    }
    if (!terminal && milestone.closed) {
      findings.push(
        finding(
          "error",
          "active-milestone-has-closed",
          id,
          "milestone",
          relative(projectRoot, milestone.filePath),
          `Non-terminal milestone ${id} has closed date ${milestone.closed}.`,
          "Set closed: null until the milestone is terminal.",
        ),
      );
    }
    if (terminal && indexMentionsArtifact(artifacts.indexText, milestone)) {
      findings.push(
        finding(
          "error",
          "index-lists-terminal-milestone",
          id,
          "index",
          relative(projectRoot, artifacts.indexPath),
          `Index lists terminal milestone ${id} under active milestones.`,
          "Run catpaw:reconcile --dry-run or remove the active dashboard entry.",
        ),
      );
    }
    if (!terminal && !indexMentionsArtifact(artifacts.indexText, milestone)) {
      findings.push(
        finding(
          "warning",
          "active-milestone-missing-index-entry",
          id,
          "index",
          relative(projectRoot, artifacts.indexPath),
          `Active milestone ${id} is not discoverable from the active dashboard.`,
          "Add it to .catpaw/index.md Active Milestones or run catpaw:reconcile --dry-run.",
        ),
      );
    }

    const reqIds = milestoneReqIds(milestone.text);
    for (const reqId of reqIds) {
      const req = reqsById.get(reqId);
      if (!req) {
        findings.push(
          finding(
            "error",
            "milestone-missing-req",
            id,
            "milestone",
            relative(projectRoot, milestone.filePath),
            `Milestone ${id} lists missing req ${reqId}.`,
            "Create the req or remove the stale req reference from the milestone Scope table.",
          ),
        );
        continue;
      }

      if (!terminal) {
        activeMilestoneReqs.set(reqId, [...(activeMilestoneReqs.get(reqId) ?? []), id]);
      }
      if (terminal && !req.terminal && !/(deferred|cancelled|canceled)/i.test(milestone.text)) {
        findings.push(
          finding(
            "warning",
            "done-milestone-has-active-req",
            id,
            "milestone",
            relative(projectRoot, milestone.filePath),
            `Done milestone ${id} includes non-terminal req ${reqId}.`,
            "Close, cancel, or explicitly defer the req before milestone closeout.",
          ),
        );
      }
    }

    if (!terminal && reqIds.length > 0) {
      const reqs = reqIds.map((reqId) => reqsById.get(reqId)).filter(Boolean);
      if (reqs.length === reqIds.length && reqs.every((req) => req.terminal)) {
        findings.push(
          finding(
            "info",
            "active-milestone-close-candidate",
            id,
            "milestone",
            relative(projectRoot, milestone.filePath),
            `Active milestone ${id} has only terminal reqs.`,
            "Consider catpaw:milestone close --dry-run after milestone verification.",
          ),
        );
      }
    }
  }

  for (const [reqId, milestoneIds] of activeMilestoneReqs) {
    if (milestoneIds.length <= 1) continue;
    findings.push(
      finding(
        "warning",
        "req-in-multiple-active-milestones",
        reqId,
        "milestone",
        relative(projectRoot, artifacts.indexPath),
        `Req ${reqId} appears in multiple active milestones: ${milestoneIds.join(", ")}.`,
        "Confirm this is intentional or remove duplicate milestone membership.",
      ),
    );
  }

  return findings;
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

function checkProviderStanceValues(projectRoot, artifacts) {
  const findings = [];
  const providerArtifacts = [
    ...artifacts.activePlans,
    ...artifacts.archivedPlans,
    ...artifacts.reviews,
  ];

  for (const artifact of providerArtifacts) {
    for (const stance of providerStanceValues(artifact.text)) {
      if (PROVIDER_STANCES.has(stance)) continue;
      findings.push(
        finding(
          "error",
          "invalid-provider-stance",
          artifact.req ?? "global",
          artifact.filePath.includes(`${path.sep}reviews${path.sep}`) ? "review" : "plan",
          relative(projectRoot, artifact.filePath),
          `Provider stance '${stance}' is invalid; use inline, preferred, or forced.`,
          "Move skipped/unavailable/gap into provider outcome or Provider gaps, not Provider stance.",
        ),
      );
    }
  }

  return findings;
}

function checkPreferredSubagentEvidence(projectRoot, artifacts) {
  const findings = [];
  const providerArtifacts = [
    ...artifacts.activePlans,
    ...artifacts.archivedPlans,
    ...artifacts.reviews,
  ];

  for (const artifact of providerArtifacts) {
    if (!providerStanceValues(artifact.text).includes("preferred")) continue;
    if (hasSubagentProvider(artifact.text) || hasNonEmptySubagentSkip(artifact.text)) continue;
    findings.push(
      finding(
        "warning",
        "preferred-subagent-missing-outcome",
        artifact.req ?? "global",
        artifact.filePath.includes(`${path.sep}reviews${path.sep}`) ? "review" : "plan",
        relative(projectRoot, artifact.filePath),
        "Provider stance is preferred but the artifact records no subagent evidence or skip reason.",
        "Record Provider outcome: used with subagent findings, or Subagent skipped: <reason>.",
      ),
    );
  }

  return findings;
}

function checkL3TestMatrices(projectRoot, artifacts) {
  const findings = [];

  for (const req of artifacts.reqs) {
    if (req.level !== "L3") continue;
    if (artifacts.tests.some((matrix) => artifactMatchesReq(matrix, req.id))) continue;
    findings.push(
      finding(
        "error",
        "l3-req-missing-test-matrix",
        req.id,
        "tests",
        relative(projectRoot, req.filePath),
        `L3 req ${req.id} does not have a test matrix.`,
        "Create .catpaw/tests/matrices/<req-id>-<slug>.md or de-escalate the req level.",
      ),
    );
  }

  return findings;
}

function checkPlanDirectoryStatus(projectRoot, artifacts) {
  const findings = [];

  for (const plan of artifacts.activePlans) {
    if (!TERMINAL_STATUSES.has(plan.status)) continue;
    findings.push(
      finding(
        "error",
        "active-plan-terminal-status",
        plan.req ?? "global",
        "plan",
        relative(projectRoot, plan.filePath),
        `Plan under plans/active has terminal status ${plan.status}.`,
        "Archive decision-bearing terminal plans or restore status to active before continuing.",
      ),
    );
  }

  for (const plan of artifacts.archivedPlans) {
    if (!ACTIVE_STATUSES.has(plan.status)) continue;
    findings.push(
      finding(
        "error",
        "archived-plan-active-status",
        plan.req ?? "global",
        "plan",
        relative(projectRoot, plan.filePath),
        `Plan under plans/archive has non-terminal status ${plan.status}.`,
        "Move active plans back to plans/active or mark the archived plan terminal.",
      ),
    );
  }

  return findings;
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
        relative(projectRoot, projectRoot),
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
      adapters.map((adapterPath) => relative(projectRoot, adapterPath)).join(", "),
      "Project adapter files exist but do not activate CatPaw runtime guidance.",
      "Update one project adapter with the CatPaw project adapter snippet.",
    ),
  ];
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
    ...checkMilestones(projectRoot, artifacts),
    ...checkReqLifecycle(projectRoot, artifacts),
    ...checkTerminalReqArtifacts(projectRoot, artifacts),
    ...checkProviderGates(projectRoot, artifacts),
    ...checkProviderStanceValues(projectRoot, artifacts),
    ...checkPreferredSubagentEvidence(projectRoot, artifacts),
    ...checkL3TestMatrices(projectRoot, artifacts),
    ...checkPlanDirectoryStatus(projectRoot, artifacts),
    ...(await checkProjectAdapters(projectRoot)),
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
