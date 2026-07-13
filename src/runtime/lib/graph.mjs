import {
  hasMilestoneScopeMarkers,
  parseMilestoneScope,
} from "./milestone-scope.mjs";

const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
const LEGACY_WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]+$/;

export function milestoneWorkIds(body) {
  if (hasMilestoneScopeMarkers(body)) {
    try {
      return parseMilestoneScope(body).rows.map((row) => row.id);
    } catch {
      return [];
    }
  }
  const ids = [];
  const seen = new Set();

  for (const match of body.matchAll(/^\|\s*((?:FR|BUG|CHORE)-[0-9]{3,})\s*\|/gm)) {
    if (seen.has(match[1])) continue;
    ids.push(match[1]);
    seen.add(match[1]);
  }

  return ids;
}

export function legacyMilestoneWorkIds(text) {
  return [
    ...new Set(
      [...text.matchAll(/\b(?:FR|BUG|CHORE)-[0-9]+\b/g)].map((match) => match[0]),
    ),
  ];
}

export function workIdsFromBasename(filePath) {
  const basename = String(filePath ?? "").split(/[\\/]/).at(-1) ?? "";
  return [
    ...basename.matchAll(
      /(?:^|[^A-Za-z0-9])((?:FR|BUG|CHORE)-[0-9]+)(?=$|[^A-Za-z0-9])/g,
    ),
  ].map((match) => match[1]);
}

export function artifactReferencesWork(artifact, workId) {
  const referenceFields = ["req", "work"].filter((field) =>
    Object.hasOwn(artifact, field)
  );
  if (referenceFields.length > 0) {
    return referenceFields.some((field) => artifact[field] === workId);
  }

  return workIdsFromBasename(artifact.path ?? artifact.filePath).includes(workId);
}

function node(kind, id, artifact) {
  return {
    kind,
    id,
    path: artifact.path,
    artifact,
  };
}

function endpoint(kind, id, artifact) {
  return {
    kind,
    id,
    path: artifact?.path ?? null,
  };
}

function edge(relation, sourceKind, sourceId, source, workId, workItemsById) {
  const targets = workItemsById.get(workId) ?? [];
  const resolution = targets.length === 0
    ? "missing"
    : targets.length === 1
      ? "resolved"
      : "ambiguous";
  const target = resolution === "resolved" ? targets[0] : null;
  return {
    relation,
    from: endpoint(sourceKind, sourceId, source),
    to: endpoint("workItem", workId, target),
    resolved: resolution === "resolved",
    ambiguous: resolution === "ambiguous",
    resolution,
    targetPaths: targets.map((item) => item.path),
  };
}

export function buildArtifactGraph(board) {
  const workIdPattern = board.schema === 1 ? LEGACY_WORK_ID_PATTERN : WORK_ID_PATTERN;
  const workItemsById = new Map();
  for (const workItem of board.workItems ?? []) {
    if (typeof workItem.id === "string" && workIdPattern.test(workItem.id)) {
      workItemsById.set(workItem.id, [
        ...(workItemsById.get(workItem.id) ?? []),
        workItem,
      ]);
    }
  }
  const duplicates = [...workItemsById]
    .filter(([, workItems]) => workItems.length > 1)
    .map(([id, workItems]) => ({
      kind: "workItem",
      id,
      paths: workItems.map((item) => item.path).sort(),
    }))
    .sort((left, right) => {
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    });

  const nodes = [];
  for (const milestone of board.milestones ?? []) {
    nodes.push(node("milestone", milestone.id ?? milestone.path, milestone));
  }
  for (const workItem of board.workItems ?? []) {
    nodes.push(node("workItem", workItem.id ?? workItem.path, workItem));
  }
  for (const plan of board.plans ?? []) {
    nodes.push(node("plan", plan.path, plan));
  }
  for (const evidence of board.evidence ?? []) {
    nodes.push(node("evidence", evidence.path, evidence));
  }
  nodes.sort((left, right) => {
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });

  const edges = [];
  for (const milestone of board.milestones ?? []) {
    const workIds = board.schema === 1
      ? legacyMilestoneWorkIds(milestone.text ?? "")
      : milestoneWorkIds(milestone.body ?? "");
    for (const workId of workIds) {
      edges.push(
        edge(
          "milestone-work",
          "milestone",
          milestone.id ?? milestone.path,
          milestone,
          workId,
          workItemsById,
        ),
      );
    }
  }

  for (const plan of board.plans ?? []) {
    const workId = board.schema === 1 ? plan.req : plan.work;
    if (typeof workId !== "string" || !workIdPattern.test(workId)) continue;
    edges.push(edge("plan-work", "plan", plan.path, plan, workId, workItemsById));
  }

  for (const evidence of board.evidence ?? []) {
    const workId = board.schema === 1 ? evidence.req : evidence.work;
    if (typeof workId !== "string" || !workIdPattern.test(workId)) continue;
    edges.push(
      edge("evidence-work", "evidence", evidence.path, evidence, workId, workItemsById),
    );
  }

  return { nodes, edges, duplicates };
}
