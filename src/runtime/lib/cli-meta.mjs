import { readFile } from "node:fs/promises";

const GENERAL_HELP = `CatPaw — reliable coding-agent Work

Usage:
  catpaw <command> [options]

Core commands:
  catpaw status                         Show active Work, visible Phase, Proof, and Next
  catpaw work start|show|update         Create, inspect, or advance Work
  catpaw work finish|cancel             Finish or cancel Work
  catpaw proof add|list|show            Record or inspect Proof
  catpaw milestone start|show|add       Manage an optional Work grouping
  catpaw milestone finish|cancel        Finish or cancel a Milestone

Maintenance and advanced commands:
  catpaw board init|status|doctor|migrate
  catpaw intent list|show
  catpaw transport check|open|send|status|read|close

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

Phases: understand | execute | check | finish
Legacy 'work close' and '--mode tracked|gated' inputs remain compatible.
`,
  "work start": `Usage: catpaw work start --id <id> --title <title> [options]

Options:
  --high-risk                    Require independent completion Proof
  --date <YYYY-MM-DD>            Override the local date
  --apply                        Create the Work and its internal Plan
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
  --accept-gap <reason>          Record an explicitly user-approved missing gate
  --date <YYYY-MM-DD>
  --apply

Approval must already exist; this command cannot manufacture it.
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
'evidence add' remains a compatibility command for schema 2 storage.
`,
  "proof add": `Usage: catpaw proof add --title <title> [options]

Options:
  --work <id>                    Bind Proof to Work; omit for topic Proof
  --type <type>                  Storage classification (default: research)
  --body <text>                  Inline record body
  --body-file <path|->           Read body from a file or stdin
  --independent --agent <actor>  Record the asserted independent actor
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
  if (group === "evidence") return command ? `proof ${command}` : "proof";
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
