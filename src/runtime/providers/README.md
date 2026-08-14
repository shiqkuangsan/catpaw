# CatPaw-managed Agent Transports

CatPaw manages two reciprocal external read-only transports:

| Key | Agent | Aliases |
|---|---|---|
| `cc` | Claude Code | `claude`, `claude-code` |
| `cx` | Codex | `codex` |

`老二` / `laoer` routes to the other host: Codex calls `cc`; Claude Code calls
`cx`. Other coding tools may host CatPaw or be available to the primary agent,
but they are not CatPaw-managed callable transports. cc/cx is not the complete
Agent roster.

## Invocation Choice

The primary agent decides when to delegate, which `explore` or `check` method is
useful, how to schedule it, and what fallback to use. Current cc/cx profiles are
read-only: they can investigate, design, review, or verify, but cannot carry a
writable `build` task. A prompt cannot upgrade a read-only transport.

- current-tool Agent: host-provided local work surface;
- non-interactive cc/cx: one-shot investigation, review, debug, or smoke test;
- observable session: long-running or multi-round second opinion.

These are options, not a fixed priority. Independence, context, cost, latency,
and enforcement determine the useful surface.

Run `transport check` first. It checks only local binary and tmux availability; it
does not invoke a model or validate authentication, compatibility, subscription,
or provider access. Reports keep provider access `unverified`, list fallback
options, and identify `primary-agent` as the decision owner. A missing provider
does not require the user to install or purchase another tool; record a gap when
required independent Proof remains unavailable.

## Observable CLI

```text
catpaw transport check  --agent <cc|cx>
catpaw transport open   --agent <cc|cx> --label <purpose> --project <path>
catpaw transport send   --agent <cc|cx> --label <purpose> --project <path> --prompt <text>
catpaw transport status --agent <cc|cx> --label <purpose> --project <path>
catpaw transport read   --agent <cc|cx> --label <purpose> --project <path> --lines <n>
catpaw transport close  --agent <cc|cx> --label <purpose> --project <path>
```

`agent check|open|send|status|read|close` remains a 3.x compatibility surface.
Use `--prompt-file <path|->` when the prompt should come from a file or stdin.

The session key combines Agent, absolute project path, and label. `send` is
non-blocking. Sessions retain process exit state; `status` reports open, failed,
or exited, provider exit code, changed/stable output, and explicit waiting text.
A zero exit, empty stdout, or stable pane does not prove completion.

## Transport Handoff

Each call receives the complete bounded delegation facts from
[Agent Collaboration](../guidance/agent-dispatch.md), plus:

- absolute project/worktree path and provider-visible surface;
- enforced read-only mechanism or `no-write requested + audited`;
- session label, observation path, and available fallback surfaces;
- previous claim, primary-agent critique, and narrowed next question.

Do not rely on global Agent memory, skills, previous sessions, or provider
customization for critical context.

## Sensitive State And Side Effects

Prompt-only read-only is not isolation. Enforced read-only must prevent
write/delete/rename at the tool boundary through a sandbox, read-only mount or
URI, or minimal allowlist. Do not expose unrelated coding-tool state, user
configuration, credentials, production data, or workspaces. Provide a minimal
export or snapshot when needed.

If the environment cannot prevent writes, label the call
`no-write requested + audited`; it cannot satisfy an enforced read-only gate.
Record the protected scope and audit relevant writes, deletes, renames, and
worktree diff afterward. Unexpected mutation makes the output failed even when
its content is useful.

## Proof And Approval

The primary agent reads and verifies output before marking a candidate accepted,
rejected, or superseded. Agent output is not Proof merely because the process
exited, and neither output nor Proof grants Approval.

Current cc/cx profiles must not stage or commit. Push, PR, deploy, protected/base
updates, history-changing or destructive actions, external effects, secret
access, and permission expansion still require explicit user Approval.

Recipes:

- [Claude Code](claude.md)
- [Codex](codex.md)
