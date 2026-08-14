import path from "node:path";

const STAGE_TO_PHASE = Object.freeze({
  think: "Understand",
  plan: "Understand",
  build: "Execute",
  review: "Check",
  test: "Check",
  ship: "Finish",
  reflect: "Finish",
});

const PHASE_TO_STAGE = Object.freeze({
  understand: "plan",
  execute: "build",
  check: "test",
  finish: "ship",
});

const PROGRESS_START = "<!-- catpaw:work-progress:start -->";
const PROGRESS_END = "<!-- catpaw:work-progress:end -->";

export function visiblePhase(stage) {
  return STAGE_TO_PHASE[stage] ?? "Understand";
}

export function storedStage(phase) {
  return PHASE_TO_STAGE[phase] ?? null;
}

export function visibleRisk(mode) {
  return mode === "gated" ? "High" : "Normal";
}

export function publicCliText(value) {
  return String(value ?? "")
    .replace(/\bWork Items\b/g, "Work")
    .replace(/\bWork Item\b/g, "Work")
    .replace(/\bGated\b/g, "High-risk")
    .replace(/\bEvidence\b/g, "Proof")
    .replace(/^Run (board|work|milestone|proof|evidence|agent)\b/, "Run catpaw $1");
}

export function artifactTitle(artifact) {
  if (artifact?.title) return artifact.title;
  const heading = artifact?.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!heading) return artifact?.id ?? "Untitled";
  if (!artifact?.id) return heading;
  return heading
    .replace(new RegExp(`^${artifact.id}(?::|\\s+-)?\\s*`), "")
    .trim() || artifact.id;
}

export function workNext(body) {
  const text = String(body ?? "");
  const start = text.indexOf(PROGRESS_START);
  const end = text.indexOf(PROGRESS_END);
  const source = start !== -1 && end > start
    ? text.slice(start + PROGRESS_START.length, end)
    : text;
  const match = source.match(/^- Next:[ \t]*(.*)$/m);
  return match?.[1]?.trim() || "Not recorded";
}

function progressBlock(phase, next) {
  return [
    "## Progress",
    "",
    PROGRESS_START,
    `- Phase: ${phase}`,
    `- Next: ${next ?? ""}`,
    PROGRESS_END,
  ].join("\n");
}

export function updateWorkProgress(body, { phase, next }) {
  const text = String(body ?? "");
  const block = progressBlock(phase, next === "Not recorded" ? "" : next);
  const start = text.indexOf(PROGRESS_START);
  const end = text.indexOf(PROGRESS_END);
  const startCount = text.split(PROGRESS_START).length - 1;
  const endCount = text.split(PROGRESS_END).length - 1;
  if (
    startCount > 1 ||
    endCount > 1 ||
    (startCount === 1) !== (endCount === 1) ||
    (start !== -1 && end < start)
  ) {
    const error = new Error(
      "Work contains duplicate, incomplete, or out-of-order progress markers.",
    );
    error.code = "ERR_WORKFLOW_PROGRESS_MARKER";
    throw error;
  }
  if (start !== -1 && end !== -1 && end >= start) {
    const heading = text.lastIndexOf("## Progress", start);
    const replaceStart = heading === -1 ? start : heading;
    const replaceEnd = end + PROGRESS_END.length;
    return `${text.slice(0, replaceStart)}${block}${text.slice(replaceEnd)}`;
  }

  const scope = text.search(/^## Scope[ \t]*$/m);
  if (scope !== -1) {
    return `${text.slice(0, scope)}${block}\n\n${text.slice(scope)}`;
  }
  const suffix = text.endsWith("\n") ? "\n" : "\n\n";
  return `${text}${suffix}${block}\n`;
}

export function workSummary(work, boardPath = null) {
  const relativePath = boardPath && work.filePath
    ? path.relative(boardPath, work.filePath).split(path.sep).join("/")
    : work.path;
  return {
    id: work.id,
    title: artifactTitle(work),
    status: work.status,
    phase: visiblePhase(work.stage),
    risk: visibleRisk(work.mode),
    next: workNext(work.body),
    path: relativePath,
  };
}
