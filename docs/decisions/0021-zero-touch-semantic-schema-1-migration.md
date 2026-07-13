# ADR-0021: Zero-touch Semantic Schema 1 Migration

Status: Accepted

Date: 2026-07-13

## Context

ADR-0020 reduced thousands of migration blockers by converting only artifacts
with complete metadata and preserving the rest under `legacy/schema-1/`. That
made migration safe to run, but it produced a board that looked incomplete:
ordinary users saw fewer Work Items, Plans, Milestones, and Evidence records
than existed before migration. Asking users to reconstruct machine metadata is
not a viable product contract.

CatPaw needs to preserve the complete project story without adding a second
historical schema or exposing migration internals as user work.

## Decision

Adopt zero-touch semantic conversion for every recognized schema 1 artifact.

1. Infer missing fields in this order: explicit valid metadata; canonical
   aliases; filename, heading, and artifact root; scoped status prose and the
   project index; Milestone scope and artifact bindings; conservative defaults.
2. Preserve explicit facts. Conflicting canonical identities, duplicate IDs,
   unresolved Plan identity, and destination collisions remain blockers.
3. Map unknown nonterminal status to `blocked`, never to `done`. Map legacy
   paused, deferred, backlog, and pending language to `blocked`; explicit or
   strongly scoped completion and cancellation language may map to terminal
   states. Negated terminal language is ignored. Artifact existence affects
   stage only; graph-derived completion requires an explicitly terminal Plan
   plus completed Test results. Unknown nonterminal Mode defaults to `gated`;
   terminal history may default to `tracked`.
4. Infer stage from terminal state or existing Plan/Test/Review relationships.
   When no historical date exists, use the deterministic migration observation
   date and report that inference rather than requesting user input.
5. Treat Evidence as independent only when an explicit boolean and a named
   Agent support that claim. Unbound records become topic Evidence instead of
   being dropped.
6. Preserve the source index narrative and rewrite only deterministic local
   links; managed dashboard markers remain machine-owned.
7. Read only positive Milestone Scope sections. Validate managed Scope markers
   and tables with the runtime parser, and merge conflicting Milestone status
   conservatively with a warning instead of using file order.
8. Store every original schema 1 file byte-for-byte under the checksummed
   legacy archive. The archive is provenance and rollback material, not a
   substitute for native artifacts.
9. For historical Gated Work already closed as `done`, generate explicit
   reflection Evidence naming unavailable modern completion gates. This is a
   migration gap record, not a claim that an independent check occurred and
   not authority for any external action.
10. Keep filesystem escapes, unsupported entries, invalid UTF-8, malformed
   source structure, stale preimages, and staged-validation failures as hard
   blockers. Migration remains dry-run by default and project apply remains a
   separate authorization.

No `recordState: historical` concept or nullable parallel artifact model is
introduced. Schema 2 remains the only live board model.

## Consequences

- Users do not write or understand migration metadata.
- Native artifact counts preserve the recognized schema 1 project story;
  `legacy/schema-1/` provides exact provenance rather than hidden overflow.
- Some lifecycle fields are conservative normalizations, not recovered
  historical facts. Warnings and archived originals make that distinction
  inspectable.
- Existing schema 2 boards and their mutation rules are unchanged.
- Schema 1 previews produced before 3.0.4 are superseded and must be rerun.
- Runtime activation, registry mutation, and each project migration remain
  independently authorized.

This ADR supersedes ADR-0020.

## References

- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [ADR-0020](0020-selective-schema-1-migration.md)
- [Migration pipeline](../architecture/migration-pipeline.md)
- [Runtime migration authority](../../src/runtime/migrations/schema-2.md)
- [Board schema 2](../../src/runtime/schemas/board-v2.json)
