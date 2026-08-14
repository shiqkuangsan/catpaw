# ADR-0026: User-Facing Concept Consolidation

Status: Accepted

Date: 2026-08-13

## Context

CatPaw 3 established useful distinctions between lifecycle stages, risk modes,
artifacts, Evidence types, Lenses, Agent Roles, delegation contracts, ownership,
delivery, acceptance, and Git authority. Each distinction protected a real
boundary, but too many of them became public vocabulary. Users had to learn the
runtime's implementation model before they could understand what CatPaw did for
them.

The source-only 3.4 Role Catalog intensified this problem by publishing six
responsibility names even though users primarily need to know what is being
done, why completion is credible, and which actions still require their consent.
Concept removal must not erase independence, isolation, verification, or
authorization semantics.

## Decision

### Publish three user concepts

The complete user-facing model is:

```text
Work | Proof | Approval
```

- **Work** states the desired outcome and visible progress. Small, local work may
  stay conversational; durable work is recorded on the project board.
- **Proof** contains inspectable facts supporting a completion claim. Schema 2
  continues to store Proof as typed Evidence for compatibility.
- **Approval** is the user's authority or explicit risk acceptance. It is not a
  new board artifact, and Proof can never manufacture it.

Milestone remains an optional grouping tool for several Work items. Plan,
Evidence metadata, modes, lifecycle stages, and other board details are storage
or runtime vocabulary rather than prerequisites for ordinary use.

### Keep a simple visible flow

Public explanations use:

```text
Understand -> Execute -> Check -> Finish
```

The runtime may still map these phases to schema 2's seven stage values and to
its normal/high-risk routing policy. The internal `direct`, `tracked`, and
`gated` values remain compatible metadata; users do not need to select or learn
them. A high-risk Work requires independent Proof, and a missing required Proof
can close only with explicit user Approval of the exact gap.

### Consolidate Agent collaboration into three intents

The public Agent vocabulary is:

- **explore**: investigate facts, boundaries, options, and designs;
- **build**: implement or integrate an exact isolated scope;
- **check**: review for defects or verify acceptance.

Review and verification remain distinct check methods. Required independent
Proof must come from an actor different from the actor that built the checked
scope. `explore`, `build`, and `check` are bounded task intents, not personas,
models, providers, identities, or sources of permission.

The 3.4 six-Role catalog had not crossed the release/activation boundary, so the
source replaces it with a three-intent catalog instead of carrying a public
Role compatibility layer. Installed 3.3 behavior remains unaffected.

### Hide delegation and Git mechanics

Every delegated task still carries the outcome, facts, exact read/write scope,
constraints, deliverable, verification, dependencies, stop conditions, and
allowed actions. These fields remain a runtime contract but are not presented as
a user concept named Task Envelope.

Each mutable surface still has one accountable writer. Build agents may create
bounded local commits only under an explicit exact grant on an isolated
non-protected worktree/branch. Clean candidate integration requires a prior
primary-agent acceptance decision and an exact target/commit grant. These are
scoped authorization rules, not separate user-facing Git Envelope products.

Remote, protected/base, history-changing, destructive, secret, permission-
expanding, and external actions continue to require explicit user Approval.

### Add preferred CLI language without changing storage

- `proof add` becomes the preferred alias for schema 2 `evidence add`.
- `agent intents` and `agent intent --intent <id>` expose the three task intents.
- `work start --high-risk` maps to internal `mode: gated`; ordinary `work start`
  continues to map to `mode: tracked`.
- The already-installed `evidence add` and `--mode tracked|gated` inputs remain
  compatible but are not primary documentation language.

Board schema remains 2. No project migration, artifact rewrite, runtime
activation, adapter update, registry mutation, or fleet refresh is implied.

## Consequences

- Users can understand CatPaw without learning its orchestration internals.
- Maintainers and conforming hosts still retain precise safety and storage
  contracts in on-demand guidance and executable tests.
- Public CLI and documentation no longer expose the source-only six-Role model.
- Compatibility terms remain visible in raw board metadata, migration material,
  maintainer history, and legacy CLI help where technically necessary.
- Approval remains a semantic user boundary rather than a weakly authenticated
  artifact. Stronger approval provenance can be designed separately.
- CatPaw must test both concept-budget discipline and retained safety semantics;
  wording simplification alone is insufficient.

## Amendments

- ADR-0019's public modes, artifact, and judgment vocabulary becomes internal
  runtime/storage detail behind Work / Proof / Approval.
- ADR-0025's six public Roles become three task intents; Executor ownership is
  described publicly as primary-agent responsibility.
- ADR-0022 through ADR-0025 retain their Git, independence, isolation, and
  acceptance boundaries without their envelope/owner terms becoming user
  concepts.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [Agent collaboration](../../src/runtime/guidance/agent-dispatch.md)
- [Independent Proof](../../src/runtime/guidance/independent-checks.md)
- [Board schema 2](../../src/runtime/schemas/board-v2.json)
- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [ADR-0025](0025-executor-owned-advisory-orchestration.md)
