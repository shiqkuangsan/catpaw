import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CatpawError,
  STATUSES,
  boardPaths,
  detectSchema,
  initBoard,
  listWorkIds,
  nextId,
  openBoard,
  readWork,
  today,
  validateId,
  workFiles,
  writeWork,
} from "./board.mjs";
import { convertBoard } from "./convert.mjs";
import { appendEntry, RESULTS } from "./log.mjs";
import { auditDone, evaluate, lastEntry } from "./rules.mjs";
import { takeSnapshot } from "./snapshot.mjs";

const RUNTIME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPEATABLE = new Set(["acceptance", "output", "repos"]);
const BOOLEAN = new Set(["json", "help", "version", "independent", "apply"]);

export const HELP = `CatPaw — delivery ledger for coding agents

Usage: catpaw <command> [args] [--project <path>] [--json]

  init                                  Create a schema 3 board in .catpaw/
  start <title> [--risk high] [--repos a,b] [--id ID] [--parent ID]
        [--goal text] [--acceptance text]... [--next text]
  status [<id>]                         Open Work, or one Work with finishability
  check <id> <passed|failed|blocked|not-run> <summary>
        [--independent] [--actor name] [--output path]... [--body-file f|-]
  note <id> <text> [--body-file f|-]    Decision, finding or handoff
  gap <id> add <text>                   Record something not yet verified
  gap <id> accept <G#> <reason>         User accepts a gap; it stays visible
  gap <id> close <G#> <how>             Gap resolved
  finish <id> [summary]                 Mark done if the rules hold
  block <id> <reason> | reopen <id> <reason> | drop <id> <reason>
  gate [<id>]                           Exit 1 on rule violations (pre-push, CI)
  hook session-start                    Brief for host SessionStart hooks
  convert [--apply]                     Convert a schema 2 board (preview by default)
  policy                                Print the agent policy

Writes apply immediately except convert. Records never grant permission.`;

export function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h") options.help = true;
    else if (arg === "-V") options.version = true;
    else if (arg.startsWith("--")) {
      const [rawKey, inline] = arg.slice(2).split(/=(.*)/s, 2);
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      let value = true;
      if (!BOOLEAN.has(key)) {
        value = inline ?? argv[++i];
        if (value === undefined) throw new CatpawError(`--${rawKey} needs a value.`, "ERR_ARGS");
      }
      if (REPEATABLE.has(key)) (options[key] ||= []).push(value);
      else options[key] = value;
    } else positional.push(arg);
  }
  return { positional, options };
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function bodyFrom(options) {
  if (!options.bodyFile) return "";
  return options.bodyFile === "-" ? readStdin() : readFile(options.bodyFile, "utf8");
}

async function hasBoard(dir) {
  try {
    await stat(path.join(dir, ".catpaw"));
    return true;
  } catch {
    return false;
  }
}

export async function resolveProject(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (await hasBoard(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function need(value, label) {
  if (value === undefined || value === "") throw new CatpawError(`Missing ${label}.`, "ERR_ARGS");
  return value;
}

function repoList(options) {
  const repos = (options.repos ?? []).flatMap((r) => r.split(",")).map((r) => r.trim()).filter(Boolean);
  return repos.length ? repos : ["."];
}

function now() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

async function load(board, id) {
  return readWork(board, validateId(need(id, "Work id")));
}

async function snapshotFor(board, work) {
  return takeSnapshot(board.root, work.data.repos ?? ["."], board.dir);
}

function brief(work, max = 280) {
  const clip = (text) => (text.length > max ? `${text.slice(0, max)}…` : text);
  const lines = [`- ${work.id} [${work.data.status}${work.data.risk === "high" ? ", risk high" : ""}] ${work.data.title}`];
  const next = (work.sections.get("Next") ?? "").replace(/\s+/g, " ").trim();
  if (next) lines.push(`  Next: ${clip(next)}`);
  for (const gap of work.gaps) lines.push(`  Gap ${gap.id} (${gap.state}): ${clip(gap.text)}`);
  const last = work.log.at(-1);
  if (last) {
    const what = last.kind === "check" ? `check ${last.result} (${last.by})` : last.kind;
    lines.push(`  Last: ${String(last.at).slice(0, 10)} ${what}`);
  }
  return lines.join("\n");
}

function summary(work) {
  return {
    id: work.id,
    title: work.data.title,
    status: work.data.status,
    risk: work.data.risk ?? "normal",
    repos: work.data.repos ?? ["."],
    parent: work.data.parent ?? null,
    next: work.sections.get("Next") ?? "",
    gaps: work.gaps,
  };
}

async function allWork(board) {
  const ids = await listWorkIds(board);
  return Promise.all(ids.map((id) => readWork(board, id)));
}

const commands = {
  async init(ctx) {
    const { paths, created } = await initBoard(ctx.project);
    return { text: created ? `Created ${paths.dir}` : `Board already exists at ${paths.dir}`, data: { created } };
  },

  async start(ctx) {
    const board = await openBoard(ctx.project);
    const title = need(ctx.args[0], "title");
    const id = validateId(ctx.options.id ?? (await nextId(board)));
    if ((await listWorkIds(board)).includes(id)) throw new CatpawError(`Work ${id} exists.`, "ERR_EXISTS");
    if (ctx.options.risk && !["high", "normal"].includes(ctx.options.risk)) {
      throw new CatpawError("--risk must be high or normal.", "ERR_ARGS");
    }
    const sections = new Map([
      ["Goal", ctx.options.goal ?? ""],
      ["Acceptance", (ctx.options.acceptance ?? []).map((a) => `- ${a}`).join("\n")],
      ["Gaps", ""],
      ["Decisions", ""],
      ["Next", ctx.options.next ?? ""],
    ]);
    const work = {
      id,
      files: workFiles(board, id),
      data: {
        id,
        title,
        status: "open",
        risk: ctx.options.risk ?? "normal",
        repos: repoList(ctx.options),
        parent: ctx.options.parent ?? null,
        created: today(),
        updated: today(),
      },
      sections,
    };
    await writeWork(work);
    await appendEntry(work.files.log, { at: now(), kind: "note" }, `Started: ${title}`);
    return { text: `Started ${id}: ${title}\n${path.relative(ctx.project, work.files.work)}`, data: summary(work) };
  },

  async status(ctx) {
    const board = await openBoard(ctx.project);
    if (ctx.args[0]) {
      const work = await load(board, ctx.args[0]);
      const snap = await snapshotFor(board, work);
      const problems = work.data.status === "done" ? auditDone(work) : evaluate(work, snap.id);
      const recent = work.log.slice(-5).map((e) => {
        const what = e.kind === "check" ? `check ${e.result} (${e.by})` : e.kind;
        const current = e.snapshot === snap.id ? " [current snapshot]" : "";
        return `  ${String(e.at).slice(0, 16)} ${what}${current}: ${e.body.split("\n")[0].slice(0, 160)}`;
      });
      const verdict =
        work.data.status === "done"
          ? problems.length ? "done record violates rules" : "done record consistent"
          : problems.length ? "not finishable" : "finishable";
      const text = [
        brief(work),
        `  Snapshot: ${snap.id} (${snap.detail})`,
        `  Finish: ${verdict}`,
        ...problems.map((p) => `    - ${p}`),
        "  Recent:",
        ...recent,
        `  Files: ${path.relative(ctx.project, work.files.dir)}/{WORK,LOG}.md`,
      ].join("\n");
      return { text, data: { ...summary(work), snapshot: snap, problems, log: work.log } };
    }
    const works = await allWork(board);
    const active = works.filter((w) => w.data.status === "open" || w.data.status === "blocked");
    const counts = Object.fromEntries([...STATUSES].map((s) => [s, works.filter((w) => w.data.status === s).length]));
    const head = `CatPaw: ${active.length} active Work (${counts.done} done, ${counts.dropped} dropped)`;
    return { text: [head, ...active.map((w) => brief(w))].join("\n"), data: { counts, active: active.map(summary) } };
  },

  async check(ctx) {
    const board = await openBoard(ctx.project);
    const work = await load(board, ctx.args[0]);
    const result = need(ctx.args[1], "result");
    if (!RESULTS.has(result)) throw new CatpawError(`Result must be one of ${[...RESULTS].join(", ")}.`, "ERR_ARGS");
    const text = need(ctx.args[2], "summary");
    const snap = await snapshotFor(board, work);
    const entry = {
      at: now(),
      kind: "check",
      result,
      by: ctx.options.independent ? "independent" : "self",
      snapshot: snap.id,
      repos: snap.detail,
    };
    if (ctx.options.actor) entry.actor = ctx.options.actor;
    if (ctx.options.output) entry.output = ctx.options.output;
    const extra = await bodyFrom(ctx.options);
    await appendEntry(work.files.log, entry, [text, extra].filter(Boolean).join("\n\n"));
    work.log.push(entry);
    const problems = evaluate(work, snap.id);
    const verdict = problems.length ? `not finishable:\n${problems.map((p) => `  - ${p}`).join("\n")}` : "finishable";
    return { text: `${work.id} check ${result} (${entry.by}) on ${snap.id}\n${verdict}`, data: { entry, problems } };
  },

  async note(ctx) {
    const board = await openBoard(ctx.project);
    const work = await load(board, ctx.args[0]);
    const text = [need(ctx.args[1], "text"), await bodyFrom(ctx.options)].filter(Boolean).join("\n\n");
    await appendEntry(work.files.log, { at: now(), kind: "note" }, text);
    return { text: `${work.id} note recorded`, data: {} };
  },

  async gap(ctx) {
    const board = await openBoard(ctx.project);
    const work = await load(board, ctx.args[0]);
    const action = need(ctx.args[1], "gap action (add, accept, close)");
    const lines = (work.sections.get("Gaps") ?? "").split("\n").filter((l) => l.trim());
    let gapId;
    let body;
    if (action === "add") {
      const text = need(ctx.args[2], "gap text");
      const used = [...work.gaps.map((g) => g.id), ...work.log.filter((e) => e.gap).map((e) => e.gap)];
      gapId = `G${used.reduce((top, id) => Math.max(top, Number(id.slice(1))), 0) + 1}`;
      lines.push(`- [open] ${gapId}: ${text}`);
      body = `Opened ${gapId}: ${text}`;
    } else if (action === "accept" || action === "close") {
      gapId = need(ctx.args[2], "gap id");
      const reason = need(ctx.args[3], action === "accept" ? "acceptance reason" : "how it was resolved");
      const gap = work.gaps.find((g) => g.id === gapId);
      if (!gap) throw new CatpawError(`${work.id} has no gap ${gapId}.`, "ERR_ARGS");
      const index = lines.findIndex((l) => l.startsWith(`- [${gap.state}] ${gapId}:`));
      if (action === "accept") {
        lines[index] = `- [accepted] ${gapId}: ${gap.text} — accepted: ${reason}`;
        body = `Accepted ${gapId}: ${reason}`;
      } else {
        lines.splice(index, 1);
        body = `Closed ${gapId} (${gap.text}): ${reason}`;
      }
    } else throw new CatpawError(`Unknown gap action '${action}'.`, "ERR_ARGS");
    work.sections.set("Gaps", lines.join("\n"));
    await writeWork(work);
    await appendEntry(work.files.log, { at: now(), kind: "gap", gap: gapId, action }, body);
    return { text: `${work.id} ${body}`, data: { gap: gapId, action } };
  },

  async finish(ctx) {
    const board = await openBoard(ctx.project);
    const work = await load(board, ctx.args[0]);
    if (work.data.status !== "open") {
      throw new CatpawError(`${work.id} is ${work.data.status}; only open Work can finish.`, "ERR_STATE");
    }
    const snap = await snapshotFor(board, work);
    const problems = evaluate(work, snap.id);
    if (problems.length) {
      throw new CatpawError(`${work.id} cannot finish:\n${problems.map((p) => `  - ${p}`).join("\n")}`, "ERR_RULES");
    }
    work.data.status = "done";
    await writeWork(work);
    await appendEntry(work.files.log, { at: now(), kind: "done", snapshot: snap.id, repos: snap.detail }, ctx.args[1] ?? "");
    return { text: `${work.id} done on snapshot ${snap.id}`, data: { snapshot: snap } };
  },

  async block(ctx) {
    return setStatus(ctx, "blocked", "blocked", ["open"]);
  },

  async reopen(ctx) {
    return setStatus(ctx, "open", "reopened", ["blocked", "done", "dropped"]);
  },

  async drop(ctx) {
    return setStatus(ctx, "dropped", "dropped", ["open", "blocked"]);
  },

  async gate(ctx) {
    const board = await openBoard(ctx.project);
    const violations = [];
    const warnings = [];
    const works = ctx.args[0] ? [await load(board, ctx.args[0])] : await allWork(board);
    for (const work of works) {
      if (work.data.status === "done") {
        for (const p of auditDone(work)) violations.push(`${work.id}: ${p}`);
      } else if (ctx.args[0] && work.data.status !== "dropped") {
        const snap = await snapshotFor(board, work);
        for (const p of evaluate(work, snap.id)) violations.push(`${work.id}: ${p}`);
      } else if (work.data.risk === "high" && work.data.status !== "dropped") {
        warnings.push(`${work.id}: risk high Work is ${work.data.status}`);
      }
      if (!STATUSES.has(work.data.status)) violations.push(`${work.id}: unknown status '${work.data.status}'`);
    }
    const text = [
      violations.length ? `CatPaw gate: ${violations.length} violation(s)` : "CatPaw gate: ok",
      ...violations.map((v) => `  - ${v}`),
      ...warnings.map((w) => `  note: ${w}`),
    ].join("\n");
    return { text, data: { violations, warnings }, exitCode: violations.length ? 1 : 0 };
  },

  async hook(ctx) {
    if (ctx.args[0] !== "session-start") throw new CatpawError("Supported hook: session-start.", "ERR_ARGS");
    let cwd = ctx.project;
    const input = await readStdin().catch(() => "");
    try {
      if (input.trim() && !ctx.options.project) cwd = await resolveProject(JSON.parse(input).cwd ?? cwd);
    } catch {
      // Hosts that send no JSON fall back to the working directory.
    }
    const schema = await detectSchema(cwd);
    if (schema === null) return { text: "", data: {} };
    if (schema !== 3) {
      return { text: `CatPaw: .catpaw uses schema ${schema}; preview conversion with 'catpaw convert'.`, data: {} };
    }
    const board = boardPaths(cwd);
    const works = (await allWork(board)).filter((w) => w.data.status === "open" || w.data.status === "blocked");
    if (!works.length) return { text: "", data: {} };
    const shown = works.slice(-10);
    const text = [
      `CatPaw: ${works.length} active Work in ${board.root}. Follow 'catpaw policy'; detail via 'catpaw status <id>'.`,
      ...shown.map((w) => brief(w, 200)),
      works.length > shown.length ? `(${works.length - shown.length} older active Work not shown)` : "",
    ].filter(Boolean).join("\n");
    return { text, data: {} };
  },

  async convert(ctx) {
    const report = await convertBoard(ctx.project, { apply: Boolean(ctx.options.apply) });
    return { text: report.text, data: report };
  },

  async policy() {
    return { text: (await readFile(path.join(RUNTIME, "policy.md"), "utf8")).trimEnd(), data: {} };
  },
};

async function setStatus(ctx, status, kind, from) {
  const board = await openBoard(ctx.project);
  const work = await load(board, ctx.args[0]);
  const reason = need(ctx.args[1], "reason");
  if (!from.includes(work.data.status)) {
    throw new CatpawError(`${work.id} is ${work.data.status}; cannot become ${status}.`, "ERR_STATE");
  }
  work.data.status = status;
  await writeWork(work);
  await appendEntry(work.files.log, { at: now(), kind }, `${status}: ${reason}`);
  return { text: `${work.id} ${status}`, data: summary(work) };
}

export async function main(argv, { cwd = process.cwd() } = {}) {
  const { positional, options } = parseArgs(argv);
  if (options.version) {
    return { text: (await readFile(path.join(RUNTIME, "VERSION"), "utf8")).trim(), exitCode: 0 };
  }
  const [name, ...args] = positional;
  if (!name || options.help || name === "help") return { text: HELP, exitCode: 0 };
  const command = commands[name];
  if (!command) throw new CatpawError(`Unknown command '${name}'.\n\n${HELP}`, "ERR_ARGS");
  const project = options.project
    ? path.resolve(cwd, options.project)
    : name === "init" ? path.resolve(cwd) : await resolveProject(cwd);
  const result = await command({ project, args, options });
  return { exitCode: 0, ...result, json: Boolean(options.json) };
}
