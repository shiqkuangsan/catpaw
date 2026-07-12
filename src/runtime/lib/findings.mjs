import path from "node:path";

import { completionEvidenceState } from "./completion-evidence.mjs";
import {
  artifactReferencesWork,
  buildArtifactGraph,
  legacyMilestoneWorkIds,
} from "./graph.mjs";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const ACTIVE_STATUSES = new Set(["active", "draft"]);
const PROVIDER_STANCES = new Set(["inline", "preferred", "forced"]);
const REQUIRED_MILESTONE_FIELDS = ["id", "status", "created", "updated", "closed"];
const NON_PRIMARY_PROVIDER_PATTERN =
  /\b(current-tool subagent|subagent|Laoer|laoer|\u8001\u4e8c|second opinion|second reviewer|Laosan|laosan|\u8001\u4e09|third opinion|third reviewer|Claude Code|Codex|Gemini|cc|cx|gemini)\b/i;
const SUBAGENT_PROVIDER_PATTERN = /\b(current-tool subagent|subagent)\b/i;

export function finding(
  severity,
  code,
  req,
  area,
  filePath,
  message,
  suggestion,
  details = {},
) {
  return {
    severity,
    code,
    req,
    area,
    filePath,
    message,
    suggestion,
    ...details,
  };
}

export function frontmatterParseFinding(artifactKind, filePath, error) {
  return finding(
    "error",
    "frontmatter-parse",
    "global",
    artifactKind,
    filePath,
    `Failed to parse frontmatter: ${error.message}`,
    "Fix the frontmatter syntax before using this artifact.",
    { artifactKind },
  );
}

export function missingIndexFinding(filePath) {
  return finding(
    "error",
    "missing-index",
    "global",
    "board",
    filePath,
    "CatPaw board index.md is missing.",
    "Create .catpaw/index.md before loading board artifacts.",
    { artifactKind: "board" },
  );
}

export function schemaFindings(artifactKind, artifact, validationFindings) {
  const work = artifact.work ?? (artifactKind === "workItem" ? artifact.id : null);

  return validationFindings.map((item) =>
    finding(
      "error",
      `schema-${item.code}`,
      work ?? artifact.id ?? "global",
      artifactKind,
      artifact.path,
      item.message,
      "Update the artifact metadata to match the canonical schema.",
      {
        artifactKind,
        field: item.path,
        work,
      },
    ),
  );
}

function missingWorkItemFinding(edge) {
  const sourceLabels = {
    "milestone-work": "Milestone",
    "plan-work": "Plan",
    "evidence-work": "Evidence",
  };
  const sourceLabel = sourceLabels[edge.relation] ?? "Artifact";

  return finding(
    "error",
    "missing-work-item",
    edge.to.id,
    edge.from.kind,
    edge.from.path,
    `${sourceLabel} references missing Work Item ${edge.to.id}.`,
    "Create the Work Item or remove the stale reference.",
    {
      relation: edge.relation,
      work: edge.to.id,
    },
  );
}

function duplicateWorkItemFinding(duplicate) {
  return finding(
    "error",
    "duplicate-work-item-id",
    duplicate.id,
    "workItem",
    duplicate.paths[0],
    `Work Item ID ${duplicate.id} is declared by multiple artifacts: ${duplicate.paths.join(", ")}.`,
    "Give every Work Item a unique ID before resolving artifact links.",
    {
      work: duplicate.id,
      paths: duplicate.paths,
    },
  );
}

function indexMentionsWork(indexText, workItem) {
  return indexText.includes(workItem.id) || indexText.includes(path.basename(workItem.path));
}

function indexMentionsArtifact(indexText, artifact) {
  return indexText.includes(artifact.id) || indexText.includes(path.basename(artifact.path));
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
  for (const match of text.matchAll(pattern)) values.push(match[1].toLowerCase());
  return values;
}

function checkLegacyMilestones(board) {
  const findings = [];
  const reqsById = new Map(board.reqs.map((req) => [req.id, req]));
  const activeMilestoneReqs = new Map();

  for (const milestone of board.milestones) {
    const id = milestone.id ?? path.basename(milestone.path, ".md");
    for (const field of REQUIRED_MILESTONE_FIELDS) {
      if (Object.hasOwn(milestone, field)) continue;
      findings.push(
        finding(
          "error",
          "milestone-missing-frontmatter",
          id,
          "milestone",
          milestone.path,
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
          milestone.path,
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
          milestone.path,
          `Non-terminal milestone ${id} has closed date ${milestone.closed}.`,
          "Set closed: null until the milestone is terminal.",
        ),
      );
    }
    if (terminal && indexMentionsArtifact(board.indexText, milestone)) {
      findings.push(
        finding(
          "error",
          "index-lists-terminal-milestone",
          id,
          "index",
          board.index.path,
          `Index lists terminal milestone ${id} under active milestones.`,
          "Remove the stale active dashboard entry, then run catpaw board migrate.",
        ),
      );
    }
    if (!terminal && !indexMentionsArtifact(board.indexText, milestone)) {
      findings.push(
        finding(
          "warning",
          "active-milestone-missing-index-entry",
          id,
          "index",
          board.index.path,
          `Active milestone ${id} is not discoverable from the active dashboard.`,
          "Add it to the legacy active dashboard, then run catpaw board migrate.",
        ),
      );
    }

    const reqIds = legacyMilestoneWorkIds(milestone.text ?? "");
    for (const reqId of reqIds) {
      const req = reqsById.get(reqId);
      if (!req) {
        findings.push(
          finding(
            "error",
            "milestone-missing-req",
            id,
            "milestone",
            milestone.path,
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
            milestone.path,
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
            milestone.path,
            `Active milestone ${id} has only terminal reqs.`,
            "Migrate first; after migration, use milestone close for verified Work scope.",
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
        board.index.path,
        `Req ${reqId} appears in multiple active milestones: ${milestoneIds.join(", ")}.`,
        "Confirm this is intentional or remove duplicate milestone membership.",
      ),
    );
  }

  return findings;
}

function checkLegacyReqLifecycle(board) {
  const findings = [];

  for (const req of board.reqs) {
    if (req.terminal && !req.closed) {
      findings.push(
        finding(
          "error",
          "terminal-req-missing-closed",
          req.id,
          "req",
          req.path,
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
          req.path,
          `Non-terminal req ${req.id} has closed date ${req.closed}.`,
          "Set closed: null until the req is terminal.",
        ),
      );
    }
    if (req.terminal && indexMentionsWork(board.indexText, req)) {
      findings.push(
        finding(
          "error",
          "index-lists-terminal-req",
          req.id,
          "index",
          board.index.path,
          `Index lists terminal req ${req.id} under active work.`,
          "Remove the stale active dashboard entry, then run catpaw board migrate.",
        ),
      );
    }
  }

  return findings;
}

function checkLegacyTerminalReqArtifacts(board) {
  const findings = [];
  const terminalReqs = board.reqs.filter((req) => req.terminal);

  for (const req of terminalReqs) {
    for (const plan of board.activePlans.filter((item) => artifactReferencesWork(item, req.id))) {
      findings.push(
        finding(
          "error",
          "terminal-req-active-plan",
          req.id,
          "plan",
          plan.path,
          `Terminal req ${req.id} still has active plan ${path.basename(plan.path)}.`,
          "Archive decision-bearing plans or remove purely procedural plans after user confirmation.",
        ),
      );
    }

    for (const matrix of board.tests.filter((item) => artifactReferencesWork(item, req.id))) {
      if (!artifactHasPendingRows(matrix.text ?? "")) continue;
      findings.push(
        finding(
          "warning",
          "terminal-req-pending-tests",
          req.id,
          "tests",
          matrix.path,
          `Terminal req ${req.id} has pending test matrix rows.`,
          "Resolve pending rows or record them as deferred/not addressed risk.",
        ),
      );
    }

    for (const review of board.reviews.filter((item) => artifactReferencesWork(item, req.id))) {
      if (!(review.text ?? "").includes("plans/active/")) continue;
      findings.push(
        finding(
          "warning",
          "review-points-active-plan",
          req.id,
          "review",
          review.path,
          `Review still points to active plan for terminal req ${req.id}.`,
          "Update review links to the archived plan path when a plan is archived.",
        ),
      );
    }
  }

  return findings;
}

function checkLegacyProviderGates(board) {
  const findings = [];
  const reqsById = new Map(board.reqs.map((req) => [req.id, req]));

  for (const plan of board.plans) {
    const req = reqsById.get(plan.req);
    if (req?.level !== "L3") continue;
    if (hasNonPrimaryProvider(plan.text ?? "") || hasAcceptedProviderGap(plan.text ?? "")) {
      continue;
    }

    findings.push(
      finding(
        "error",
        "l3-plan-missing-provider-gate",
        req.id,
        "plan",
        plan.path,
        `L3 plan for ${req.id} does not name a non-primary provider or accepted provider gap.`,
        "Add non-primary Agent evidence or an explicitly accepted gap before migration.",
      ),
    );
  }

  for (const review of board.reviews) {
    if (!isFormalReview(review)) continue;
    if (hasNonPrimaryProvider(review.text ?? "") || hasAcceptedProviderGap(review.text ?? "")) {
      continue;
    }

    findings.push(
      finding(
        "error",
        "formal-review-missing-non-primary-provider",
        review.req ?? "global",
        "review",
        review.path,
        "Formal review does not include a non-primary provider or accepted provider gap.",
        "Record a non-primary provider in Participants or an explicitly accepted Provider gaps entry.",
      ),
    );
  }

  return findings;
}

function checkLegacyProviderStanceValues(board) {
  const findings = [];
  const providerArtifacts = [...board.activePlans, ...board.archivedPlans, ...board.reviews];

  for (const artifact of providerArtifacts) {
    for (const stance of providerStanceValues(artifact.text ?? "")) {
      if (PROVIDER_STANCES.has(stance)) continue;
      findings.push(
        finding(
          "error",
          "invalid-provider-stance",
          artifact.req ?? "global",
          artifact.kind === "review" ? "review" : "plan",
          artifact.path,
          `Provider stance '${stance}' is invalid; use inline, preferred, or forced.`,
          "Move skipped/unavailable/gap into provider outcome or Provider gaps, not Provider stance.",
        ),
      );
    }
  }

  return findings;
}

function checkLegacyPreferredSubagentEvidence(board) {
  const findings = [];
  const providerArtifacts = [...board.activePlans, ...board.archivedPlans, ...board.reviews];

  for (const artifact of providerArtifacts) {
    const text = artifact.text ?? "";
    if (!providerStanceValues(text).includes("preferred")) continue;
    if (hasSubagentProvider(text) || hasNonEmptySubagentSkip(text)) continue;
    findings.push(
      finding(
        "warning",
        "preferred-subagent-missing-outcome",
        artifact.req ?? "global",
        artifact.kind === "review" ? "review" : "plan",
        artifact.path,
        "Provider stance is preferred but the artifact records no subagent evidence or skip reason.",
        "Record Provider outcome: used with subagent findings, or Subagent skipped: <reason>.",
      ),
    );
  }

  return findings;
}

function checkLegacyL3TestMatrices(board) {
  const findings = [];

  for (const req of board.reqs) {
    if (req.level !== "L3") continue;
    if (board.tests.some((matrix) => artifactReferencesWork(matrix, req.id))) continue;
    findings.push(
      finding(
        "error",
        "l3-req-missing-test-matrix",
        req.id,
        "tests",
        req.path,
        `L3 req ${req.id} does not have a test matrix.`,
        "Create .catpaw/tests/matrices/<req-id>-<slug>.md or de-escalate the req level.",
      ),
    );
  }

  return findings;
}

function checkLegacyPlanDirectoryStatus(board) {
  const findings = [];

  for (const plan of board.activePlans) {
    if (!TERMINAL_STATUSES.has(plan.status)) continue;
    findings.push(
      finding(
        "error",
        "active-plan-terminal-status",
        plan.req ?? "global",
        "plan",
        plan.path,
        `Plan under plans/active has terminal status ${plan.status}.`,
        "Archive decision-bearing terminal plans or restore status to active before continuing.",
      ),
    );
  }

  for (const plan of board.archivedPlans) {
    if (!ACTIVE_STATUSES.has(plan.status)) continue;
    findings.push(
      finding(
        "error",
        "archived-plan-active-status",
        plan.req ?? "global",
        "plan",
        plan.path,
        `Plan under plans/archive has non-terminal status ${plan.status}.`,
        "Move active plans back to plans/active or mark the archived plan terminal.",
      ),
    );
  }

  return findings;
}

function collectLegacyFindings(board) {
  return [
    ...checkLegacyMilestones(board),
    ...checkLegacyReqLifecycle(board),
    ...checkLegacyTerminalReqArtifacts(board),
    ...checkLegacyProviderGates(board),
    ...checkLegacyProviderStanceValues(board),
    ...checkLegacyPreferredSubagentEvidence(board),
    ...checkLegacyL3TestMatrices(board),
    ...checkLegacyPlanDirectoryStatus(board),
  ];
}

function checkSchema2CompletionEvidence(board) {
  const findings = [];
  for (const work of board.workItems) {
    if (work.mode !== "gated" || work.status !== "done") continue;
    const state = completionEvidenceState(board, work.id);
    if (state.missing.length === 0 || state.acceptedGap) continue;
    findings.push(
      finding(
        "error",
        "gated-work-missing-completion-evidence",
        work.id,
        "evidence",
        work.path,
        `Terminal Gated Work ${work.id} is missing usable completion Evidence: ${state.missing.join(", ")}.`,
        "Add substantive Evidence or record an explicitly accepted gap before treating the Work as done.",
        { work: work.id, missing: state.missing },
      ),
    );
  }
  return findings;
}

export function collectBoardFindings(board, graph = buildArtifactGraph(board)) {
  const findings = [...(board.findings ?? [])];
  findings.push(...(graph.duplicates ?? []).map(duplicateWorkItemFinding));
  if (board.schema === 1) return [...findings, ...collectLegacyFindings(board)];

  for (const edge of graph.edges) {
    if (edge.resolution === "missing") findings.push(missingWorkItemFinding(edge));
  }

  findings.push(...checkSchema2CompletionEvidence(board));

  return findings;
}
