import path from "node:path";

import { stringifyFrontmatter } from "../frontmatter.mjs";
import { artifactTitle } from "../presentation.mjs";
import {
  parseMilestoneScope,
  refreshMilestoneScope,
} from "./milestone-scope.mjs";
import {
  applyMutationPlan,
  asciiSlug,
  createMutationPlan,
  inspectMutationBoard,
  instantiateTemplate,
  mutationResult,
  neutralizeCatPawMarkers,
  rebuildDashboard,
  refusedMutation,
  schemaRefusal,
} from "./workflow.mjs";

const MILESTONE_ORDER = [
  "id",
  "status",
  "created",
  "updated",
  "closed",
  "target",
];
function boardRelative(board, filePath) {
  return path.relative(board.boardPath, filePath).split(path.sep).join("/");
}

async function runStart(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "milestone start",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;

  const slug = asciiSlug(options.title);
  const milestonePath = `milestones/${options.id}-${slug}.md`;
  const existing = inspected.board.milestones.find((item) => item.id === options.id);
  if (existing) {
    const existingPath = boardRelative(inspected.board, existing.filePath);
    if (existingPath !== milestonePath) {
      return refusedMutation({
        command: "milestone start",
        options,
        reason: `Milestone ${options.id} already exists at ${existingPath}.`,
        nextAction: "Reuse the existing Milestone ID or choose a new ID.",
      });
    }
  }
  const metadata = {
    id: options.id,
    status: "active",
    created: options.date,
    updated: options.date,
    closed: null,
    target: options.target,
  };
  const content = await instantiateTemplate({
    name: "milestone.md",
    kind: "milestone",
    metadata,
    order: MILESTONE_ORDER,
    replacements: {
      MILESTONE_ID: options.id,
      TITLE: neutralizeCatPawMarkers(options.title),
    },
  });
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    milestones: [{
      ...metadata,
      title: options.title,
      boardRelativePath: milestonePath,
    }],
  });
  const plan = await createMutationPlan(options, [
    { type: "write-file", path: milestonePath, content, mode: "create" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "milestone start",
    options,
    plan,
    applyResult,
    artifacts: [{ kind: "milestone", path: milestonePath }],
    nextAction: options.apply
      ? "Milestone is active."
      : "Run milestone start --apply to create the Milestone.",
  });
}

async function runAdd(options) {
  const inspected = await inspectMutationBoard(options);
  const preflightFindings = inspected.findings.filter((item) =>
    item.code !== "malformed-milestone-scope" || item.req !== options.milestone
  );
  const refusal = schemaRefusal(
    "milestone add",
    options,
    inspected.board,
    preflightFindings,
  );
  if (refusal) return refusal;
  const milestone = inspected.board.milestones.find(
    (item) => item.id === options.milestone,
  );
  if (!milestone) {
    return refusedMutation({
      command: "milestone add",
      options,
      reason: `Milestone ${options.milestone} does not exist.`,
      nextAction: "Create the Milestone before adding scope.",
    });
  }
  if (["done", "cancelled"].includes(milestone.status)) {
    return refusedMutation({
      command: "milestone add",
      options,
      reason: `Milestone ${options.milestone} is terminal.`,
      nextAction: "Use an active or blocked Milestone.",
    });
  }
  const work = inspected.board.workItems.find((item) => item.id === options.work);
  if (!work) {
    return refusedMutation({
      command: "milestone add",
      options,
      reason: `Work Item ${options.work} does not exist.`,
      nextAction: "Create the Work Item before adding it to Milestone scope.",
    });
  }

  const body = refreshMilestoneScope(
    milestone.body,
    inspected.board.workItems,
    { addWorkId: options.work },
  ).body;
  const metadata = { ...milestone.metadata, updated: options.date };
  const content = `${stringifyFrontmatter(metadata, MILESTONE_ORDER)}${body}`;
  const milestonePath = boardRelative(inspected.board, milestone.filePath);
  const plan = await createMutationPlan(options, [
    { type: "write-file", path: milestonePath, content, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "milestone add",
    options,
    plan,
    applyResult,
    artifacts: [{ kind: "milestone", path: milestonePath }],
    reportFields: {
      membership: { milestone: options.milestone, work: options.work },
    },
    nextAction: options.apply
      ? "Work Item is in Milestone scope."
      : "Run milestone add --apply to update Milestone scope.",
  });
}

async function runShow(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "milestone show",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const milestone = inspected.board.milestones.find(
    (item) => item.id === options.id,
  );
  if (!milestone) {
    return refusedMutation({
      command: "milestone show",
      options,
      reason: `Milestone ${options.id} does not exist.`,
      nextAction: "Run catpaw status to inspect active Milestones.",
    });
  }
  const scope = parseMilestoneScope(milestone.body).rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    notes: row.notes,
  }));
  return {
    exitCode: 0,
    report: {
      command: "milestone show",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      status: "ok",
      milestone: {
        id: milestone.id,
        title: artifactTitle(milestone),
        status: milestone.status,
        target: milestone.target,
        scope,
        path: boardRelative(inspected.board, milestone.filePath),
      },
      nextAction: ["done", "cancelled"].includes(milestone.status)
        ? "No action required."
        : "Continue the scoped Work.",
    },
  };
}

async function runClose(options) {
  const command = options.invokedAs === "milestone finish"
    ? "milestone finish"
    : options.invokedAs === "milestone cancel"
      ? "milestone cancel"
      : "milestone close";
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    command,
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const milestone = inspected.board.milestones.find(
    (item) => item.id === options.id,
  );
  if (!milestone) {
    return refusedMutation({
      command,
      options,
      reason: `Milestone ${options.id} does not exist.`,
      nextAction: "Create or select an existing Milestone.",
    });
  }
  if (
    ["done", "cancelled"].includes(milestone.status) &&
    milestone.status !== options.status
  ) {
    return refusedMutation({
      command,
      options,
      reason: `Milestone ${options.id} is already ${milestone.status}.`,
      nextAction: "Use the existing terminal status.",
    });
  }
  const milestonePath = boardRelative(inspected.board, milestone.filePath);
  if (["done", "cancelled"].includes(milestone.status)) {
    const plan = await createMutationPlan(options, []);
    const applyResult = await applyMutationPlan(plan, options);
    return mutationResult({
      command,
      options,
      plan,
      applyResult,
      artifacts: [{ kind: "milestone", path: milestonePath }],
      reportFields: {
        closure: { id: options.id, status: options.status },
      },
      nextAction: `Milestone is already ${options.status}.`,
    });
  }

  const scoped = parseMilestoneScope(milestone.body).rows.map((row) => row.id);
  const scopedSet = new Set(scoped);
  const nonTerminal = inspected.board.workItems
    .filter(
      (item) => scopedSet.has(item.id) && !["done", "cancelled"].includes(item.status),
    )
    .map((item) => item.id)
    .sort((left, right) => left.localeCompare(right, "en"));
  const gate = { scoped, nonTerminal };
  if (options.status === "done" && scoped.length === 0) {
    return refusedMutation({
      command,
      options,
      reason: "Milestone done requires at least one scoped Work Item.",
      reportFields: { gate },
      nextAction: "Add at least one Work Item to Milestone scope.",
    });
  }
  if (options.status === "done" && nonTerminal.length > 0) {
    return refusedMutation({
      command,
      options,
      reason: "Milestone has non-terminal scoped Work Items.",
      reportFields: { gate },
      nextAction: "Close or cancel every scoped Work Item first.",
    });
  }

  const metadata = {
    ...milestone.metadata,
    status: options.status,
    updated: options.date,
    closed: options.date,
  };
  const body = refreshMilestoneScope(
    milestone.body,
    inspected.board.workItems,
  ).body;
  const content = `${stringifyFrontmatter(metadata, MILESTONE_ORDER)}${body}`;
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    milestones: [{
      ...metadata,
      boardRelativePath: milestonePath,
    }],
  });
  const plan = await createMutationPlan(options, [
    { type: "write-file", path: milestonePath, content, mode: "replace" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command,
    options,
    plan,
    applyResult,
    artifacts: [{ kind: "milestone", path: milestonePath }],
    reportFields: {
      closure: { id: options.id, status: options.status },
      gate,
    },
    nextAction: options.apply
      ? `Milestone is ${options.status}.`
      : command === "milestone close"
        ? "Run milestone close --apply to close the Milestone."
        : `Run catpaw ${command} with the same arguments and --apply.`,
  });
}

export async function runMilestoneCommand(options) {
  if (options.command === "start") return runStart(options);
  if (options.command === "show") return runShow(options);
  if (options.command === "add") return runAdd(options);
  if (options.command === "close") return runClose(options);
  throw new TypeError(`Unsupported milestone command: ${options.command}`);
}
