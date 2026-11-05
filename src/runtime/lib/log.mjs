// Each LOG.md entry starts with a machine-readable comment, a heading and
// a free-form body. Schema 4 puts new entries at the top.

import { readFile } from "node:fs/promises";
import { appendText, writeAtomic } from "./fsutil.mjs";

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
  return parseLog(await readLogText(file));
}

async function readLogText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function withNewline(text) {
  return text && !text.endsWith("\n") ? `${text}\n` : text;
}

// Reverse whole blocks, including malformed markers. Reformatting parsed
// entries would lose hand-edited text or make a damaged record disappear.
export function reverseLog(text) {
  const starts = [...text.matchAll(/^<!-- catpaw /gm)].map((match) => match.index);
  if (starts.length < 2) return text;
  const blocks = starts.map((start, i) => text.slice(start, starts[i + 1]));
  return text.slice(0, starts[0]) + blocks.reverse().map(withNewline).join("");
}

// The caller holds the board lock for this read and write.
export async function addEntry(file, entry, body, newestFirst) {
  const next = formatEntry(entry, body);
  const existing = await readLogText(file);
  if (!newestFirst) {
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    await appendText(file, separator + next);
    return;
  }
  const first = existing.search(/^<!-- catpaw /m);
  const offset = first === -1 ? existing.length : first;
  await writeAtomic(file, withNewline(existing.slice(0, offset)) + next + existing.slice(offset));
}
