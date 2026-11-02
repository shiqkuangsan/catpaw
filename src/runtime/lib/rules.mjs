// Completion rules 2–4 from ADR-0035, evaluated against one snapshot.

const DECISIVE = new Set(["passed", "failed", "blocked"]);

function latestDecisive(checks, by) {
  const decisive = checks.filter((c) => c.by === by && DECISIVE.has(c.result));
  return decisive.at(-1) ?? null;
}

export function evaluate(work, snapshotId) {
  const problems = [];
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
  if (done.imported) return [];
  return evaluate(work, done.snapshot);
}
