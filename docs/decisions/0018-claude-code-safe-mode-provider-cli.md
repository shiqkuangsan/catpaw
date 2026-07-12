# ADR-0018: Claude Code Safe-Mode Provider CLI

Status: Accepted; callable provider scope amended by ADR-0019

## Context

CatPaw routes Laoer / `老二` to Claude Code when Codex is the primary agent.
The previous non-interactive Claude Code examples passed complex review prompts
as argv text and allowed Claude Code's normal customization stack to initialize.

In practice, CLAUDE.md, skills, plugins, hooks, MCP servers, and other
customizations can intercept or distract complex review/debug prompts. Claude
may return workspace status or readiness text instead of the requested review.
`--add-dir` is also variadic, so prompt text should not be appended after it.

## Decision

Claude Code read-only review/debug defaults to stdin prompt input plus
`--safe-mode`, `--permission-mode plan`, and
`--disallowedTools Edit,Write,NotebookEdit`.

Quick prompt-argument invocation remains acceptable for tiny smoke/ask calls,
but not as the default for complex review/debug. Multi-directory review must
pass directories through `--add-dir` and the task prompt through stdin.

Safe mode disables custom context. Provider prompts must be self-contained:
task background, constraints, paths, output format, forbidden actions, and
acceptance focus.

## Consequences

- Claude Code provider calls become less dependent on user-local customizations.
- Review/debug calls are less likely to modify files accidentally.
- Provider prompts must carry more explicit context.
- Unrelated initialization/status output is no usable evidence and should
  trigger fallback/gap handling.

## References

- `src/runtime/commands/provider.md`
- `src/runtime/commands/review.md`
- `src/runtime/specs/08-operating-rules.md`
