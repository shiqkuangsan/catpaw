export const SCOPE_START = "<!-- catpaw:milestone-scope:start -->";
export const SCOPE_END = "<!-- catpaw:milestone-scope:end -->";
export const SCOPE_HEADER = "| Work Item ID | Title | Status | Notes |";
export const SCOPE_DIVIDER = "|---|---|---|---|";

const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
const WORK_STATUSES = new Set(["active", "blocked", "done", "cancelled"]);

function scopeError(message) {
  const error = new Error(message);
  error.code = "ERR_WORKFLOW_MILESTONE_SCOPE";
  return error;
}

function occurrenceCount(text, token) {
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(token, index)) !== -1) {
    count += 1;
    index += token.length;
  }
  return count;
}

function parseRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) {
    throw scopeError("Milestone Scope table is malformed.");
  }
  const cells = [];
  let cell = "";
  for (let index = 1; index < line.length - 1; index += 1) {
    const character = line[index];
    if (character === "\\" && index + 1 < line.length - 1) {
      cell += character + line[index + 1];
      index += 1;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  if (cells.length !== 4) {
    throw scopeError("Milestone Scope table is malformed.");
  }
  return cells;
}

export function hasMilestoneScopeMarkers(body) {
  return body.includes(SCOPE_START) || body.includes(SCOPE_END);
}

export function parseMilestoneScope(body) {
  const startCount = occurrenceCount(body, SCOPE_START);
  const endCount = occurrenceCount(body, SCOPE_END);
  const startIndex = body.indexOf(SCOPE_START);
  const endIndex = body.indexOf(SCOPE_END);
  if (startCount !== 1 || endCount !== 1 || endIndex < startIndex) {
    throw scopeError(
      "Milestone must contain exactly one ordered Scope marker block.",
    );
  }

  const contentStart = startIndex + SCOPE_START.length;
  const managed = body.slice(contentStart, endIndex).replaceAll("\r\n", "\n");
  if (!managed.startsWith("\n") || !managed.endsWith("\n")) {
    throw scopeError("Milestone Scope table is malformed.");
  }
  const lines = managed.slice(1, -1).split("\n");
  if (lines[0] !== SCOPE_HEADER || lines[1] !== SCOPE_DIVIDER) {
    throw scopeError("Milestone Scope table is malformed.");
  }

  const rows = [];
  const seen = new Set();
  for (const line of lines.slice(2)) {
    const [id, title, status, notes] = parseRow(line);
    if (
      !WORK_ID_PATTERN.test(id) ||
      title === "" ||
      !WORK_STATUSES.has(status) ||
      seen.has(id)
    ) {
      throw scopeError("Milestone Scope table is malformed.");
    }
    seen.add(id);
    rows.push({ id, title, status, notes });
  }
  return { rows, startIndex, endIndex, contentStart };
}
