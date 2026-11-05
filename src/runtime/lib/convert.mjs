// Convert a legacy board and keep the original under .catpaw/archive/.
// Preview unless apply is set.

import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { CatpawError, SCHEMA, boardPaths, compareIds, detectSchema, joinSections, lockBoard, readWork } from "./board.mjs";
import { formatFrontmatter, parseFrontmatter } from "./frontmatter.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { formatEntry, reverseLog } from "./log.mjs";

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
        const info = await lstat(full);
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
  const logText = work.entries.slice().reverse().map((e) => formatEntry({ at: e.at, ...e.meta }, e.body)).join("");
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

async function replaceBoard(old, staging, schema) {
  const archive = path.join(staging, "archive", `schema-${schema}`);
  await mkdir(path.dirname(archive), { recursive: true });
  await rename(old, archive);
  try {
    await rename(staging, old);
  } catch (error) {
    throw new CatpawError(
      `Converted board is at ${staging} and the original at ${archive}; move ${staging} to ${old} to finish. (${error.message})`,
      "ERR_CONVERT",
    );
  }
}

async function fileInfo(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function schema3Logs(board) {
  const info = await fileInfo(board.work);
  if (!info) return [];
  if (!info.isDirectory()) throw new CatpawError("work must be a directory for conversion.", "ERR_CONVERT");
  const logs = [];
  for (const entry of await readdir(board.work, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new CatpawError(`Cannot convert linked Work ${entry.name}.`, "ERR_CONVERT");
    if (!entry.isDirectory()) continue;
    const file = path.join(board.work, entry.name, "LOG.md");
    const log = await fileInfo(file);
    if (!log) continue;
    if (!log.isFile()) throw new CatpawError(`Cannot convert non-file LOG.md for ${entry.name}.`, "ERR_CONVERT");
    logs.push(file);
  }
  return logs;
}

async function convertSchema3(board, apply) {
  const describe = (logs) => [
    `${apply ? "Converted" : "Preview:"} schema 3 board at ${board.dir}`,
    `  LOG.md files: ${logs.length}; newest entries first in schema ${SCHEMA}.`,
    apply ? "  Original board: .catpaw/archive/schema-3/" : "  Apply with: catpaw convert --apply",
  ].join("\n");
  if (!apply) return { text: describe(await schema3Logs(board)), converted: false };

  return lockBoard(board, async () => {
    if ((await detectSchema(board.root)) !== 3) throw new CatpawError("Board schema changed; preview again.", "ERR_CONVERT");
    const before = await fingerprint(board.dir);
    const logs = await schema3Logs(board);
    const archive = await fileInfo(path.join(board.dir, "archive"));
    if (archive && !archive.isDirectory()) throw new CatpawError("archive must be a directory for conversion.", "ERR_CONVERT");
    if (await fileInfo(path.join(board.dir, "archive", "schema-3"))) {
      throw new CatpawError("archive/schema-3 already exists.", "ERR_CONVERT");
    }
    const staging = await mkdtemp(path.join(board.root, ".catpaw-convert-"));
    try {
      // Carry the active lock through the swap. Other board files, including
      // captured output and any older archives, keep their paths.
      await cp(board.dir, staging, { recursive: true, verbatimSymlinks: true });
      for (const file of logs) {
        const text = await readFile(file, "utf8");
        const reversed = reverseLog(text);
        if (text !== reversed) await writeAtomic(path.join(staging, path.relative(board.dir, file)), reversed);
      }
      const marker = path.join(staging, "catpaw.json");
      const data = JSON.parse(await readFile(marker, "utf8"));
      await writeAtomic(marker, `${JSON.stringify({ ...data, schema: SCHEMA }, null, 2)}\n`);
      if ((await fingerprint(board.dir)) !== before) {
        throw new CatpawError("The schema 3 board changed during conversion; nothing was replaced.", "ERR_CONVERT");
      }
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
    await replaceBoard(board.dir, staging, 3);
    await rm(path.join(board.dir, "archive", "schema-3", ".lock"), { force: true });
    return { text: describe(logs), converted: true };
  });
}

export async function convertBoard(projectRoot, { apply = false } = {}) {
  const root = path.resolve(projectRoot);
  const schema = await detectSchema(root);
  if (schema === null) throw new CatpawError(`No .catpaw board in ${root}.`, "ERR_NO_BOARD");
  if (schema === SCHEMA) return { text: `Board at ${root} already uses schema ${SCHEMA}.`, converted: false };
  if (schema === 3) return convertSchema3(boardPaths(root), apply);
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

  await replaceBoard(boardPaths(root).dir, staging, 2);
  return { text: describe(root, result, true), converted: true, report: result.report };
}
