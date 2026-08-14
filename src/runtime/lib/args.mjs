import path from "node:path";

import { resolveAgentKey } from "./provider-profiles.mjs";
import { loadBoardSchema, validateMetadata } from "./schema.mjs";

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliUsageError";
    this.exitCode = 2;
  }
}

const COMMANDS = Object.freeze({
  board: Object.freeze(["init", "status", "doctor", "migrate"]),
  work: Object.freeze(["start", "show", "update", "close"]),
  milestone: Object.freeze(["start", "show", "add", "close"]),
  proof: Object.freeze(["add", "list", "show"]),
  evidence: Object.freeze(["add"]),
  agent: Object.freeze([
    "intents",
    "intent",
    "check",
    "open",
    "send",
    "status",
    "read",
    "close",
  ]),
});

const VALUE_OPTIONS = new Set([
  "--project",
  "--board",
  "--id",
  "--title",
  "--mode",
  "--date",
  "--target",
  "--work",
  "--type",
  "--stage",
  "--agent",
  "--intent",
  "--lens",
  "--body",
  "--milestone",
  "--status",
  "--accept-gap",
  "--host",
  "--label",
  "--prompt",
  "--lines",
  "--phase",
  "--next",
  "--path",
  "--body-file",
  "--prompt-file",
]);

const FLAG_OPTIONS = new Set([
  "--json",
  "--dry-run",
  "--apply",
  "--fix",
  "--independent",
  "--high-risk",
]);

const EVIDENCE_DEFAULT_STAGE = Object.freeze({
  research: "think",
  review: "review",
  provider: "review",
  test: "test",
  reflection: "reflect",
});

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw new CliUsageError(`${option} requires a value`);
  }
  return value;
}

function recordOption(seen, option) {
  if (seen.has(option)) throw new CliUsageError(`duplicate option: ${option}`);
  seen.add(option);
}

function localDate(now = new Date()) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseOptions(argv, startIndex) {
  const values = {};
  const flags = {};
  const seen = new Set();

  for (let index = startIndex; index < argv.length; index += 1) {
    const argument = argv[index];
    if (VALUE_OPTIONS.has(argument)) {
      recordOption(seen, argument);
      values[argument.slice(2)] = optionValue(argv, index, argument);
      index += 1;
    } else if (FLAG_OPTIONS.has(argument)) {
      recordOption(seen, argument);
      flags[argument.slice(2)] = true;
    } else {
      throw new CliUsageError(`unknown argument: ${argument}`);
    }
  }

  return { values, flags, seen };
}

const HELP_TOKENS = new Set(["--help", "-h", "help"]);
const VERSION_TOKENS = new Set(["--version", "-V", "version"]);

function metaRequest(argv) {
  if (argv.length === 0) return { meta: "help", topic: [] };
  if (VERSION_TOKENS.has(argv[0])) {
    if (argv.length > 1) {
      throw new CliUsageError(`${argv[0]} does not accept arguments`);
    }
    return { meta: "version" };
  }
  if (HELP_TOKENS.has(argv[0])) return { meta: "help", topic: argv.slice(1) };
  const helpIndex = argv.findIndex((argument) => HELP_TOKENS.has(argument));
  if (helpIndex !== -1) {
    if (helpIndex !== argv.length - 1) {
      throw new CliUsageError(`${argv[helpIndex]} must be the final argument`);
    }
    return { meta: "help", topic: argv.slice(0, helpIndex) };
  }
  return null;
}

function appendStatus(argv, status) {
  if (argv.includes("--status")) {
    throw new CliUsageError(`${argv[0]} ${argv[1]} does not accept --status`);
  }
  return [...argv.slice(0, 2), "--status", status, ...argv.slice(2)];
}

function normalizeInvocation(argv) {
  const original = [...argv];
  if (argv[0] === "status") {
    return { argv: ["board", "status", ...argv.slice(1)], original };
  }
  if (argv[0] === "intent") {
    const command = argv[1] === "list"
      ? "intents"
      : argv[1] === "show"
        ? "intent"
        : argv[1];
    return { argv: ["agent", command, ...argv.slice(2)], original };
  }
  if (argv[0] === "transport") {
    return { argv: ["agent", ...argv.slice(1)], original };
  }
  if (argv[0] === "work" && argv[1] === "finish") {
    return { argv: appendStatus(["work", "close", ...argv.slice(2)], "done"), original };
  }
  if (argv[0] === "work" && argv[1] === "cancel") {
    return {
      argv: appendStatus(["work", "close", ...argv.slice(2)], "cancelled"),
      original,
    };
  }
  if (argv[0] === "milestone" && argv[1] === "finish") {
    return {
      argv: appendStatus(["milestone", "close", ...argv.slice(2)], "done"),
      original,
    };
  }
  if (argv[0] === "milestone" && argv[1] === "cancel") {
    return {
      argv: appendStatus(["milestone", "close", ...argv.slice(2)], "cancelled"),
      original,
    };
  }
  return { argv, original };
}

function rejectIrrelevantOptions(seen, allowed, label) {
  for (const option of seen) {
    if (!allowed.has(option)) {
      throw new CliUsageError(`${option} is not valid for ${label}`);
    }
  }
}

function requireOption(values, name) {
  if (values[name] === undefined) {
    throw new CliUsageError(`--${name} is required`);
  }
}

function assertValidMetadata(kind, metadata, fields) {
  const finding = validateMetadata(kind, metadata).find((item) =>
    fields.includes(item.path)
  );
  if (finding) throw new CliUsageError(finding.message);
}

function parseBoardOptions(command, parsed) {
  const { flags, seen } = parsed;
  rejectIrrelevantOptions(
    seen,
    new Set(["--project", "--board", "--json", "--dry-run", "--apply", "--fix"]),
    `board ${command}`,
  );
  const dryRunRequested = flags["dry-run"] === true;
  const apply = flags.apply === true;
  const fix = flags.fix === true;

  if (dryRunRequested && apply) {
    throw new CliUsageError("--dry-run and --apply are mutually exclusive");
  }
  if (command === "status") {
    if (apply) throw new CliUsageError("--apply is not valid for board status");
    if (dryRunRequested) {
      throw new CliUsageError("--dry-run is not valid for board status");
    }
    if (fix) throw new CliUsageError("--fix is only valid for board doctor");
  }
  if (command !== "doctor" && fix) {
    throw new CliUsageError("--fix is only valid for board doctor");
  }
  if (command === "doctor" && !fix) {
    if (apply) throw new CliUsageError("--apply requires --fix for board doctor");
    if (dryRunRequested) {
      throw new CliUsageError("--dry-run requires --fix for board doctor");
    }
  }

  return {
    dryRun: command === "init" || command === "migrate" || fix ? !apply : false,
    apply,
    fix,
  };
}

function parseWorkOptions(command, parsed) {
  const { values, flags, seen } = parsed;
  if (flags["dry-run"] && flags.apply) {
    throw new CliUsageError("--dry-run and --apply are mutually exclusive");
  }
  if (command === "show") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--board", "--json", "--id"]),
      "work show",
    );
    requireOption(values, "id");
    return { id: values.id };
  }
  if (command === "update") {
    rejectIrrelevantOptions(
      seen,
      new Set([
        "--project",
        "--board",
        "--json",
        "--dry-run",
        "--apply",
        "--id",
        "--phase",
        "--next",
        "--status",
        "--date",
      ]),
      "work update",
    );
    requireOption(values, "id");
    if (values.phase === undefined && values.next === undefined && values.status === undefined) {
      throw new CliUsageError("work update requires --phase, --next, or --status");
    }
    if (
      values.phase !== undefined &&
      !["understand", "execute", "check", "finish"].includes(values.phase)
    ) {
      throw new CliUsageError(
        "work update --phase must be one of: understand, execute, check, finish",
      );
    }
    const status = values.status ?? null;
    if (status !== null && !["active", "blocked"].includes(status)) {
      throw new CliUsageError(
        "work update --status must be one of: active, blocked",
      );
    }
    const next = values.next?.trim() ?? null;
    if (values.next !== undefined && (next === "" || /[\r\n]/.test(values.next))) {
      throw new CliUsageError("--next requires a nonempty single-line value");
    }
    return {
      apply: flags.apply === true,
      dryRun: flags.apply !== true,
      id: values.id,
      phase: values.phase ?? null,
      next,
      status,
      date: values.date ?? localDate(),
    };
  }
  if (command === "close") {
    rejectIrrelevantOptions(
      seen,
      new Set([
        "--project",
        "--board",
        "--json",
        "--dry-run",
        "--apply",
        "--id",
        "--status",
        "--date",
        "--accept-gap",
      ]),
      "work close",
    );
    requireOption(values, "id");
    const status = values.status ?? "done";
    if (!["done", "cancelled"].includes(status)) {
      throw new CliUsageError("work close --status must be one of: done, cancelled");
    }
    const date = values.date ?? localDate();
    const rawAcceptGap = values["accept-gap"];
    const acceptGap = rawAcceptGap?.trim() ?? null;
    if (
      rawAcceptGap !== undefined &&
      (acceptGap === "" || /[\r\n]/.test(rawAcceptGap))
    ) {
      throw new CliUsageError(
        "--accept-gap requires a nonempty single-line reason",
      );
    }
    const mapping = loadBoardSchema().constraints.workTypeByIdPrefix.mapping;
    const type = mapping[values.id.match(/^([A-Z]+)-/)?.[1]] ?? "feature";
    assertValidMetadata(
      "workItem",
      {
        id: values.id,
        type,
        mode: "tracked",
        status,
        stage: "reflect",
        created: date,
        updated: date,
        closed: date,
      },
      ["id", "type", "status", "created", "updated", "closed"],
    );
    return {
      apply: flags.apply === true,
      dryRun: flags.apply !== true,
      id: values.id,
      status,
      date,
      acceptGap,
    };
  }

  rejectIrrelevantOptions(
    seen,
    new Set([
      "--project",
      "--board",
      "--json",
      "--dry-run",
      "--apply",
      "--id",
      "--title",
      "--mode",
      "--high-risk",
      "--date",
    ]),
    `work ${command}`,
  );
  requireOption(values, "id");
  requireOption(values, "title");

  if (flags["high-risk"] && values.mode !== undefined) {
    throw new CliUsageError("--high-risk and --mode are mutually exclusive");
  }
  const mode = flags["high-risk"] ? "gated" : values.mode ?? "tracked";
  const date = values.date ?? localDate();
  const mapping = loadBoardSchema().constraints.workTypeByIdPrefix.mapping;
  const type = mapping[values.id.match(/^([A-Z]+)-/)?.[1]] ?? "feature";
  assertValidMetadata(
    "workItem",
    {
      id: values.id,
      type,
      mode,
      status: "active",
      stage: "plan",
      created: date,
      updated: date,
      closed: null,
    },
    ["id", "type", "mode", "created", "updated"],
  );

  return {
    apply: flags.apply === true,
    dryRun: flags.apply !== true,
    id: values.id,
    title: values.title,
    mode,
    date,
  };
}

function parseMilestoneOptions(command, parsed) {
  const { values, flags, seen } = parsed;
  if (flags["dry-run"] && flags.apply) {
    throw new CliUsageError("--dry-run and --apply are mutually exclusive");
  }
  if (command === "show") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--board", "--json", "--id"]),
      "milestone show",
    );
    requireOption(values, "id");
    return { id: values.id };
  }
  if (command === "add") {
    rejectIrrelevantOptions(
      seen,
      new Set([
        "--project",
        "--board",
        "--json",
        "--dry-run",
        "--apply",
        "--milestone",
        "--work",
        "--date",
      ]),
      "milestone add",
    );
    requireOption(values, "milestone");
    requireOption(values, "work");
    const date = values.date ?? localDate();
    assertValidMetadata(
      "milestone",
      {
        id: values.milestone,
        status: "active",
        created: date,
        updated: date,
        closed: null,
        target: null,
      },
      ["id", "created", "updated"],
    );
    const mapping = loadBoardSchema().constraints.workTypeByIdPrefix.mapping;
    const type = mapping[values.work.match(/^([A-Z]+)-/)?.[1]] ?? "feature";
    assertValidMetadata(
      "workItem",
      {
        id: values.work,
        type,
        mode: "tracked",
        status: "active",
        stage: "plan",
        created: date,
        updated: date,
        closed: null,
      },
      ["id", "type"],
    );
    return {
      apply: flags.apply === true,
      dryRun: flags.apply !== true,
      milestone: values.milestone,
      work: values.work,
      date,
    };
  }
  if (command === "close") {
    rejectIrrelevantOptions(
      seen,
      new Set([
        "--project",
        "--board",
        "--json",
        "--dry-run",
        "--apply",
        "--id",
        "--status",
        "--date",
      ]),
      "milestone close",
    );
    requireOption(values, "id");
    const status = values.status ?? "done";
    if (!["done", "cancelled"].includes(status)) {
      throw new CliUsageError(
        "milestone close --status must be one of: done, cancelled",
      );
    }
    const date = values.date ?? localDate();
    assertValidMetadata(
      "milestone",
      {
        id: values.id,
        status,
        created: date,
        updated: date,
        closed: date,
        target: null,
      },
      ["id", "status", "created", "updated", "closed"],
    );
    return {
      apply: flags.apply === true,
      dryRun: flags.apply !== true,
      id: values.id,
      status,
      date,
    };
  }

  rejectIrrelevantOptions(
    seen,
    new Set([
      "--project",
      "--board",
      "--json",
      "--dry-run",
      "--apply",
      "--id",
      "--title",
      "--target",
      "--date",
    ]),
    `milestone ${command}`,
  );
  requireOption(values, "id");
  requireOption(values, "title");
  const date = values.date ?? localDate();
  assertValidMetadata(
    "milestone",
    {
      id: values.id,
      status: "active",
      created: date,
      updated: date,
      closed: null,
      target: values.target ?? null,
    },
    ["id", "created", "updated", "target"],
  );
  return {
    apply: flags.apply === true,
    dryRun: flags.apply !== true,
    id: values.id,
    title: values.title,
    target: values.target ?? null,
    date,
  };
}

function parseProofOptions(command, parsed, group) {
  const { values, flags, seen } = parsed;
  if (command === "list") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--board", "--json", "--work", "--type"]),
      "proof list",
    );
    if (
      values.type !== undefined &&
      !Object.hasOwn(EVIDENCE_DEFAULT_STAGE, values.type)
    ) {
      throw new CliUsageError(
        "proof list --type must be one of: research, review, test, provider, reflection",
      );
    }
    return { work: values.work ?? null, type: values.type ?? null };
  }
  if (command === "show") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--board", "--json", "--path"]),
      "proof show",
    );
    requireOption(values, "path");
    return { path: values.path };
  }
  rejectIrrelevantOptions(
    seen,
    new Set([
      "--project",
      "--board",
      "--json",
      "--dry-run",
      "--apply",
      "--work",
      "--type",
      "--title",
      "--stage",
      "--date",
      "--agent",
      "--lens",
      "--independent",
      "--body",
      "--body-file",
    ]),
    `${group} ${command}`,
  );
  if (flags["dry-run"] && flags.apply) {
    throw new CliUsageError("--dry-run and --apply are mutually exclusive");
  }
  if (group === "evidence") requireOption(values, "type");
  requireOption(values, "title");
  const agent = values.agent?.trim() ?? null;
  if (values.agent !== undefined && agent === "") {
    throw new CliUsageError("--agent requires a nonempty value");
  }
  if (flags.independent && agent === null) {
    throw new CliUsageError("--independent requires --agent");
  }
  if (values.body !== undefined && values["body-file"] !== undefined) {
    throw new CliUsageError("--body and --body-file are mutually exclusive");
  }
  if (
    values["body-file"] === undefined &&
    (values.body?.trim() ?? "") === "" &&
    (group === "proof" || flags.apply)
  ) {
    const label = group === "proof" ? "Proof" : "Evidence";
    throw new CliUsageError(`--body or --body-file is required to record ${label}`);
  }

  const type = values.type ?? "research";
  const date = values.date ?? localDate();
  const stage = values.stage ?? EVIDENCE_DEFAULT_STAGE[type] ?? "think";
  const metadata = {
    type,
    work: values.work ?? null,
    stage,
    created: date,
    updated: date,
    independent: flags.independent === true,
    agent,
    lens: values.lens ?? null,
  };
  assertValidMetadata(
    "evidence",
    metadata,
    ["type", "work", "stage", "created", "updated", "lens"],
  );
  return {
    apply: flags.apply === true,
    dryRun: flags.apply !== true,
    ...metadata,
    title: values.title,
    body: values.body ?? "",
    bodyFile: values["body-file"] ?? null,
    date,
  };
}

function parseAgentOptions(command, parsed) {
  const { values, seen } = parsed;
  if (command === "intents") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--json"]),
      "agent intents",
    );
    return { intent: null };
  }
  if (command === "intent") {
    rejectIrrelevantOptions(
      seen,
      new Set(["--project", "--json", "--intent"]),
      "agent intent",
    );
    requireOption(values, "intent");
    const intent = values.intent.trim();
    if (!/^[a-z][a-z0-9-]*$/.test(intent)) {
      throw new CliUsageError("--intent must be a lowercase intent id");
    }
    return { intent };
  }
  const common = ["--project", "--json", "--agent", "--host"];
  const allowed = new Set(
    command === "check"
      ? common
      : command === "send"
        ? [...common, "--label", "--prompt", "--prompt-file"]
        : command === "read"
          ? [...common, "--label", "--lines"]
          : [...common, "--label"],
  );
  rejectIrrelevantOptions(seen, allowed, `agent ${command}`);
  requireOption(values, "agent");

  let agent;
  try {
    agent = resolveAgentKey(values.agent, {
      host: values.host ?? process.env.CATPAW_HOST,
    });
  } catch (error) {
    throw new CliUsageError(error.message);
  }
  const label = values.label?.trim() || "default";
  if (values.label !== undefined && values.label.trim() === "") {
    throw new CliUsageError("--label requires a nonempty value");
  }
  if (/[\u0000-\u001f\u007f]/.test(label)) {
    throw new CliUsageError("--label must not contain control characters");
  }

  let prompt = null;
  let promptFile = null;
  if (command === "send") {
    if (values.prompt !== undefined && values["prompt-file"] !== undefined) {
      throw new CliUsageError("--prompt and --prompt-file are mutually exclusive");
    }
    if (values.prompt === undefined && values["prompt-file"] === undefined) {
      throw new CliUsageError("--prompt or --prompt-file is required");
    }
    if (values.prompt !== undefined) {
      prompt = values.prompt.trim();
      if (prompt === "") {
        throw new CliUsageError("--prompt requires a nonempty value");
      }
    }
    promptFile = values["prompt-file"] ?? null;
  }

  let lines = null;
  if (command === "read") {
    const rawLines = values.lines ?? "200";
    if (!/^[1-9]\d*$/.test(rawLines)) {
      throw new CliUsageError("--lines must be an integer from 1 to 5000");
    }
    lines = Number(rawLines);
    if (lines > 5000) {
      throw new CliUsageError("--lines must be an integer from 1 to 5000");
    }
  }

  return {
    agent,
    requestedAgent: values.agent,
    host: values.host ?? process.env.CATPAW_HOST ?? null,
    label,
    prompt,
    promptFile,
    lines,
  };
}

export function parseCliArgs(argv, { cwd = process.cwd() } = {}) {
  const meta = metaRequest(argv);
  if (meta) return meta;
  const normalized = normalizeInvocation(argv);
  argv = normalized.argv;
  if (argv[0] === "board" && argv[1] === undefined) {
    throw new CliUsageError("expected board init|status|doctor|migrate");
  }
  const commands = COMMANDS[argv[0]];
  if (!commands) throw new CliUsageError(`unknown command: ${argv[0]}`);
  if (!commands.includes(argv[1])) {
    throw new CliUsageError(`unknown ${argv[0]} command: ${argv[1]}`);
  }

  const group = argv[0];
  const command = argv[1];
  const parsed = parseOptions(argv, 2);
  const project = parsed.values.project ?? cwd;
  const projectRoot = path.resolve(cwd, project);
  const boardPath = parsed.values.board === undefined
    ? path.join(projectRoot, ".catpaw")
    : path.resolve(projectRoot, parsed.values.board);
  const commandOptions = group === "board"
    ? parseBoardOptions(command, parsed)
    : group === "work"
      ? parseWorkOptions(command, parsed)
      : group === "milestone"
        ? parseMilestoneOptions(command, parsed)
        : group === "proof" || group === "evidence"
          ? parseProofOptions(command, parsed, group)
          : parseAgentOptions(command, parsed);

  return {
    group,
    command,
    projectRoot,
    boardPath,
    json: parsed.flags.json === true,
    invokedAs: normalized.original.slice(0, 2).join(" "),
    preferredGroup: normalized.original[0],
    ...commandOptions,
  };
}
