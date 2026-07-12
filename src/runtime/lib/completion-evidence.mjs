export const COMPLETION_EVIDENCE = Object.freeze([
  "test",
  "independent-review-or-provider",
]);

function recordSection(body) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const record = lines.findIndex((line) => line.trim() === "## Record");
  if (record !== -1) {
    const end = lines.findIndex(
      (line, index) => index > record && /^##\s+/.test(line.trim()),
    );
    return lines.slice(record + 1, end === -1 ? undefined : end).join("\n").trim();
  }

  while (lines[0]?.trim() === "") lines.shift();
  if (/^#\s+/.test(lines[0]?.trim() ?? "")) lines.shift();
  return lines.join("\n").trim();
}

export function isUsableEvidence(evidence) {
  const record = recordSection(evidence?.body);
  return record !== "" && record !== "_No body supplied._";
}

function acceptedGapRecords(board, workId) {
  return board.evidence
    .filter(
      (item) =>
        item.work === workId &&
        item.type === "reflection" &&
        /-reflection-accepted-gap\.md$/.test(item.path) &&
        isUsableEvidence(item),
    )
    .map((item) => {
      const record = recordSection(item.body);
      const reason = record
        .match(/^Accepted reason:[ \t]*(\S(?:.*\S)?)[ \t]*$/m)?.[1]
        ?.trim();
      const lines = record.split("\n");
      const heading = lines.findIndex(
        (line) => line.trim() === "Missing gates:",
      );
      const missing = [];
      if (heading !== -1) {
        for (const line of lines.slice(heading + 1)) {
          const match = line.match(/^[ \t]*-[ \t]+(\S(?:.*\S)?)[ \t]*$/);
          if (!match) break;
          missing.push(match[1]);
        }
      }
      return reason && missing.length > 0 ? { reason, missing } : null;
    })
    .filter(Boolean);
}

export function acceptedGapReasons(board, workId, missing = COMPLETION_EVIDENCE) {
  if (missing.length === 0) return [];
  return acceptedGapRecords(board, workId)
    .filter((gap) => missing.every((gate) => gap.missing.includes(gate)))
    .map((gap) => gap.reason);
}

export function completionEvidenceState(board, workId) {
  const evidence = board.evidence.filter(
    (item) => item.work === workId && isUsableEvidence(item),
  );
  const missing = [];
  if (!evidence.some((item) => item.type === "test")) missing.push("test");
  if (!evidence.some(
    (item) =>
      ["review", "provider"].includes(item.type) &&
      item.independent === true &&
      typeof item.agent === "string" &&
      item.agent.trim() !== "",
  )) {
    missing.push("independent-review-or-provider");
  }
  const gapReasons = acceptedGapReasons(board, workId, missing);
  return {
    missing,
    acceptedGap: gapReasons.length > 0,
    gapReasons,
  };
}
