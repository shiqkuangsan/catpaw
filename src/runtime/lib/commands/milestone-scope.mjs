import {
  managedTableCell,
  markerOccurrenceCount,
  workflowError,
} from "./workflow.mjs";

const SCOPE_START = "<!-- catpaw:milestone-scope:start -->";
const SCOPE_END = "<!-- catpaw:milestone-scope:end -->";
const SCOPE_HEADER = "| Work Item ID | Title | Status | Notes |";
const SCOPE_DIVIDER = "|---|---|---|---|";
const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
const WORK_STATUSES = new Set(["active", "blocked", "done", "cancelled"]);

function scopeError(message) {
  return workflowError("ERR_WORKFLOW_MILESTONE_SCOPE", message);
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

function titleOf(workItem) {
  const heading = workItem.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!heading) return workItem.id;
  return heading
    .replace(new RegExp(`^${workItem.id}(?::|\\s+-)?\\s*`), "")
    .trim() || workItem.id;
}

export function parseMilestoneScope(body) {
  const startCount = markerOccurrenceCount(body, SCOPE_START);
  const endCount = markerOccurrenceCount(body, SCOPE_END);
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

export function refreshMilestoneScope(body, workItems, { addWorkId } = {}) {
  const parsed = parseMilestoneScope(body);
  const notesById = new Map(parsed.rows.map((row) => [row.id, row.notes]));
  const ids = new Set(parsed.rows.map((row) => row.id));
  if (addWorkId !== undefined) ids.add(addWorkId);
  const workById = new Map(workItems.map((item) => [item.id, item]));
  const rows = [...ids]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((id) => {
      const workItem = workById.get(id);
      if (!workItem) {
        throw scopeError(`Milestone Scope references missing Work Item ${id}.`);
      }
      return `| ${id} | ${managedTableCell(titleOf(workItem))} | ${workItem.status} | ${notesById.get(id) ?? ""} |`;
    });
  const table = [SCOPE_HEADER, SCOPE_DIVIDER, ...rows].join("\n");
  const nextBody = `${body.slice(0, parsed.contentStart)}\n${table}\n${body.slice(parsed.endIndex)}`;
  return { body: nextBody, workIds: [...ids].sort() };
}
