// One-shot schema 2 -> schema 3 conversion. The original board is moved,
// unchanged, to .catpaw/archive/schema-2/. Preview unless apply is set.

import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { CatpawError, SCHEMA, boardPaths, compareIds, detectSchema, joinSections, readWork } from "./board.mjs";
import { formatFrontmatter, parseFrontmatter } from "./frontmatter.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { formatEntry } from "./log.mjs";

const STATUS = { active: "open", blocked: "blocked", done: "done", cancelled: "dropped" };
const CHECK_TYPES = new Set(["test", "review", "provider", "research"]);
const DECIDED = new Set(["passed", "failed", "blocked", "not-run"]);
const SCOPE_START = "<!-- catpaw:milestone-scope:start -->";
const SCOPE_END = "<!-- catpaw:milestone-scope:end -->";

async function markdownFiles(dir) {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function load(file) {
  const text = await readFile(file, "utf8");
  return { file, text, ...parseFrontmatter(text) };
}

function titleOf(body, id, fallback) {
  const heading = body.match(/^# (.+)$/m)?.[1]?.trim() ?? "";
  const stripped = heading.replace(new RegExp(`^(Plan: )?${id}:?\\s*`), "").trim();
  return stripped || fallback || id;
}

function day(value, fallback) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : fallback;
}

function progressNext(body) {
  return body.match(/^- Next:\s*(.+)$/m)?.[1]?.trim() ?? "";
}

function scopeMembers(body) {
  const start = body.indexOf(SCOPE_START);
  const end = body.indexOf(SCOPE_END);
  if (start === -1 || end <= start) return [];
  return body
    .slice(start, end)
    .split("\n")
    .map((line) => line.match(/^\|\s*([A-Za-z]+-[0-9A-Za-z-]+)\s*\|/)?.[1])
    .filter(Boolean);
}

async function fingerprint(dir) {
  const parts = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        const info = await stat(full);
        parts.push(`${path.relative(dir, full)}:${info.size}:${info.mtimeMs}`);
      }
    }
  }
  await walk(dir);
  return parts.sort().join("\n");
}

async function plan(root) {
  const old = boardPaths(root).dir;
  const rel = (file) => path.relative(old, file);
  const works = new Map();
  const report = { checks: 0, notes: 0, failures: 0, plansAttached: 0, plansArchived: 0, topics: 0, milestones: 0 };

  for (const item of await Promise.all((await markdownFiles(path.join(old, "work"))).map(load))) {
    const id = String(item.data.id ?? path.basename(item.file).match(/^([A-Za-z]+-[0-9]+)/)?.[1] ?? "");
    if (!id) throw new CatpawError(`Cannot determine Work id for ${rel(item.file)}.`, "ERR_CONVERT");
    if (works.has(id)) throw new CatpawError(`Duplicate Work id ${id}.`, "ERR_CONVERT");
    const status = STATUS[item.data.status] ?? "open";
    const created = day(item.data.created, "1970-01-01");
    works.set(id, {
      id,
      data: {
        id,
        title: titleOf(item.body, id, item.data.acceptance),
        status,
        risk: item.data.mode === "gated" ? "high" : "normal",
        repos: ["."],
        parent: null,
        created,
        updated: day(item.data.updated, created),
      },
      acceptance: typeof item.data.acceptance === "string" ? item.data.acceptance : "",
      next: status === "open" || status === "blocked" ? progressNext(item.body) : "",
      closed: day(item.data.closed, day(item.data.updated, created)),
      entries: [{ at: created, order: 0, meta: { kind: "note", imported: true, source: rel(item.file) }, body: item.body }],
    });
  }

  for (const item of await Promise.all((await markdownFiles(path.join(old, "milestones"))).map(load))) {
    const id = String(item.data.id ?? path.basename(item.file, ".md"));
    if (works.has(id)) throw new CatpawError(`Milestone id ${id} collides with a Work id.`, "ERR_CONVERT");
    const created = day(item.data.created, "1970-01-01");
    const status = STATUS[item.data.status] ?? "open";
    works.set(id, {
      id,
      data: { id, title: titleOf(item.body, id), status, risk: "normal", repos: ["."], parent: null, created, updated: day(item.data.updated, created) },
      acceptance: "",
      next: "",
      closed: day(item.data.closed, day(item.data.updated, created)),
      entries: [{ at: created, order: 0, meta: { kind: "note", imported: true, source: rel(item.file) }, body: item.body }],
      members: scopeMembers(item.body),
    });
    report.milestones += 1;
  }
  for (const work of works.values()) {
    for (const member of work.members ?? []) {
      if (works.has(member)) works.get(member).data.parent = work.id;
    }
  }

  for (const item of await Promise.all((await markdownFiles(path.join(old, "plans"))).map(load))) {
    const owner = works.get(String(item.data.work ?? path.basename(item.file).match(/^([A-Za-z]+-[0-9]+)/)?.[1]));
    if (!owner) {
      report.plansArchived += 1;
      continue;
    }
    owner.entries.push({ at: day(item.data.updated, owner.data.created), order: 1, meta: { kind: "note", imported: true, source: rel(item.file) }, body: item.body });
    report.plansAttached += 1;
  }

  let evidenceDirs = [];
  try {
    evidenceDirs = (await readdir(path.join(old, "evidence"), { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const dir of evidenceDirs) {
    const files = await markdownFiles(path.join(old, "evidence", dir.name));
    if (dir.name === "topics") {
      report.topics += files.length;
      continue;
    }
    for (const item of await Promise.all(files.map(load))) {
      const owner = works.get(String(item.data.work ?? dir.name));
      if (!owner) throw new CatpawError(`Evidence ${rel(item.file)} has no matching Work.`, "ERR_CONVERT");
      const type = item.data.type;
      const result = item.data.result;
      const base = { imported: true, source: rel(item.file) };
      let meta;
      if (CHECK_TYPES.has(type) && DECIDED.has(result)) {
        meta = {
          kind: "check",
          result,
          by: item.data.independent === true ? "independent" : "self",
          snapshot: `schema2:${item.data.candidate ?? "none"}`,
          ...base,
        };
        if (item.data.agent) meta.actor = item.data.agent;
        report.checks += 1;
        if (result === "failed" || result === "blocked") report.failures += 1;
      } else {
        meta = { kind: "note", evidenceType: type ?? null, ...(result ? { result } : {}), ...base };
        report.notes += 1;
      }
      owner.entries.push({
        at: day(item.data.created, owner.data.created),
        order: 2 + Number(item.data.sequence ?? 0) / 1e6,
        meta,
        body: item.body,
      });
    }
  }

  for (const work of works.values()) {
    if (work.data.status === "done") work.entries.push({ at: work.closed, order: 9, meta: { kind: "done", imported: true }, body: "Imported as done from schema 2." });
    if (work.data.status === "dropped") work.entries.push({ at: work.closed, order: 9, meta: { kind: "dropped", imported: true }, body: "Imported as cancelled from schema 2." });
    work.entries.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order);
  }

  const archived = (await readdir(old)).filter((name) => !["work", "evidence", "plans", "milestones", ".DS_Store"].includes(name));
  return { old, works, report, archived };
}

function render(work) {
  const active = work.data.status === "open" || work.data.status === "blocked";
  const sections = new Map([
    ["Goal", work.data.title],
    ["Acceptance", work.acceptance ? `- ${work.acceptance}` : ""],
    ["Gaps", ""],
    ["Decisions", ""],
    ["Next", [work.next, active ? "Condense the imported schema 2 record in LOG.md into Goal, Acceptance, Gaps and Next." : ""].filter(Boolean).join("\n\n")],
  ]);
  const workText = formatFrontmatter(work.data, joinSections(`${work.id}: ${work.data.title}`, sections));
  const logText = work.entries.map((e) => formatEntry({ at: e.at, ...e.meta }, e.body)).join("");
  return { workText, logText };
}

function describe(root, result, applied) {
  const { works, report, archived } = result;
  const all = [...works.values()];
  const count = (status) => all.filter((w) => w.data.status === status).length;
  return [
    `${applied ? "Converted" : "Preview:"} schema 2 board at ${path.join(root, ".catpaw")}`,
    `  Work: ${all.length} (${count("open")} open, ${count("blocked")} blocked, ${count("done")} done, ${count("dropped")} dropped; ${all.filter((w) => w.data.risk === "high").length} risk high; ${report.milestones} from milestones)`,
    `  Evidence: ${report.checks} checks (${report.failures} failed/blocked kept), ${report.notes} notes`,
    `  Plans: ${report.plansAttached} attached to Work, ${report.plansArchived} archive-only`,
    `  Topic evidence (archive-only): ${report.topics}`,
    `  Archived as-is: ${archived.length ? archived.join(", ") : "nothing else"}`,
    "  Imported checks carry schema2 snapshots and never count as current.",
    applied
      ? "  Original board: .catpaw/archive/schema-2/"
      : "  Apply with: catpaw convert --apply",
  ].join("\n");
}

export async function convertBoard(projectRoot, { apply = false } = {}) {
  const root = path.resolve(projectRoot);
  const schema = await detectSchema(root);
  if (schema === null) throw new CatpawError(`No .catpaw board in ${root}.`, "ERR_NO_BOARD");
  if (schema === SCHEMA) return { text: `Board at ${root} already uses schema ${SCHEMA}.`, converted: false };
  if (schema !== 2) {
    throw new CatpawError(`Schema ${schema} boards are not supported; convert to schema 2 with CatPaw 4 first.`, "ERR_SCHEMA");
  }
  const before = await fingerprint(boardPaths(root).dir);
  const result = await plan(root);
  if (!apply) return { text: describe(root, result, false), converted: false, report: result.report };

  const staging = path.join(root, `.catpaw-convert-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  try {
    await writeAtomic(path.join(staging, "catpaw.json"), `${JSON.stringify({ schema: SCHEMA }, null, 2)}\n`);
    for (const work of result.works.values()) {
      const dir = path.join(staging, "work", work.id);
      const { workText, logText } = render(work);
      await writeAtomic(path.join(dir, "WORK.md"), workText);
      await writeAtomic(path.join(dir, "LOG.md"), logText);
    }
    const ids = [...result.works.keys()].sort(compareIds);
    let failures = 0;
    for (const id of ids) {
      const work = await readWork({ work: path.join(staging, "work") }, id);
      if (work.log.length !== result.works.get(id).entries.length) {
        throw new CatpawError(`Staged ${id} lost log entries.`, "ERR_CONVERT");
      }
      failures += work.log.filter((e) => e.kind === "check" && (e.result === "failed" || e.result === "blocked")).length;
    }
    if (failures !== result.report.failures) throw new CatpawError("Staged board lost failed/blocked checks.", "ERR_CONVERT");
    if ((await fingerprint(boardPaths(root).dir)) !== before) {
      throw new CatpawError("The schema 2 board changed during conversion; nothing was replaced.", "ERR_CONVERT");
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  const old = boardPaths(root).dir;
  await mkdir(path.join(staging, "archive"), { recursive: true });
  await rename(old, path.join(staging, "archive", "schema-2"));
  try {
    await rename(staging, old);
  } catch (error) {
    throw new CatpawError(
      `Converted board is at ${staging} and the original at ${staging}/archive/schema-2; move ${staging} to ${old} to finish. (${error.message})`,
      "ERR_CONVERT",
    );
  }
  return { text: describe(root, result, true), converted: true, report: result.report };
}
