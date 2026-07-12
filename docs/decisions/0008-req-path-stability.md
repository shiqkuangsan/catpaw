# ADR-0008: Req Paths Are Identity-Stable

Status: Superseded by ADR-0019

## Context

Some CatPaw artifacts have stateful locations, such as `plans/active/` and `plans/archive/`. Reqs are different: they are graph roots referenced by plans, reviews, tests, research, and lessons.

Moving req files as lifecycle state changes would make path location a second lifecycle source of truth and would force link rewrites.

## Decision

Req files stay directly under `.catpaw/reqs/` for their full lifecycle. Req status lives in YAML frontmatter, not in directory names.

Plans may still move between active/archive locations because they are execution artifacts, not graph identities. Req-bound review summaries also remain at their req-scoped path by default.

## Consequences

- Req links remain stable.
- Req frontmatter is the lifecycle source of truth.
- Closing a req is metadata and dashboard cleanup, not a file move.
- Doctor/reconcile do not need to reconcile path-state against metadata-state.

## References

- `src/runtime/specs/03-project-directory.md`
- `src/runtime/commands/close.md`
- `src/runtime/commands/review.md`
