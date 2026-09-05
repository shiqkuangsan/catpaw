import path from "node:path";
import { candidateFor } from "../candidate.mjs";

import {
  COMPLETION_EVIDENCE,
  completionEvidenceState,
} from "../completion-evidence.mjs";
import { stringifyFrontmatter } from "../frontmatter.mjs";
import {
  storedStage,
  updateWorkProgress,
  visiblePhase,
  workNext,
  workSummary,
} from "../presentation.mjs";
import { loadBoardSchema } from "../schema.mjs";
import { refreshMilestoneScope } from "./milestone-scope.mjs";
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
  const inspected = await inspectMutationBoard(options, { capturePreimage: true });
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
    contract: 4,
    acceptance: options.acceptance,
    scope: options.scope,
    owner: options.owner,
    cycle: 1,
    candidate: null,
  };
  let workContent = await instantiateTemplate({
    name: "work-item.md",
    kind: "workItem",
    metadata,
    order: WORK_ORDER,
    replacements: {
      WORK_ID: options.id,
      TITLE: neutralizeCatPawMarkers(options.title),
      PLAN_PATH: `../${planPath}`,
    },
  });
  if (!options.withPlan) workContent = workContent.replace(/\n## Links\n[\s\S]*$/, "\n");
  const planContent = options.withPlan ? await instantiateTemplate({
    name: "plan.md",
    kind: "plan",
    metadata: { work: options.id, updated: options.date },
    order: PLAN_ORDER,
    replacements: {
      WORK_ID: options.id,
      TITLE: neutralizeCatPawMarkers(options.title),
      WORK_PATH: `../${workPath}`,
    },
  }) : null;
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
    plans: options.withPlan ? [syntheticPlan] : [],
  });
  const plan = await createMutationPlan(options, inspected, [
    { type: "ensure-dir", path: "work" },
    ...(options.withPlan ? [{ type: "ensure-dir", path: "plans" }] : []),
    { type: "write-file", path: workPath, content: workContent, mode: "create" },
    ...(options.withPlan ? [{ type: "write-file", path: planPath, content: planContent, mode: "create" }] : []),
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
      ...(options.withPlan ? [{ kind: "plan", path: planPath }] : []),
    ],
    nextAction: options.apply
      ? "Work Item is active at the plan stage."
      : "Run work start --apply to create the Work.",
  });
}

function boardRelative(board, filePath) {
  return path.relative(board.boardPath, filePath).split(path.sep).join("/");
}

async function runShow(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "work show",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const work = inspected.board.workItems.find((item) => item.id === options.id);
  if (!work) {
    return refusedMutation({
      command: "work show",
      options,
      reason: `Work ${options.id} does not exist.`,
      nextAction: "Run catpaw status to inspect active Work.",
    });
  }
  const proof = inspected.board.evidence.filter((item) => item.work === work.id);
  const candidate = work.terminal ? work.candidate ?? null : await candidateFor(options, work);
  const coverage = completionEvidenceState(inspected.board, work.id, candidate);
  return {
    exitCode: 0,
    report: {
      command: "work show",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      status: "ok",
      work: workSummary(work, inspected.board.boardPath),
      candidate,
      contract: work.contract === 4 ? { version: 4, cycle: work.cycle, acceptance: work.acceptance, scope: work.scope, owner: work.owner } : { version: 3 },
      proof: {
        count: proof.length,
        types: [...new Set(proof.map((item) => item.type))].sort(),
        missingCompletion: work.mode === "gated" ? coverage.missing : [],
      },
      nextAction: workNext(work.body) === "Not recorded"
        ? "Record the next action with catpaw work update --next <text>."
        : workNext(work.body),
    },
  };
}

async function runUpdate(options) {
  const inspected = await inspectMutationBoard(options, { capturePreimage: true });
  const refusal = schemaRefusal(
    "work update",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const work = inspected.board.workItems.find((item) => item.id === options.id);
  if (!work) {
    return refusedMutation({
      command: "work update",
      options,
      reason: `Work ${options.id} does not exist.`,
      nextAction: "Run catpaw status to inspect active Work.",
    });
  }
  if (work.terminal) {
    return refusedMutation({
      command: "work update",
      options,
      reason: `Work ${options.id} is already ${work.status}.`,
      nextAction: "Select active Work or retain the terminal record.",
    });
  }

  const phase = options.phase === null
    ? visiblePhase(work.stage)
    : visiblePhase(storedStage(options.phase));
  const next = options.next === null
    ? workNext(work.body)
    : neutralizeCatPawMarkers(options.next);
  const metadata = {
    ...work.metadata,
    ...(options.phase === null ? {} : { stage: storedStage(options.phase) }),
    ...(options.status === null ? {} : { status: options.status }),
    updated: options.date,
  };
  const body = updateWorkProgress(work.body, { phase, next });
  const workPath = boardRelative(inspected.board, work.filePath);
  const content = `${stringifyFrontmatter(metadata, WORK_ORDER)}${body}`;
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    workItems: [{
      ...work,
      ...metadata,
      body,
      boardRelativePath: workPath,
    }],
  });
  const milestoneUpdates = milestoneScopeUpdates(
    inspected.board,
    metadata,
    options.date,
  );
  const plan = await createMutationPlan(options, inspected, [
    ...milestoneUpdates.operations,
    { type: "write-file", path: workPath, content, mode: "replace" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command: "work update",
    options,
    plan,
    applyResult,
    artifacts: [
      { kind: "workItem", path: workPath },
      ...milestoneUpdates.artifacts,
    ],
    reportFields: {
      work: workSummary({ ...work, ...metadata, body }, inspected.board.boardPath),
    },
    nextAction: options.apply
      ? next === "Not recorded"
        ? "Record the next action when it is known."
        : next
      : "Run catpaw work update with the same arguments and --apply.",
  });
}

async function terminalNoop(options, work, inspected, workPath, command) {
  const { board } = inspected;
  const evidenceState = completionEvidenceState(board, work.id);
  const gapReasons = evidenceState.gapReasons;
  if (options.acceptGap !== null) {
    if (work.mode !== "gated" || options.status !== "done") {
      return refusedMutation({
        command,
        options,
        reason: "--accept-gap requires a Gated done closure with missing required Evidence.",
        nextAction: "Remove --accept-gap for this terminal Work Item.",
      });
    }
    if (!gapReasons.includes(options.acceptGap)) {
      return refusedMutation({
        command,
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
  const plan = await createMutationPlan(options, inspected, []);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command,
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
  const command = options.invokedAs === "work finish"
    ? "work finish"
    : options.invokedAs === "work cancel"
      ? "work cancel"
      : "work close";
  const inspected = await inspectMutationBoard(options, { capturePreimage: true });
  const refusal = schemaRefusal(
    command,
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const work = inspected.board.workItems.find((item) => item.id === options.id);
  if (!work) {
    return refusedMutation({
      command,
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
      command,
      options,
      reason: `Work Item ${options.id} is already ${work.status}.`,
      nextAction: "Use the existing terminal status.",
    });
  }
  const workPath = boardRelative(inspected.board, work.filePath);
  if (["done", "cancelled"].includes(work.status)) {
    return terminalNoop(options, work, inspected, workPath, command);
  }
  const candidate = options.status === "done" ? await candidateFor(options, work) : null;
  const missing = work.mode === "gated" && options.status === "done"
    ? completionEvidenceState(inspected.board, options.id, candidate).missing
    : [];
  if (
    options.acceptGap !== null &&
    !(work.mode === "gated" && options.status === "done" && missing.length > 0)
  ) {
    return refusedMutation({
      command,
      options,
      reason: "--accept-gap requires a Gated done closure with missing required Evidence.",
      nextAction: "Remove --accept-gap or use it only to record an actual Gated completion gap.",
    });
  }
  if (missing.length > 0 && (!options.acceptGap || work.contract === 4)) {
    return refusedMutation({
      command,
      options,
      reason: "Gated Work Item is missing required completion Evidence.",
      reportFields: {
        gate: {
          required: COMPLETION_EVIDENCE,
          missing,
          acceptedGap: false,
        },
      },
      nextAction: work.contract === 4 ? "Record passing current-candidate Evidence. Record risk acceptance separately; it does not turn missing verification into a passed result." : "Add the missing Evidence or pass --accept-gap with a reason.",
    });
  }

  const metadata = {
    ...work.metadata,
    status: options.status,
    stage: "reflect",
    updated: options.date,
    closed: options.date,
    ...(work.contract === 4 ? { candidate } : {}),
  };
  const body = updateWorkProgress(work.body, {
    phase: "Finish",
    next: options.status === "done" ? "Completed" : "Cancelled",
  });
  const content = `${stringifyFrontmatter(metadata, WORK_ORDER)}${body}`;
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, {
    workItems: [{
      ...metadata,
      body,
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
  const plan = await createMutationPlan(options, inspected, [
    ...gapOperations,
    ...milestoneUpdates.operations,
    { type: "write-file", path: workPath, content, mode: "replace" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
  ]);
  const applyResult = await applyMutationPlan(plan, { ...options, validateCandidate: async ({ stageRoot }) => {
    if (options.status === "done" && candidate !== await candidateFor({ ...options, candidateExclusions: [stageRoot] }, work)) throw Object.assign(new Error("Candidate changed before completion publication."), { code: "ERR_WORKFLOW_CANDIDATE" });
  } });
  return mutationResult({
    command,
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
      : command === "work close"
        ? "Run work close --apply to close the Work Item."
        : `Run catpaw ${command} with the same arguments and --apply.`,
  });
}

async function runContinue(options) {
  const inspected = await inspectMutationBoard(options, { capturePreimage: true });
  const refusal = schemaRefusal("work continue", options, inspected.board, inspected.findings);
  if (refusal) return refusal;
  const work = inspected.board.workItems.find(item => item.id === options.id);
  if (!work?.terminal) return refusedMutation({ command: "work continue", options, reason: "Only terminal Work can start a new cycle.", nextAction: "Use work update for active Work." });
  const cycle = work.cycle ?? 0;
  const metadata = { ...work.metadata, contract: 4, acceptance: work.acceptance ?? work.id, scope: work.scope ?? ".", owner: work.owner ?? "primary", cycle: cycle + 1, candidate: null, status: "active", stage: "plan", updated: options.date, closed: null };
  const body = updateWorkProgress(work.body, { phase: "Understand", next: neutralizeCatPawMarkers(options.next) });
  const workPath = boardRelative(inspected.board, work.filePath);
  const historyPath = `evidence/${work.id}/${options.date}-reflection-closure-cycle-${cycle}.md`;
  const history = await instantiateTemplate({ name: "evidence.md", kind: "evidence", metadata: { type: "reflection", work: work.id, stage: "reflect", created: options.date, updated: options.date }, order: EVIDENCE_ORDER, replacements: { TITLE: `Closure cycle ${cycle}: ${work.id}`, BODY: `Historical closure, preserved before continuation.\n\n${work.text}` } });
  const dashboard = rebuildDashboard(inspected.board.indexText, inspected.board, { workItems: [{ ...work, ...metadata, body, boardRelativePath: workPath }] });
  const milestones = milestoneScopeUpdates(inspected.board, metadata, options.date);
  const plan = await createMutationPlan(options, inspected, [
    { type: "ensure-dir", path: `evidence/${work.id}` },
    { type: "write-file", path: historyPath, content: history, mode: "create" },
    { type: "write-file", path: workPath, content: `${stringifyFrontmatter(metadata, WORK_ORDER)}${body}`, mode: "replace" },
    { type: "write-file", path: "index.md", content: dashboard, mode: "replace" },
    ...milestones.operations,
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({ command: "work continue", options, plan, applyResult, artifacts: [{ kind: "workItem", path: workPath }, { kind: "evidence", path: historyPath }, ...milestones.artifacts], nextAction: options.apply ? options.next : "Run work continue --apply to preserve the closure and begin a new cycle." });
}

export async function runWorkCommand(options) {
  if (options.command === "start") return runStart(options);
  if (options.command === "show") return runShow(options);
  if (options.command === "update") return runUpdate(options);
  if (options.command === "close") return runClose(options);
  if (options.command === "continue") return runContinue(options);
  throw new TypeError(`Unsupported work command: ${options.command}`);
}
