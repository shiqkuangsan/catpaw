import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CatpawError,
  SCHEMA,
  STATUSES,
  boardPaths,
  confirmBoardSchema,
  detectSchema,
  initBoard,
  listWorkIds,
  lockBoard,
  nextId,
  openBoard,
  readWork,
  supportsSchema,
  today,
  validateId,
  workFiles,
  writeWork,
} from "./board.mjs";
import { convertBoard } from "./convert.mjs";
import { addEntry, RESULTS } from "./log.mjs";
import { auditDone, evaluate } from "./rules.mjs";
import { takeSnapshot } from "./snapshot.mjs";

const RUNTIME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPEATABLE = new Set(["acceptance", "output", "repos"]);
const BOOLEAN = new Set(["json", "help", "version", "independent", "apply"]);

export const HELP = `CatPaw — delivery ledger for coding agents

Usage: catpaw <command> [args] [--project <path>] [--json]

  init                                  Create a schema ${SCHEMA} board in .catpaw/
  start <title> [--risk high] [--repos a,b] [--id ID] [--parent ID]
        [--goal text] [--acceptance text]... [--next text]
  status [<id>]                         Open Work, or one Work with finishability
  check <id> <passed|failed|blocked|not-run> <summary>
        [--independent] [--actor name] [--output path]... [--body-file f|-]
  check <id> <summary> [--timeout sec] [...] -- <command> [args]
                                        CatPaw runs the command and records
                                        the result from its exit code
  note <id> <text> [--body-file f|-]    Decision, finding or handoff
  gap <id> add <text>                   Record something not yet verified
  gap <id> accept <G#> <reason>         User accepts a gap; it stays visible
  gap <id> close <G#> <how>             Gap resolved
  finish <id> [summary]                 Mark done if the rules hold
  block <id> <reason> | reopen <id> <reason> | drop <id> <reason>
  gate [<id>]                           Exit 1 on rule violations (pre-push, CI)
  hook session-start                    Brief for host SessionStart hooks
  convert [--apply]                     Convert a schema 2 or 3 board (preview by default)
  policy                                Print the agent policy

Writes apply immediately except convert. Records never grant permission.
Exit 1 also when a command run by 'check ... --' does not pass.`;

export function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      options.command = argv.slice(i + 1);
      break;
    }
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

// The home directory's .catpaw is the CatPaw 4 runtime install, never a board.
export async function resolveProject(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (dir !== os.homedir() && (await detectSchema(dir)) !== null) return dir;
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
  const work = await readWork(board, validateId(need(id, "Work id")));
  await confirmBoardSchema(board);
  return work;
}

async function snapshotFor(board, work) {
  return takeSnapshot(board.root, work.data.repos ?? ["."], board.dir);
}

function describe(entry) {
  if (entry.kind !== "check") return entry.kind;
  return `check ${entry.result} (${entry.by}${entry.run ? ", run" : ""})`;
}

function brief(work, max = 280) {
  const clip = (text) => (text.length > max ? `${text.slice(0, max)}…` : text);
  const lines = [`- ${work.id} [${work.data.status}${work.data.risk === "high" ? ", risk high" : ""}] ${work.data.title}`];
  const next = (work.sections.get("Next") ?? "").replace(/\s+/g, " ").trim();
  if (next) lines.push(`  Next: ${clip(next)}`);
  for (const gap of work.gaps) lines.push(`  Gap ${gap.id} (${gap.state}): ${clip(gap.text)}`);
  const last = work.log[0];
  if (last) lines.push(`  Last: ${String(last.at).slice(0, 10)} ${describe(last)}`);
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
  const works = await Promise.all(ids.map((id) => readWork(board, id)));
  await confirmBoardSchema(board);
  return works;
}

function recordEntry(board, work, entry, body) {
  return addEntry(work.files.log, entry, body, board.schema === SCHEMA);
}

async function startWork(ctx, board) {
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
  await recordEntry(board, work, { at: now(), kind: "note" }, `Started: ${title}`);
  return { text: `Started ${id}: ${title}\n${path.relative(ctx.project, work.files.work)}`, data: summary(work) };
}

async function changeGap(ctx, board) {
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
  await recordEntry(board, work, { at: now(), kind: "gap", gap: gapId, action }, body);
  return { text: `${work.id} ${body}`, data: { gap: gapId, action } };
}

async function finishWork(ctx, board) {
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
  await recordEntry(board, work, { at: now(), kind: "done", snapshot: snap.id, repos: snap.detail }, ctx.args[1] ?? "");
  return { text: `${work.id} done on snapshot ${snap.id}`, data: { snapshot: snap } };
}

const commands = {
  async init(ctx) {
    const { paths, created } = await initBoard(ctx.project);
    return { text: created ? `Created ${paths.dir}` : `Board already exists at ${paths.dir}`, data: { created } };
  },

  async start(ctx) {
    const board = await openBoard(ctx.project);
    return lockBoard(board, () => startWork(ctx, board));
  },

  async status(ctx) {
    const board = await openBoard(ctx.project);
    if (ctx.args[0]) {
      const work = await load(board, ctx.args[0]);
      const snap = await snapshotFor(board, work);
      const problems = work.data.status === "done" ? auditDone(work) : evaluate(work, snap.id);
      const recent = work.log.slice(0, 5).map((e) => {
        const current = e.snapshot === snap.id ? " [current snapshot]" : "";
        const at = String(e.at);
        const time = at.endsWith("Z") ? `${at.slice(0, 16)} UTC` : at;
        return `  ${time} ${describe(e)}${current}: ${e.body.split("\n")[0].slice(0, 160)}`;
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
    const command = ctx.options.command;
    let work = await load(board, ctx.args[0]);
    let result;
    let text;
    let ran = null;
    let snap;
    if (command) {
      if (!command.length) throw new CatpawError("Missing command after '--'.", "ERR_ARGS");
      if (ctx.args.length !== 2) {
        throw new CatpawError("With '--' the exit code decides the result: check <id> <summary> -- <command>.", "ERR_ARGS");
      }
      text = ctx.args[1];
      snap = await snapshotFor(board, work);
      ran = await runCheck(ctx, board, work.id, command, snap);
      result = ran.result;
    } else {
      result = need(ctx.args[1], "result");
      if (!RESULTS.has(result)) throw new CatpawError(`Result must be one of ${[...RESULTS].join(", ")}.`, "ERR_ARGS");
      text = need(ctx.args[2], "summary");
      snap = await snapshotFor(board, work);
    }
    const entry = {
      at: now(),
      kind: "check",
      result,
      by: ctx.options.independent ? "independent" : "self",
      snapshot: snap.id,
      repos: snap.detail,
    };
    if (ctx.options.actor) entry.actor = ctx.options.actor;
    const outputs = [...(ran ? [ran.output] : []), ...(ctx.options.output ?? [])];
    if (outputs.length) entry.output = outputs;
    if (ran) entry.run = ran.run;
    const extra = await bodyFrom(ctx.options);
    const body = [text, ran?.line, extra].filter(Boolean).join("\n\n");
    const current = ran?.after ?? snap;
    const problems = await lockBoard(board, async () => {
      work = await load(board, work.id);
      await recordEntry(board, work, entry, body);
      work.log.unshift(entry);
      return evaluate(work, current.id);
    });
    const verdict = problems.length ? `not finishable:\n${problems.map((p) => `  - ${p}`).join("\n")}` : "finishable";
    const lines = [`${work.id} ${describe(entry)} on ${snap.id}`];
    if (ran) {
      lines.push(`  ${ran.line}`);
      if (ran.run.drift) lines.push("  warning: files changed during the run; the result is bound to the snapshot before it");
      if (result !== "passed" && ran.tail) lines.push("  output tail:", ran.tail.replace(/^/gm, "    "));
    }
    lines.push(verdict);
    return { text: lines.join("\n"), data: { entry, problems }, exitCode: ran && result !== "passed" ? 1 : 0 };
  },

  async note(ctx) {
    const board = await openBoard(ctx.project);
    const text = [need(ctx.args[1], "text"), await bodyFrom(ctx.options)].filter(Boolean).join("\n\n");
    return lockBoard(board, async () => {
      const work = await load(board, ctx.args[0]);
      await recordEntry(board, work, { at: now(), kind: "note" }, text);
      return { text: `${work.id} note recorded`, data: {} };
    });
  },

  async gap(ctx) {
    const board = await openBoard(ctx.project);
    return lockBoard(board, () => changeGap(ctx, board));
  },

  async finish(ctx) {
    const board = await openBoard(ctx.project);
    return lockBoard(board, () => finishWork(ctx, board));
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
    if (!supportsSchema(schema)) {
      return { text: `CatPaw: .catpaw uses schema ${schema}; preview conversion with 'catpaw convert'.`, data: {} };
    }
    const board = { ...boardPaths(cwd), schema };
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
  const reason = need(ctx.args[1], "reason");
  return lockBoard(board, async () => {
    const work = await load(board, ctx.args[0]);
    if (!from.includes(work.data.status)) {
      throw new CatpawError(`${work.id} is ${work.data.status}; cannot become ${status}.`, "ERR_STATE");
    }
    work.data.status = status;
    await writeWork(work);
    await recordEntry(board, work, { at: now(), kind }, `${status}: ${reason}`);
    return { text: `${work.id} ${status}`, data: summary(work) };
  });
}

function quote(arg) {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

// Run a check command and derive its result from the exit code. Output goes to
// .catpaw/runs/, which ignores itself in Git. The board lock is not held here.
// Piped stdin (a heredoc script, for example) is forwarded as if the command ran
// directly, and saved next to the output so the checked logic stays reviewable.
async function runCheck(ctx, board, id, command, before) {
  const timeout = ctx.options.timeout === undefined ? 0 : Number(ctx.options.timeout);
  if (!(timeout >= 0)) throw new CatpawError("--timeout must be a number of seconds.", "ERR_ARGS");
  const runs = path.join(board.dir, "runs");
  await mkdir(path.join(runs, id), { recursive: true });
  await writeFile(path.join(runs, ".gitignore"), "*\n");
  const base = path.join(runs, id, `${now().replace(/[:]/g, "")}-${randomBytes(4).toString("hex")}`);
  const file = `${base}.log`;
  const out = createWriteStream(file, { flags: "wx" });
  const input = process.stdin.isTTY ? null : { file: `${base}.stdin`, bytes: 0, hash: createHash("sha256"), out: null };
  const shown = command.map(quote).join(" ");
  out.write(`$ ${shown}\n# cwd: ${ctx.cwd}\n\n`);
  const started = Date.now();
  let tail = "";
  const outcome = await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd: ctx.cwd, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    const forward = (chunk) => {
      input.out ??= createWriteStream(input.file, { flags: "wx" });
      input.out.write(chunk);
      input.bytes += chunk.length;
      input.hash.update(chunk);
      child.stdin.write(chunk);
    };
    const endInput = () => child.stdin.end();
    if (input) {
      child.stdin.on("error", () => {});
      if (process.stdin.readableEnded) endInput();
      else process.stdin.on("data", forward).on("end", endInput);
    }
    let stopped = null;
    const stop = (why) => {
      stopped = why;
      child.kill("SIGTERM");
    };
    const onSignal = (signal) => stop(`interrupted by ${signal}`);
    const timer = timeout ? setTimeout(() => stop(`timed out after ${timeout}s`), timeout * 1000) : null;
    process.on("SIGINT", onSignal).on("SIGTERM", onSignal);
    const done = (value) => {
      clearTimeout(timer);
      process.off("SIGINT", onSignal).off("SIGTERM", onSignal);
      if (input) {
        process.stdin.off("data", forward).off("end", endInput).pause();
        process.stdin.unref?.();
      }
      resolve(value);
    };
    const collect = (chunk) => {
      out.write(chunk);
      tail = (tail + chunk.toString("utf8")).slice(-8000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => done({ error }));
    child.on("close", (code, signal) => done({ code, signal, stopped }));
  });
  await new Promise((resolve) => out.end(resolve));
  if (input?.out) await new Promise((resolve) => input.out.end(resolve));
  const ms = Date.now() - started;
  const after = await takeSnapshot(board.root, (await load(board, id)).data.repos ?? ["."], board.dir);
  const run = { command, cwd: path.relative(board.root, ctx.cwd) || ".", exit: outcome.code ?? null, ms };
  let result;
  let how;
  if (outcome.error) {
    result = "blocked";
    how = `could not start: ${outcome.error.code ?? outcome.error.message}`;
  } else if (outcome.stopped?.startsWith("interrupted")) {
    result = "blocked";
    how = outcome.stopped;
  } else if (outcome.stopped) {
    result = "failed";
    how = outcome.stopped;
  } else {
    result = outcome.code === 0 ? "passed" : "failed";
    how = outcome.signal ? `killed by ${outcome.signal}` : `exit ${outcome.code}`;
  }
  if (outcome.signal) run.signal = outcome.signal;
  if (after.id !== before.id) run.drift = after.id;
  let fed = "";
  if (input?.bytes) {
    const sha256 = input.hash.digest("hex");
    run.stdin = { bytes: input.bytes, sha256, file: path.relative(board.root, input.file) };
    fed = ` with ${input.bytes} bytes of stdin (${run.stdin.file})`;
  }
  const output = path.relative(board.root, file);
  const line = `Ran \`${shown}\`${fed}: ${how} in ${(ms / 1000).toFixed(1)}s; output ${output}`;
  const lastLines = tail.trimEnd().split("\n").slice(-30).join("\n");
  return { result, run, output, line, tail: lastLines, after };
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
  const result = await command({ project, cwd: path.resolve(cwd), args, options });
  return { exitCode: 0, ...result, json: Boolean(options.json) };
}
