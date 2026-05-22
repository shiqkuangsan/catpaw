# catpaw:provider

Coordinate external provider agents through CLI or native subagent mechanisms.

This command is broader than review. Use it when the primary agent needs another
agent for architecture discussion, task research, bug diagnosis, implementation
advice, code review, multi-provider disagreement, or a multi-round technical
dialogue.

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

## CLI Playbook

These are default non-interactive shapes. Prefer passing compact context through
the prompt instead of giving the provider broad filesystem permissions.

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
- Do not create provider-specific directories by default.

## Limits

- Do not send secrets, private credentials, or unnecessary personal data to an
  external provider.
- Do not let providers commit, push, create PRs, deploy, or perform destructive
  operations.
- Do not auto-apply external provider fixes without primary-agent review.
- Do not hide provider disagreement; summarize conflicts and make the primary
  judgment explicit.
