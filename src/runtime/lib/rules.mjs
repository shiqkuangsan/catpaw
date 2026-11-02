// Completion rules 2–4 from ADR-0035, evaluated against one snapshot.

import { GAP_LINE, RISKS, STATUSES } from "./board.mjs";
import { BY, KINDS, RESULTS } from "./log.mjs";

const DECISIVE = new Set(["passed", "failed", "blocked"]);

function latestDecisive(checks, by) {
  const decisive = checks.filter((c) => c.by === by && DECISIVE.has(c.result));
  return decisive.at(-1) ?? null;
}

// WORK.md is hand-editable. Anything the rules cannot read must block
// completion instead of being skipped, or a mistyped Gap would vanish.
export function formatProblems(work) {
  const problems = [];
  const { data } = work;
  if (data.id !== work.id) problems.push(`frontmatter id '${data.id}' does not match directory ${work.id}`);
  if (!STATUSES.has(data.status)) problems.push(`unknown status '${data.status}'`);
  if (data.risk != null && !RISKS.has(data.risk)) problems.push(`unknown risk '${data.risk}'`);
  const repos = data.repos;
  if (repos != null && !(Array.isArray(repos) && repos.length && repos.every((r) => typeof r === "string" && r))) {
    problems.push("repos must be a JSON array of paths");
  }
  const seen = new Set();
  for (const line of (work.sections.get("Gaps") ?? "").split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(GAP_LINE);
    if (!match) problems.push(`unreadable Gaps line: ${line.trim().slice(0, 120)}`);
    else if (seen.has(match[2])) problems.push(`duplicate gap ${match[2]}`);
    else seen.add(match[2]);
  }
  work.log.forEach((entry, index) => {
    if (!KINDS.has(entry.kind)) problems.push(`unreadable LOG.md entry ${index + 1}`);
    else if (entry.kind === "check" && !(RESULTS.has(entry.result) && BY.has(entry.by) && entry.snapshot)) {
      problems.push(`malformed check in LOG.md entry ${index + 1}`);
    }
  });
  return problems;
}

export function evaluate(work, snapshotId) {
  const problems = formatProblems(work);
  for (const gap of work.gaps) {
    if (gap.state === "open") problems.push(`open gap ${gap.id}: ${gap.text}`);
  }
  const checks = work.log.filter((e) => e.kind === "check" && e.snapshot === snapshotId);
  for (const by of ["self", "independent"]) {
    const latest = latestDecisive(checks, by);
    if (latest && latest.result !== "passed") {
      problems.push(`latest ${by} check on this snapshot is ${latest.result} (${latest.at})`);
    }
  }
  if (work.data.risk === "high") {
    for (const by of ["self", "independent"]) {
      if (!latestDecisive(checks, by)) {
        problems.push(`risk high needs a passed ${by} check on this snapshot`);
      }
    }
  }
  return problems;
}

export function lastEntry(work, kind) {
  return work.log.filter((e) => e.kind === kind).at(-1) ?? null;
}

// A done Work must carry a finish record whose snapshot still satisfies the
// rules, including failures recorded after it on that same snapshot.
export function auditDone(work) {
  if (work.data.status !== "done") return [];
  const done = lastEntry(work, "done");
  if (!done) return ["status is done without a finish record"];
  if (done.imported) return formatProblems(work);
  return evaluate(work, done.snapshot);
}
