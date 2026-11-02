import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { formatFrontmatter, parseFrontmatter } from "./frontmatter.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { readLog } from "./log.mjs";

export const SCHEMA = 3;
export const STATUSES = new Set(["open", "blocked", "done", "dropped"]);
export const SECTIONS = ["Goal", "Acceptance", "Gaps", "Decisions", "Next"];
const GAP_LINE = /^- \[(open|accepted)\] (G\d+): (.*)$/;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*-[A-Za-z0-9-]+$/;

export class CatpawError extends Error {
  constructor(message, code = "ERR_CATPAW") {
    super(message);
    this.code = code;
  }
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function boardPaths(projectRoot) {
  const root = path.resolve(projectRoot);
  const dir = path.join(root, ".catpaw");
  return { root, dir, marker: path.join(dir, "catpaw.json"), work: path.join(dir, "work") };
}

export async function detectSchema(projectRoot) {
  const paths = boardPaths(projectRoot);
  if (!(await exists(paths.dir))) return null;
  if (await exists(paths.marker)) {
    const marker = JSON.parse(await readFile(paths.marker, "utf8"));
    return marker.schema ?? SCHEMA;
  }
  const index = path.join(paths.dir, "index.md");
  if (await exists(index)) {
    const { data } = parseFrontmatter(await readFile(index, "utf8"));
    if (data.schema) return data.schema;
  }
  return (await exists(paths.work)) ? 2 : null;
}

export async function openBoard(projectRoot) {
  const schema = await detectSchema(projectRoot);
  const paths = boardPaths(projectRoot);
  if (schema === null) {
    throw new CatpawError(`No .catpaw board in ${paths.root}. Run 'catpaw init'.`, "ERR_NO_BOARD");
  }
  if (schema !== SCHEMA) {
    throw new CatpawError(
      `Board at ${paths.dir} uses schema ${schema}. Preview conversion with 'catpaw convert'.`,
      "ERR_SCHEMA",
    );
  }
  return paths;
}

export async function initBoard(projectRoot) {
  const paths = boardPaths(projectRoot);
  const schema = await detectSchema(projectRoot);
  if (schema === SCHEMA) return { paths, created: false };
  if (schema !== null) {
    throw new CatpawError(`Existing board uses schema ${schema}; use 'catpaw convert'.`, "ERR_SCHEMA");
  }
  await writeAtomic(paths.marker, `${JSON.stringify({ schema: SCHEMA }, null, 2)}\n`);
  return { paths, created: true };
}

export function workFiles(board, id) {
  const dir = path.join(board.work, id);
  return { dir, work: path.join(dir, "WORK.md"), log: path.join(dir, "LOG.md") };
}

export function splitSections(body) {
  const lines = body.split("\n");
  const sections = new Map();
  let title = "";
  let name = null;
  let buffer = [];
  for (const line of lines) {
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) {
      if (name) sections.set(name, buffer.join("\n").trim());
      name = heading[1];
      buffer = [];
    } else if (name) buffer.push(line);
    else if (line.startsWith("# ")) title = line.slice(2).trim();
  }
  if (name) sections.set(name, buffer.join("\n").trim());
  return { title, sections };
}

export function joinSections(heading, sections) {
  const names = [...SECTIONS, ...[...sections.keys()].filter((key) => !SECTIONS.includes(key))];
  const parts = [`# ${heading}`];
  for (const name of names) parts.push(`## ${name}\n\n${sections.get(name) ?? ""}`.trimEnd());
  return `${parts.join("\n\n")}\n`;
}

export function parseGaps(text = "") {
  return text
    .split("\n")
    .map((line) => line.match(GAP_LINE))
    .filter(Boolean)
    .map(([, state, id, rest]) => ({ id, state, text: rest }));
}

export async function readWork(board, id) {
  const files = workFiles(board, id);
  let text;
  try {
    text = await readFile(files.work, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new CatpawError(`Unknown Work ${id}.`, "ERR_UNKNOWN_WORK");
    throw error;
  }
  const { data, body } = parseFrontmatter(text);
  const { sections } = splitSections(body);
  return {
    id,
    files,
    data,
    sections,
    gaps: parseGaps(sections.get("Gaps")),
    log: await readLog(files.log),
  };
}

export async function writeWork(work) {
  const data = { ...work.data, updated: today() };
  const body = joinSections(`${data.id}: ${data.title}`, work.sections);
  await writeAtomic(work.files.work, formatFrontmatter(data, body));
  work.data = data;
}

export async function listWorkIds(board) {
  try {
    const entries = await readdir(board.work, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort(compareIds);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export function compareIds(a, b) {
  return a.localeCompare(b, "en", { numeric: true });
}

export async function nextId(board) {
  const ids = await listWorkIds(board);
  const max = ids.reduce((top, id) => Math.max(top, Number(id.match(/^W-(\d+)$/)?.[1] ?? 0)), 0);
  return `W-${String(max + 1).padStart(3, "0")}`;
}

export function validateId(id) {
  if (!ID_PATTERN.test(id)) throw new CatpawError(`Invalid Work id '${id}'.`, "ERR_ARGS");
  return id;
}
