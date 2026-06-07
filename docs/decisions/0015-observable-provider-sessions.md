# ADR-0015: Observable Provider Sessions

Status: Accepted

## Context

CatPaw provider orchestration originally focused on non-interactive CLI calls
and provider-native resume. That works for quick asks and small reviews, but it
is weak for L3 review, release/security/incident gates, multi-round debugging,
and provider tasks expected to read many files.

In those cases a provider may be alive and working while stdout is silent. The
primary agent needs a way to distinguish a long-running provider from a failed,
blocked, or unavailable provider.

## Decision

Add an observable long-running provider mode to `catpaw:provider`.

CatPaw keeps non-interactive CLI as the light default for short tasks, but
prefers observable sessions for long-running or high-risk provider work when an
observable surface is available.

Add an optional tmux-backed runtime tool:

```text
src/runtime/tools/provider-session.sh
```

The tool supports mainstream provider aliases:

- Claude Code: `cc`, `claude`
- Codex: `cx`, `codex`
- Gemini: `gemini`
- OpenCode: `oc`, `opencode`

The tool is optional. CatPaw does not require tmux and does not depend on
user-local scripts such as `~/.claude/scripts/cabinet.sh`. Cabinet-style tools
are treated as useful implementation patterns, not runtime dependencies.

Provider availability remains capability-aware. If tmux is missing, use
provider-native or non-interactive CLI. If the target provider CLI or
subscription is missing, use current-tool subagent or inline role lens with an
explicit provider gap when the workflow requires one.

`provider-session.sh check <provider>` reports tmux and provider CLI
availability without requiring an active session, so agents can choose the
fallback path before starting long-running work.

## Consequences

- Long-running provider work can record invocation, observable surface,
  observed status, last progress check, and wait policy.
- No stdout while a provider process/session is alive is not sufficient evidence
  of provider unavailability.
- Provider availability decisions should inspect process state, session status,
  recent output, provider-native state, or explicit waiting-for-input text.
- Observable mode does not expand provider permissions and does not authorize
  commit, push, PR, deploy, destructive action, scope expansion, or secret
  access.
- Quick provider asks can still use non-interactive CLI.
- Missing tmux, missing secondary provider CLI, or a one-provider user setup
  downgrades verification strength; it does not make ordinary CatPaw work
  unusable.

## References

- `src/runtime/commands/provider.md`
- `src/runtime/commands/review.md`
- `src/runtime/specs/08-operating-rules.md`
- `src/runtime/templates/provider-dialogue.md`
- `src/runtime/tools/provider-session.sh`
