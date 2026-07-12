import path from "node:path";

import {
  COMPLETION_EVIDENCE,
  completionEvidenceState,
} from "../completion-evidence.mjs";
import { stringifyFrontmatter } from "../frontmatter.mjs";
import { loadBoardSchema } from "../schema.mjs";
import { refreshMilestoneScope } from "./milestone-scope.mjs";
import {
  applyMutationPlan,
  asciiSlug,
  createMutationPlan,
  inspectMutationBoard,
  instantiateTemplate,
  mutationResult,
  rebuildDashboard,
  refusedMutation,
  schemaRefusal,
} from "./workflow.mjs";

const WORK_ORDER = [
  "id",
  "type",
  "mode",
  "status",
  "stage",
  "created",
  "updated",
  "closed",
];
const PLAN_ORDER = ["work", "updated"];
const EVIDENCE_ORDER = [
  "type",
  "work",
  "stage",
  "created",
  "updated",
  "independent",
  "agent",
  "lens",
];
const MILESTONE_ORDER = [
  "id",
  "status",
  "created",
  "updated",
  "closed",
  "target",
];

async function runStart(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "work start",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;

  const prefix = options.id.match(/^([A-Z]+)-/)?.[1];
  const type = loadBoardSchema().constraints.workTypeByIdPrefix.mapping[prefix];
  const slug = asciiSlug(options.title);
  const basename = `${options.id}-${slug}.md`;
  const workPath = `work/${basename}`;
  const planPath = `plans/${basename}`;
  const existing = inspected.board.workItems.find((item) => item.id === options.id);
  if (existing) {
    const existingPath = boardRelative(inspected.board, existing.filePath);
    if (existingPath !== workPath) {
      return refusedMutation({
        command: "work start",
        options,
        reason: `Work Item ${options.id} already exists at ${existingPath}.`,
        nextAction: "Reuse the existing Work Item ID or choose a new ID.",
      });
    }
  }
  const metadata = {
    id: options.id,
    type,
    mode: options.mode,
    status: "active",
    stage: "plan",
    created: options.date,
    updated: options.date,
    closed: null,
  };
  const workContent = await instantiateTemplate({
    name: "work-item.md",
    kind: "workItem",
    metadata,
    order: WORK_ORDER,
    replacements: {
      WORK_ID: options.id,
      TITLE: options.title,
      PLAN_PATH: `../${planPath}`,
    },
  });
  const planContent = await instantiateTemplate({
    name: "plan.md",
    kind: "plan",
    metadata: { work: options.id, updated: options.date },
    order: PLAN_ORDER,
    replacements: {
      WORK_ID: options.id,
      TITLE: options.title,
      WORK_PATH: `../${workPath}`,
    },
  });
  const syntheticWork = {
    ...metadata,
    title: options.title,
    boardRelativePath: workPath,
  };
  const syntheticPlan = {
    work: options.id,
    boardRelativePath: planPath,
  };
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    workItems: [syntheticWork],
    plans: [syntheticPlan],
  });
  const plan = await createMutationPlan(options, [
    { type: "write-file", path: workPath, content: workContent, mode: "create" },
    { type: "write-file", path: planPath, content: planContent, mode: "create" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "work start",
    options,
    plan,
    applyResult,
    artifacts: [
      { kind: "workItem", path: workPath },
      { kind: "plan", path: planPath },
    ],
    nextAction: options.apply
      ? "Work Item is active at the plan stage."
      : "Run work start --apply to create the Work Item and Plan.",
  });
}

function boardRelative(board, filePath) {
  return path.relative(board.boardPath, filePath).split(path.sep).join("/");
}

async function terminalNoop(options, work, board, workPath) {
  const evidenceState = completionEvidenceState(board, work.id);
  const gapReasons = evidenceState.gapReasons;
  if (options.acceptGap !== null) {
    if (work.mode !== "gated" || options.status !== "done") {
      return refusedMutation({
        command: "work close",
        options,
        reason: "--accept-gap requires a Gated done closure with missing required Evidence.",
        nextAction: "Remove --accept-gap for this terminal Work Item.",
      });
    }
    if (!gapReasons.includes(options.acceptGap)) {
      return refusedMutation({
        command: "work close",
        options,
        reason: "--accept-gap does not match an existing accepted Gated gap.",
        nextAction: "Reuse the recorded accepted-gap reason or omit --accept-gap.",
      });
    }
  }

  const missing = work.mode === "gated" && options.status === "done"
    ? evidenceState.missing
    : [];
  const acceptedGap = gapReasons.length > 0;
  const plan = await createMutationPlan(options, []);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "work close",
    options,
    plan,
    applyResult,
    artifacts: [{ kind: "workItem", path: workPath }],
    reportFields: {
      closure: { id: options.id, status: options.status, acceptedGap },
      ...(work.mode === "gated" && options.status === "done"
        ? {
          gate: {
            required: COMPLETION_EVIDENCE,
            missing,
            acceptedGap,
            ...(options.acceptGap !== null ? { reason: options.acceptGap } : {}),
          },
        }
        : {}),
    },
    nextAction: `Work Item is already ${options.status}.`,
  });
}

function milestoneScopeUpdates(board, workMetadata, date) {
  const workItems = board.workItems.map((item) =>
    item.id === workMetadata.id ? { ...item, ...workMetadata } : item
  );
  const operations = [];
  const artifacts = [];
  for (const milestone of board.milestones) {
    if (["done", "cancelled"].includes(milestone.status)) continue;
    const refreshed = refreshMilestoneScope(milestone.body, workItems);
    if (!refreshed.workIds.includes(workMetadata.id)) continue;
    const milestonePath = boardRelative(board, milestone.filePath);
    const metadata = { ...milestone.metadata, updated: date };
    operations.push({
      type: "write-file",
      path: milestonePath,
      content: `${stringifyFrontmatter(metadata, MILESTONE_ORDER)}${refreshed.body}`,
      mode: "replace",
    });
    artifacts.push({ kind: "milestone", path: milestonePath });
  }
  return { operations, artifacts };
}

async function runClose(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "work close",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const work = inspected.board.workItems.find((item) => item.id === options.id);
  if (!work) {
    return refusedMutation({
      command: "work close",
      options,
      reason: `Work Item ${options.id} does not exist.`,
      nextAction: "Create or select an existing Work Item.",
    });
  }
  if (
    ["done", "cancelled"].includes(work.status) &&
    work.status !== options.status
  ) {
    return refusedMutation({
      command: "work close",
      options,
      reason: `Work Item ${options.id} is already ${work.status}.`,
      nextAction: "Use the existing terminal status.",
    });
  }
  const workPath = boardRelative(inspected.board, work.filePath);
  if (["done", "cancelled"].includes(work.status)) {
    return terminalNoop(options, work, inspected.board, workPath);
  }
  const missing = work.mode === "gated" && options.status === "done"
    ? completionEvidenceState(inspected.board, options.id).missing
    : [];
  if (
    options.acceptGap !== null &&
    !(work.mode === "gated" && options.status === "done" && missing.length > 0)
  ) {
    return refusedMutation({
      command: "work close",
      options,
      reason: "--accept-gap requires a Gated done closure with missing required Evidence.",
      nextAction: "Remove --accept-gap or use it only to record an actual Gated completion gap.",
    });
  }
  if (missing.length > 0 && !options.acceptGap) {
    return refusedMutation({
      command: "work close",
      options,
      reason: "Gated Work Item is missing required completion Evidence.",
      reportFields: {
        gate: {
          required: COMPLETION_EVIDENCE,
          missing,
          acceptedGap: false,
        },
      },
      nextAction: "Add the missing Evidence or pass --accept-gap with a reason.",
    });
  }

  const metadata = {
    ...work.metadata,
    status: options.status,
    stage: "reflect",
    updated: options.date,
    closed: options.date,
  };
  const content = `${stringifyFrontmatter(metadata, WORK_ORDER)}${work.body}`;
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    workItems: [{
      ...metadata,
      boardRelativePath: workPath,
    }],
  });
  const milestoneUpdates = milestoneScopeUpdates(
    inspected.board,
    metadata,
    options.date,
  );
  const acceptedGap = missing.length > 0 && options.acceptGap !== null;
  const gapPath = `evidence/${options.id}/${options.date}-reflection-accepted-gap.md`;
  const gapOperations = [];
  if (acceptedGap) {
    const gapMetadata = {
      type: "reflection",
      work: options.id,
      stage: "reflect",
      created: options.date,
      updated: options.date,
      independent: false,
      agent: null,
      lens: null,
    };
    const gapContent = await instantiateTemplate({
      name: "evidence.md",
      kind: "evidence",
      metadata: gapMetadata,
      order: EVIDENCE_ORDER,
      replacements: {
        TITLE: `Accepted Gap: ${options.id}`,
        BODY: [
          "Missing gates:",
          ...missing.map((item) => `- ${item}`),
          "",
          `Accepted reason: ${options.acceptGap}`,
          "",
          "Does not authorize Git, push, PR, deploy, or external actions.",
        ].join("\n"),
      },
    });
    gapOperations.push(
      { type: "ensure-dir", path: `evidence/${options.id}` },
      { type: "write-file", path: gapPath, content: gapContent, mode: "create" },
    );
  }
  const plan = await createMutationPlan(options, [
    ...gapOperations,
    ...milestoneUpdates.operations,
    { type: "write-file", path: workPath, content, mode: "replace" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "work close",
    options,
    plan,
    applyResult,
    artifacts: [
      { kind: "workItem", path: workPath },
      ...(acceptedGap ? [{ kind: "evidence", path: gapPath }] : []),
      ...milestoneUpdates.artifacts,
    ],
    reportFields: {
      closure: {
        id: options.id,
        status: options.status,
        acceptedGap,
      },
      ...(work.mode === "gated" && options.status === "done"
        ? {
          gate: {
            required: COMPLETION_EVIDENCE,
            missing,
            acceptedGap,
            ...(acceptedGap ? { reason: options.acceptGap } : {}),
          },
        }
        : {}),
    },
    nextAction: options.apply
      ? `Work Item is ${options.status}.`
      : "Run work close --apply to close the Work Item.",
  });
}

export async function runWorkCommand(options) {
  if (options.command === "start") return runStart(options);
  if (options.command === "close") return runClose(options);
  throw new TypeError(`Unsupported work command: ${options.command}`);
}
