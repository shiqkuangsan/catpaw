# ADR-0032: Work-Centered Runtime And Verifiable Operations

Status: Accepted

Date: 2026-09-05

## Context

The user approved reorganizing CatPaw around Work, evidence supporting acceptance,
and authorization constraining individual actions. Runtime installation still
required an ad hoc script; completion checked Evidence labels rather than their
result or candidate; every new Work created a separate Plan. Repeated procedural
work increased overhead and introduced new recovery risks.

## Decision

- Work is the primary user entry. Planning is inline by default, with optional
  separate Plan; legacy Plan files remain untouched. Evidence is the preferred
  command, with proof aliases retained. Product decisions, action authorization
  and explicit risk acceptance are distinct; none is manufactured by records.
- Schema 2 gains an explicit flat scalar contract 4 on new Work. Legacy records
  retain their previous semantics. Older runtimes may reject new metadata; this
  is safer than silently completing new Work using old gates. No fleet rewrite.
- New high-risk completion requires current-candidate passed test and independent
  passed review/provider Evidence. Candidate fingerprints cover the declared
  scope, file bytes/modes, acceptance, owner and cycle, excluding board/generated
  output. A later failed/blocked result supersedes an earlier pass. Captured
  commands prove execution facts, not test adequacy or reviewer identity.
- Completed Work pins its accepted candidate; later source changes do not alter
  historical acceptance. Explicit continuation preserves the prior completion
  record and starts a new cycle. Terminal Milestones preserve their snapshot.
- Scoped board operations may tolerate attributable unrelated errors. Global
  path/schema/identity failures still block. Staged validation must not add or
  worsen unrelated errors or rewrite their records. Evidence repair may reduce
  missing gates incrementally without bypassing final completion.
- Runtime and adapter maintenance use persisted, bounded plans. Apply reconstructs
  the candidate from canonical package ownership, checks target/preimage, and writes a durable
  operation receipt. Publication/recovery validates the actual state and refuses
  drift; it cannot overwrite concurrent user work to force a successful rollback.
  Adapter writes are limited to one actual rule file, never its whole directory.
- Keep manifests, owned runtime files, preserved local state, host blocks and
  project boards separate. Versioned backups and unknown local files survive
  activation. Recovery requires the original operation scope and matching state.
- Evaluate executable task scenarios separately from textual instruction checks.
  Bounded Agent smoke may expose behavioral problems, but is not a statistical
  claim that every model follows the instructions or that cost has improved.

## Consequences

The public model becomes lighter while more constraints become inspectable.
The implementation remains local and file-based; no database, daemon, permission
engine, automatic team or new provider requirement is introduced. Legacy command
and artifact compatibility is explicit, not a claim that every older runtime can
write the new contract. New checks cannot authenticate arbitrary assertions or
replace the host's own permission enforcement.

Scoped repair initially tolerates only attributable missing-completion findings;
other graph/schema errors remain global blockers until their ownership contract
is implemented and tested. Filesystem publication uses guarded renames, with a
brief unavailable interval for directories and a durable recovery journal; it
does not claim native atomic exchange or enforced isolation from hostile writers.

Scope-sensitive fingerprinting and persisted recovery add implementation work
that must be justified by real scenarios, adversarial review and preservation
tests. Existing release artifacts remain until the new package and its installed
state pass independent verification.

## References

- [ADR-0031](0031-thin-entrypoints-and-bound-analysis.md)
- [Workflow](../../src/runtime/lib/commands/workflow.mjs)
- [Completion](../../src/runtime/lib/completion-evidence.mjs)
- [Atomic writes](../../src/runtime/lib/atomic-write.mjs)
- [Maintenance](../../src/runtime/guidance/maintenance.md)
