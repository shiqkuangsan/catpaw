# catpaw:provider

Coordinate external provider agents through CLI or native subagent mechanisms.

This command is broader than review. Use it when CatPaw requires or the primary
agent needs another agent for architecture discussion, task research, bug
diagnosis, implementation advice, code review, multi-provider disagreement, or a
multi-round technical dialogue.

## Principle

The primary agent owns orchestration.

```text
Primary agent
  -> chooses provider and mode
  -> sends bounded prompt through CLI/subagent
  -> reads provider output
  -> classifies accepted / rejected / conflict
  -> decides next round or final answer
```

Provider output is evidence and perspective, not authority. It never authorizes
commit, push, PR, deploy, destructive operations, or scope expansion.

## Modes

| Mode | Use when | Default artifact |
|---|---|---|
| `ask` | single-turn question, explanation, task lookup, quick second opinion | inline |
| `discuss` | multi-round architecture or strategy debate | inline or `research/<topic>/provider-dialogue.md` |
| `debug` | bug diagnosis, root-cause hypotheses, repro interpretation | inline or plan/research note |
| `review` | code/plan/release/security review | `reviews/<req-id>-<slug>/summary.md` when formal |
| `implement` | request a patch idea or bounded implementation proposal | inline by default; primary applies changes |
| `summarize` | merge results from multiple providers | inline or review/research summary |

## Provider Mapping

Provider aliases are intent aliases, not separate providers. ASCII aliases are
case-insensitive. Treat natural-language requests such as "ask for a second
opinion" or "get a third opinion" as the same routing signal.

| Provider name or alias | Meaning |
|---|---|
| `subagent` | current tool's native subagent; same tool family, light parallel help |
| `Laoer` / `laoer` / `老二` / `second opinion` / `second reviewer` | heterogeneous second opinion; in Claude Code (`cc`) default to Codex (`cx`), in Codex (`cx`) default to Claude Code (`cc`) |
| `Laosan` / `laosan` / `老三` / `third opinion` / `third reviewer` | Gemini; useful for multimodal, UI, design, architecture, or tie-breaking |
| explicit provider | user-named provider such as `cc`, `cx`, `gemini`; obey user naming first |

If the user does not specify a provider, choose the lightest provider that can
answer the question safely. Do not involve multiple providers by default for
L0/L1 work.

Provider stance:

- `forced`: CatPaw requires a non-primary provider or explicit provider gap.
- `preferred`: current-tool subagent is the default, but the primary agent may
  skip it with a compact reason.
- `inline`: primary agent handles the work directly.

## Forced Provider Gate

Some CatPaw gates are triggered by task risk instead of primary-agent
preference:

- L3 formal review requires at least one non-primary provider.
- Release, security, external action, CI/CD, migration, incident, or destructive
  operation gates require attempting Laoer / heterogeneous second opinion first.
- Behavior-sensitive L2 work requires at least one non-primary contract /
  semantic review; current-tool subagent is sufficient unless risk requires a
  heterogeneous second opinion.
- Repeated failure requires provider `debug` when the same issue survives two
  repair attempts, the same test fails twice without a stable cause, or the
  root-cause hypothesis changes repeatedly.
- Cross-boundary planning requires at least current-tool subagent review when
  the work spans 2+ subsystems, frontend/backend or IPC boundaries, platform
  differences, persistent formats, API contracts, or long-lived compatibility.

Fallback:

- If a required heterogeneous provider is unavailable, times out, or returns no
  usable evidence, record the reason and fall back to current-tool subagent.
- If no non-primary provider is available, record a `provider gap`; do not mark
  the forced gate satisfied silently.
- Formal review must not list only `current coding agent` as provider unless the
  review explicitly records a provider gap and the user accepts that gap.

## Subagent Preference Gate

Prefer current-tool subagent when the task has medium-risk uncertainty but does
not meet a forced gate:

- L2 work unless narrow, local, and already well understood.
- L1 work touching 3+ files, shared helpers, public docs/protocols, runtime
  policy/spec/commands/templates, or unfamiliar modules.
- Consistency-sensitive changes across multiple runtime files, generated output,
  adapter snippets, templates, or docs.
- Weak, missing, or unavailable tests where QA verification gaps matter.
- Non-trivial UI changes needing design or QA perspective.
- Completion review when a broad diff makes self-review likely weak.

If skipped after a preference trigger, record:

```text
Subagent skipped: <why inline handling is sufficient>.
```

Do not treat preferred subagent use as authorization. Provider findings remain
advisory and must be summarized by the primary agent as accepted / rejected /
conflict.

Preferred subagent invocation is one bounded round by default. Prompt with:
goal, scoped files/context, read-only constraint, exact question, expected
output, and safety limits. Stop after one round unless the result reveals a
forced gate, repeated failure, or explicit user request for more review.

Expected output:

```text
Findings:
Risks:
Verification:
Decision:
```

For `preferred`, final plan/review/completion evidence must show either
`Provider outcome: used` with subagent findings, or `Provider outcome: skipped`
with `Subagent skipped: <reason>`.

## Invocation Strategy

Use the lightest provider invocation that still gives enough observability.
Provider availability is a capability check, not a requirement to install more
tools or buy more subscriptions.

| Situation | Preferred invocation |
|---|---|
| Quick `ask`, small review, task lookup | Non-interactive CLI |
| L3 review, release/security/incident gate | Observable long-running provider mode when available |
| Multi-round `discuss` / `debug` | Observable session or provider-native resume |
| Provider expected to read many files or think for a long time | Observable session when available |
| Observable wrapper unavailable | Non-interactive CLI, plus process/session checks before declaring unavailable |
| Provider CLI unavailable | Current-tool subagent, if available |
| No non-primary provider available | Inline role lens with explicit provider gap / skip reason |

Provider output remains evidence and perspective, not authority. Observable
mode improves status inspection; it does not expand provider permissions.

Capability fallback ladder:

1. Observable provider session, if tmux and the target provider CLI are
   available.
2. Provider-native or non-interactive CLI invocation, if the target provider CLI
   is available but tmux is missing or unsuitable.
3. Current-tool subagent, if the current provider supports subagents.
4. Inline role lens with explicit provider gap / subagent skip reason.
5. Block only when the workflow requires non-primary evidence and the user does
   not accept the remaining provider gap.

Do not repeatedly pressure the user to install tmux, Claude Code, Codex,
Gemini, or OpenCode. Respect explicit user constraints such as "only use the
current provider", missing subscriptions, missing login state, unavailable
commands, or an environment where tmux cannot run.

## CLI Playbook

These are default non-interactive shapes for short tasks and fallback paths.
Prefer passing compact context through the prompt instead of giving the provider
broad filesystem permissions.

### Claude Code (`cc`)

Single-turn, no tools:

```bash
claude -p --no-session-persistence --tools "" "<prompt>"
```

Read-only workspace discussion:

```bash
claude -p --no-session-persistence --permission-mode plan "<prompt>"
```

Provider-native continuation may use `--continue`, `--resume`, or
`--session-id`, but CatPaw must not depend on provider memory alone.

### Codex (`cx`)

Single-turn, read-only:

```bash
codex exec --cd "$PWD" --sandbox read-only --ask-for-approval never --ephemeral "<prompt>"
```

Provider-native continuation may use:

```bash
codex exec resume --last "<prompt>"
```

Use `--sandbox workspace-write` only after explicit user approval and a bounded
write scope.

### Gemini

Single-turn, read-only:

```bash
gemini -p "<prompt>" --approval-mode plan --output-format text
```

Provider-native continuation may use:

```bash
gemini --resume latest -p "<prompt>" --approval-mode plan --output-format text
```

Use write-capable approval modes only after explicit user approval and a bounded
write scope.

### OpenCode

Single-turn, read-only behavior depends on the installed OpenCode CLI. When an
OpenCode command is available, use the safest non-write mode it supports and
record the exact invocation.

## Observable Long-Running Provider Mode

Use observable long-running provider mode for provider work where a silent
stdout stream is ambiguous: L3 review, release/security/incident gates,
multi-round discuss/debug, or tasks expected to read many local files.

No stdout while the provider process/session is still alive is not sufficient
evidence that the provider is unavailable.

Before recording `unavailable`, `timeout`, or a provider gap, inspect at least
one available progress signal:

- process state;
- tmux/session status;
- recent pane or transcript output;
- provider-native session state;
- explicit provider prompt waiting for input;
- user instruction to stop waiting.

CatPaw-owned optional wrapper:

```bash
~/.catpaw/tools/provider-session.sh check cc
~/.catpaw/tools/provider-session.sh open cc "$PWD"
~/.catpaw/tools/provider-session.sh send cc "<prompt>"
~/.catpaw/tools/provider-session.sh status cc
~/.catpaw/tools/provider-session.sh read cc 200
~/.catpaw/tools/provider-session.sh wait cc 1200
~/.catpaw/tools/provider-session.sh close cc
```

Supported aliases:

| Alias | Provider |
|---|---|
| `cc`, `claude` | Claude Code |
| `cx`, `codex` | Codex |
| `gemini` | Gemini |
| `oc`, `opencode` | OpenCode |

The wrapper is optional and tmux-backed. If tmux or the target provider CLI is
unavailable, use `check` to record the capability result and fall back through
the invocation ladder. Do not copy or depend on user-local scripts such as
`~/.claude/scripts/cabinet.sh`; CatPaw may use cabinet-style behavior only as
an implementation pattern.

Capability report shape:

```text
PROVIDER claude
CLI available claude
TMUX missing tmux
OBSERVABLE unavailable
FALLBACK non-interactive-cli
```

If both tmux and the target provider CLI are unavailable, this is not a CatPaw
failure. Record the missing capability, use current-tool subagent or inline role
lens when allowed, and surface any forced-gate provider gap.

Wait policy:

- Quick tasks may use short waits.
- L3, release, security, incident, or complex review may wait longer when the
  session is alive and progress checks show activity.
- A fixed wait timeout is an observation point, not proof of provider failure.
- If the provider is waiting for input, send a bounded follow-up or ask the user
  when the next step needs product judgment, credentials, or external action.

## Multi-Round Dialogue

Default to CatPaw-mediated transcript. Provider-native resume/session is an
optimization, not the source of truth.

Maintain this state between rounds:

```text
Topic:
Goal:
Mode:
Provider:
Round:
Invocation:
Observable surface:
Observed status:
Last progress check:
Wait policy:
Primary position:
Provider claim:
Accepted:
Rejected:
Conflicts:
Evidence:
Next prompt:
Stop condition:
```

For each new round:

1. Summarize prior provider claim in one compact paragraph.
2. State the primary agent's critique or unresolved conflict.
3. Ask one precise next question.
4. Tell the provider what output shape is needed.
5. After the provider responds, classify findings as accepted, rejected, or conflict.

Stop when:

- the user-requested decision is clear;
- the provider repeats itself without new evidence;
- remaining disagreement is a product/user decision;
- additional rounds require external action, destructive action, or credentials;
- the user asks to stop.

Unavailable providers are not successful stop conditions for forced gates.
Record the timeout/error/no-output reason, observed process/session state, try
the required fallback, and surface any remaining provider gap in the plan or
review summary. Do not treat no stdout as unavailable while the process/session
is still alive.

## Implement Mode

Default implementation request is advisory:

```text
Propose a minimal patch or implementation plan. Do not edit files. Include file
paths, risks, and verification commands.
```

The primary agent applies or rejects changes. A provider may write files only
when all of these are true:

- the user explicitly approved provider write-through;
- the write scope is listed;
- the provider runs in a sandbox or isolated worktree when practical;
- the primary agent reviews the diff before reporting success.

## Prompt Contract

Every provider prompt should include:

- task goal;
- relevant facts and constraints;
- allowed mode (`ask`, `discuss`, `debug`, `review`, `implement`, `summarize`);
- whether filesystem/tool access is allowed;
- expected output shape;
- safety limits.

Good minimum output shape:

```text
Position:
Evidence:
Risks:
Questions:
Suggested next step:
```

For review or conflicting opinions, use:

```text
Accepted:
Rejected:
Conflicts:
Decision:
```

## Artifacts

- L0/L1 provider calls are usually inline.
- L2/L3 provider discussions with durable decision value may be recorded under
  `.catpaw/research/<topic>/provider-dialogue.md`.
- Formal review still writes `.catpaw/reviews/<req-id>-<slug>/summary.md`.
- Forced provider gaps must be recorded in the relevant plan, review summary, or
  inline handoff when no artifact exists.
- Do not create provider-specific directories by default.

## Limits

- Do not send secrets, private credentials, or unnecessary personal data to an
  external provider.
- Do not let providers commit, push, create PRs, deploy, or perform destructive
  operations.
- Do not auto-apply external provider fixes without primary-agent review.
- Do not hide provider disagreement; summarize conflicts and make the primary
  judgment explicit.
