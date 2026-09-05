import { readFile } from "node:fs/promises";

const GENERAL_HELP = `CatPaw — reliable coding-agent Work

Usage:
  catpaw <command> [options]

Core commands:
  catpaw status                         Show active Work, visible Phase, Proof, and Next
  catpaw work start|show|update         Create, inspect, or advance Work
  catpaw work finish|cancel|continue    Close Work or start its next cycle
  catpaw evidence add|list|show|run     Record facts or capture a check
  catpaw milestone start|show|add       Manage an optional Work grouping
  catpaw milestone finish|cancel        Finish or cancel a Milestone

Maintenance and advanced commands:
  catpaw board init|status|doctor|migrate
  catpaw intent list|show
  catpaw transport check|open|send|status|read|close
  catpaw runtime inspect|plan|apply|recover
  catpaw adapter inspect|plan|apply|recover

Global options:
  --project <path>               Project root (default: current directory)
  --board <path>                 Board path (default: <project>/.catpaw)
  --json                         Emit the stable machine-readable report
  --help, -h                     Show help
  --version, -V                  Show runtime version

Mutations preview by default and write only with --apply.
Run 'catpaw <command> --help' for command details.
`;

const HELP = Object.freeze({
  runtime: `Usage:
  catpaw runtime inspect --package <runtime-dir> --target <installed-dir>
  catpaw runtime plan --package <runtime-dir> --target <installed-dir>
                      [--out <plan.json> --apply]
  catpaw runtime apply --plan-file <plan.json> --target <installed-dir>
                       [--backup-root <dir>] [--receipt <file>] [--apply]
  catpaw runtime recover --receipt <file> --target <installed-dir> [--apply]

Plans bind package and target preimages. Apply/recover preview by default.
Runtime publication uses guarded renames with a durable recovery journal;
directory publication has a brief unavailable interval. Drift refuses recovery.
`,
  adapter: `Usage:
  catpaw adapter inspect --target <actual-rule-file> --scope global|project [--package <runtime-dir>]
  catpaw adapter plan --target <actual-rule-file> --scope global|project
                      [--package <runtime-dir>] [--out <plan.json> --apply]
  catpaw adapter apply --plan-file <plan.json> --target <actual-rule-file>
                       [--backup-root <dir>] [--receipt <file>] [--apply]
  catpaw adapter recover --receipt <file> --target <actual-rule-file> [--apply]

Only one CATPAW managed block is changed. Other bytes and file mode are preserved.
Ambiguous markers and symlink targets are refused; records never grant authority.
`,
  status: `Usage: catpaw status [--project <path>] [--json]

Show active Work and Milestones, visible Phase, Proof coverage, board health,
and the most useful Next action. 'catpaw board status' remains compatible.
`,
  work: `Usage:
  catpaw work start  --id <id> --title <title> [--high-risk] [--apply]
  catpaw work show   --id <id>
  catpaw work update --id <id> [--phase <phase>] [--next <text>]
                     [--status active|blocked] [--apply]
  catpaw work finish --id <id> [--accept-gap <reason>] [--apply]
  catpaw work cancel --id <id> [--apply]
  catpaw work continue --id <id> --next <text> [--apply]

Phases: understand | execute | check | finish
Legacy 'work close' and '--mode tracked|gated' inputs remain compatible.
`,
  "work start": `Usage: catpaw work start --id <id> --title <title> [options]

Options:
  --high-risk                    Require independent completion Proof
  --date <YYYY-MM-DD>            Override the local date
  --acceptance <text>            Concrete acceptance (default: title)
  --scope <relative-path>        Candidate deliverables (default: .)
  --owner <actor>                Accountable implementer (default: primary)
  --with-plan                    Also create an optional separate Plan
  --apply                        Create the Work
  --json                         Emit the schema-shaped report
`,
  "work show": `Usage: catpaw work show --id <id> [--json]
`,
  "work update": `Usage: catpaw work update --id <id> [options]

Options:
  --phase understand|execute|check|finish
  --next <single-line text>
  --status active|blocked
  --date <YYYY-MM-DD>
  --apply

At least one of --phase, --next, or --status is required.
`,
  "work finish": `Usage: catpaw work finish --id <id> [options]

Options:
  --accept-gap <reason>          Legacy records only: explicitly accepted gap
  --date <YYYY-MM-DD>
  --apply

Approval must already exist; this command cannot manufacture it.
Contract 4 requires passing current-candidate test and independent review for high-risk completion.
`,
  "work continue": `Usage: catpaw work continue --id <id> --next <text> [--apply]

Preserve the terminal closure and begin a new contract 4 cycle.
`,
  evidence: `Usage:
  catpaw evidence add --work <id> --type <type> --title <title> --body <text>
                      [--result passed|failed|blocked|not-run] [--candidate <sha>]
                      [--independent --agent <actor>] [--apply]
  catpaw evidence list [--work <id>] [--type <type>]
  catpaw evidence show --path <board-relative-path>
  catpaw evidence run --work <id> --title <purpose> [--timeout-ms <n>] [--apply]
                      -- <executable> [args]

Use work show to obtain the checked candidate. Passing assertions require its SHA.
run previews without execution; --apply executes only within existing authorization.
Command arguments and raw output are not retained. Exit zero does not prove test adequacy.
proof add|list|show remain compatible aliases (proof add defaults to research).
`,
  "work cancel": `Usage: catpaw work cancel --id <id> [--date <YYYY-MM-DD>] [--apply]
`,
  proof: `Usage:
  catpaw proof add  --title <title> (--body <text>|--body-file <path|->)
                    [--type <type>]
                    [--work <id>] [--independent --agent <actor>] [--apply]
  catpaw proof list [--work <id>] [--type <type>]
  catpaw proof show --path <board-relative-path>

Stored Proof types: research | review | test | provider | reflection
'evidence add|list|show|run' is the preferred interface. See 'evidence --help'.
`,
  "proof add": `Usage: catpaw proof add --title <title> [options]

Options:
  --work <id>                    Bind Proof to Work; omit for topic Proof
  --type <type>                  Storage classification (default: research)
  --body <text>                  Inline record body
  --body-file <path|->           Read body from a file or stdin
  --independent --agent <actor>  Record the asserted independent actor
  --result <result>              passed | failed | blocked | not-run
  --candidate <sha>              Required for contract 4 passing assertions
  --date <YYYY-MM-DD>
  --apply

Preview and apply perform the same content validation.
`,
  "proof list": `Usage: catpaw proof list [--work <id>] [--type <type>] [--json]
`,
  "proof show": `Usage: catpaw proof show --path <board-relative-path> [--json]
`,
  milestone: `Usage:
  catpaw milestone start  --id <id> --title <title> [--target <text>] [--apply]
  catpaw milestone show   --id <id>
  catpaw milestone add    --milestone <id> --work <id> [--apply]
  catpaw milestone finish --id <id> [--apply]
  catpaw milestone cancel --id <id> [--apply]

Legacy 'milestone close' remains compatible.
`,
  board: `Usage:
  catpaw board init [--apply]
  catpaw board status
  catpaw board doctor [--fix] [--apply]
  catpaw board migrate [--apply]

Board commands expose storage and maintenance detail. Use 'catpaw status' for
the ordinary Work view. Mutations preview by default.
`,
  intent: `Usage:
  catpaw intent list
  catpaw intent show --intent explore|build|check

Intents describe bounded Agent tasks; they do not select a model or grant
permission. 'agent intents|intent' remains compatible.
`,
  transport: `Usage:
  catpaw transport check  --agent <cc|cx>
  catpaw transport open   --agent <cc|cx> [--label <purpose>]
  catpaw transport send   --agent <cc|cx> [--label <purpose>]
                           (--prompt <text>|--prompt-file <path|->)
  catpaw transport status --agent <cc|cx> [--label <purpose>]
  catpaw transport read   --agent <cc|cx> [--label <purpose>] [--lines <n>]
  catpaw transport close  --agent <cc|cx> [--label <purpose>]

These are advanced reciprocal cc/cx session controls. Existing 'agent'
session commands remain compatible.
`,
});

function normalizedTopic(topic) {
  if (!Array.isArray(topic) || topic.length === 0) return "";
  const [group, command] = topic;
  if (group === "agent") {
    if (command === "intents") return "intent";
    if (command === "intent") return "intent";
    return "transport";
  }
  if (group === "evidence") return "evidence";
  if (group === "work" && command === "close") return "work finish";
  if (group === "milestone" && command === "close") return "milestone";
  return [group, command].filter(Boolean).join(" ");
}

export function renderCliHelp(topic = []) {
  const key = normalizedTopic(topic);
  if (key === "") return GENERAL_HELP;
  return HELP[key] ?? HELP[topic[0]] ?? null;
}

export async function runtimeVersion() {
  return (await readFile(new URL("../VERSION", import.meta.url), "utf8")).trim();
}

export async function renderCliVersion() {
  return `catpaw ${await runtimeVersion()} (board schema 2)\n`;
}
