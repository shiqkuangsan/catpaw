import {
  managedTableCell,
  workflowError,
} from "./workflow.mjs";
import {
  parseMilestoneScope,
  SCOPE_DIVIDER,
  SCOPE_HEADER,
} from "../milestone-scope.mjs";

function scopeError(message) {
  return workflowError("ERR_WORKFLOW_MILESTONE_SCOPE", message);
}

function titleOf(workItem) {
  const heading = workItem.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!heading) return workItem.id;
  return heading
    .replace(new RegExp(`^${workItem.id}(?::|\\s+-)?\\s*`), "")
    .trim() || workItem.id;
}

export { parseMilestoneScope } from "../milestone-scope.mjs";

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
