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
  work: Object.freeze(["start", "close"]),
  milestone: Object.freeze(["start", "add", "close"]),
  evidence: Object.freeze(["add"]),
  agent: Object.freeze(["check", "open", "send", "status", "read", "close"]),
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
  "--lens",
  "--body",
  "--milestone",
  "--status",
  "--accept-gap",
  "--host",
  "--label",
  "--prompt",
  "--lines",
]);

const FLAG_OPTIONS = new Set([
  "--json",
  "--dry-run",
  "--apply",
  "--fix",
  "--independent",
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
      "--date",
    ]),
    `work ${command}`,
  );
  requireOption(values, "id");
  requireOption(values, "title");

  const mode = values.mode ?? "tracked";
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

function parseEvidenceOptions(command, parsed) {
  const { values, flags, seen } = parsed;
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
    ]),
    `evidence ${command}`,
  );
  if (flags["dry-run"] && flags.apply) {
    throw new CliUsageError("--dry-run and --apply are mutually exclusive");
  }
  requireOption(values, "type");
  requireOption(values, "title");
  const agent = values.agent?.trim() ?? null;
  if (values.agent !== undefined && agent === "") {
    throw new CliUsageError("--agent requires a nonempty value");
  }
  if (flags.independent && agent === null) {
    throw new CliUsageError("--independent requires --agent");
  }
  if (flags.apply && (values.body?.trim() ?? "") === "") {
    throw new CliUsageError("--body is required when --apply records Evidence");
  }

  const date = values.date ?? localDate();
  const stage = values.stage ?? EVIDENCE_DEFAULT_STAGE[values.type] ?? "think";
  const metadata = {
    type: values.type,
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
    date,
  };
}

function parseAgentOptions(command, parsed) {
  const { values, seen } = parsed;
  const common = ["--project", "--json", "--agent", "--host"];
  const allowed = new Set(
    command === "check"
      ? common
      : command === "send"
        ? [...common, "--label", "--prompt"]
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
  if (command === "send") {
    requireOption(values, "prompt");
    prompt = values.prompt.trim();
    if (prompt === "") {
      throw new CliUsageError("--prompt requires a nonempty value");
    }
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
    lines,
  };
}

export function parseCliArgs(argv, { cwd = process.cwd() } = {}) {
  if (argv.length === 0 || (argv[0] === "board" && argv[1] === undefined)) {
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
        : group === "evidence"
          ? parseEvidenceOptions(command, parsed)
          : parseAgentOptions(command, parsed);

  return {
    group,
    command,
    projectRoot,
    boardPath,
    json: parsed.flags.json === true,
    ...commandOptions,
  };
}
