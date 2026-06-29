# CatPaw Maintainer Docs

Maintainer-facing design notes for the CatPaw source repository. These docs explain why the runtime is shaped this way; they are not the runtime contract.

## Authority Boundary

| Surface | Audience | Authority |
|---|---|---|
| `src/runtime/specs/` | Users + agents | Protocol definitions: what CatPaw is |
| `src/runtime/commands/` | Users + agents | Runbook semantics: what agents should do |
| `src/runtime/migrations/` | `upgrade-project` | Per-version project schema deltas |
| `src/runtime/templates/` | Artifact authors | Current artifact shape |
| `docs/` | Maintainers | Rationale, mental models, decision history |

Rule of thumb:

- "What should an agent follow?" -> `src/runtime/specs/` or `src/runtime/commands/`.
- "Why is the system designed this way?" -> `docs/`.

## Distribution Boundary

`docs/` is source-only. It is not listed in `src/runtime/runtime-manifest.json` `canonicalFiles`, is not copied to `~/.catpaw/`, and does not require runtime version bumps or migration files. See [ADR-0005](decisions/0005-docs-not-distributed.md).

## Structure

```text
docs/
├── README.md
├── glossary.md
├── architecture/
│   ├── three-layer-model.md
│   ├── sync-and-references.md
│   └── migration-pipeline.md
└── decisions/
    ├── 0001-version-stamp-on-index.md
    ├── 0002-canonical-files-exclude-state.md
    ├── 0003-one-shot-upgrade-via-migrations.md
    ├── 0004-global-project-registry.md
    ├── 0005-docs-not-distributed.md
    ├── 0006-user-visible-dispatch.md
    ├── 0007-runtime-upgrade-project-orchestration.md
    ├── 0008-req-path-stability.md
    ├── 0009-project-stamps-track-runtime.md
    ├── 0010-source-runtime-package-split.md
    ├── 0011-provider-cli-dialogue.md
    ├── 0012-contract-first-quality-gates.md
    ├── 0013-lifecycle-role-orchestration.md
    ├── 0014-interactive-ui-verification.md
    ├── 0015-observable-provider-sessions.md
    └── 0016-milestones-and-subagent-governance.md
```

## Writing Rule

Keep `docs/` explanatory, not normative:

- Architecture notes should describe the model, boundary, and failure mode being avoided.
- ADRs should record the decision and the rejected pressure, not repeat full command behavior.
- Runtime behavior belongs in `src/runtime/specs/` and `src/runtime/commands/`.
- Release notes belong in `src/runtime/CHANGELOG.md`.
- Schema deltas belong in `src/runtime/migrations/`.

## ADR Format

Use compact ADRs: Status, Context, Decision, Consequences, References. Number files sequentially as `decisions/NNNN-short-title.md`. Status values: `Proposed`, `Accepted`, or `Superseded by ADR-NNNN`.
