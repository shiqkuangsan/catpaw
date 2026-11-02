// LOG.md: append-only entries. Each entry starts with a machine-readable
// comment followed by a human heading and free-form body.

import { readFile } from "node:fs/promises";
import { appendText } from "./fsutil.mjs";

const MARKER = "<!-- catpaw ";
const MARKER_PATTERN = /^<!-- catpaw (\{.*\}) -->$/;

export const KINDS = new Set(["check", "note", "gap", "done", "blocked", "reopened", "dropped"]);
export const RESULTS = new Set(["passed", "failed", "blocked", "not-run"]);
export const BY = new Set(["self", "independent"]);

function heading(entry) {
  const at = entry.at.replace("T", " ").replace(/:\d{2}(\.\d+)?Z$/, "Z");
  if (entry.kind === "check") return `### ${at} · check ${entry.result} (${entry.by})`;
  return `### ${at} · ${entry.kind}`;
}

export function formatEntry(entry, body = "") {
  const safeBody = body.replaceAll(MARKER, "<!-- (catpaw) ").trim();
  return `${MARKER}${JSON.stringify(entry)} -->\n${heading(entry)}\n\n${safeBody ? `${safeBody}\n` : ""}\n`;
}

export function parseLog(text) {
  const entries = [];
  let current = null;
  for (const line of text.split("\n")) {
    // Bodies escape the marker, so any raw marker line starts an entry; one
    // that does not parse becomes an invalid entry instead of body text.
    if (line.startsWith(MARKER)) {
      if (current) entries.push(current);
      let meta;
      try {
        meta = JSON.parse(line.match(MARKER_PATTERN)[1]);
      } catch {
        meta = { kind: "invalid" };
      }
      current = { ...meta, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) entries.push(current);
  return entries.map((entry) => ({
    ...entry,
    body: entry.body.slice(1).join("\n").trim(),
  }));
}

export async function readLog(file) {
  try {
    return parseLog(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendEntry(file, entry, body) {
  await appendText(file, formatEntry(entry, body));
}
