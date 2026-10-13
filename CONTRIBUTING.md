# Contributing

CatPaw supplies a lightweight work protocol and local project memory for coding
agents. The primary agent owns judgment and final acceptance; tools keep records
and operations consistent. Work carries the outcome, Evidence supports claims,
and user permissions bound actions. The visible flow is
`Understand -> Execute -> Check -> Finish`.

Strengthen continuity and inspectable delivery while reducing the attention
required to use them. New guidance should change an action, boundary, or evidence
requirement; prefer an existing mechanism before adding a command, field, or file.

## Source Layout

| Path | Purpose |
|---|---|
| `src/runtime/` | Versioned runtime source |
| `scripts/` | Source build and verification tooling |
| `tests/` | Executable behavior and documentation contracts |
| `docs/` | Maintainer rationale and ADRs; never installed |
| `dist/runtime/` | Generated package; ignored by Git |

The package boundary is
[`src/runtime/runtime-manifest.json`](src/runtime/runtime-manifest.json).
Project `.catpaw/` directories are user data and must never receive a copied
runtime.

## Development Workflow

1. Read the canonical runtime owner for the behavior being changed.
2. Make the smallest coherent source or maintainer-doc change.
3. Add or update executable tests for deterministic contracts.
4. When runtime behavior changes, review `VERSION`, `CHANGELOG.md`, the
   manifest, templates, schema, and migration impact.
5. Run focused tests, then the complete verification set appropriate to the
   change.

Typical commands:

```bash
node --test
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
git diff --check
```

Building source does not automatically install, apply, or migrate CatPaw. Do
not modify `~/.catpaw/`, adapters, registry state, or real project boards during
source verification.

## Runtime Change Checklist

- Keep Work as the primary entry, Evidence as support for claims, and permission
  boundaries in operational rules. Proof and Approval remain compatibility terms.
- Preserve the internal schema 2 lifecycle and risk metadata unless an accepted
  ADR changes their machine contract; do not make modes or stage values a user
  prerequisite.
- Keep Agent collaboration intent-based (`explore`, `build`, `check`) and keep
  independent `check` Proof bound to a different actor from the builder.
- Treat `src/runtime/schemas/board-v2.json` as the board metadata contract.
- Keep board mutations dry-run by default and write only with explicit
  `--apply`.
- Add a migration when a released project board schema must change.
- Keep CatPaw-managed external transports limited to `cc` and `cx`; they do not
  limit the primary agent's host-provided roster.
- Update public docs when installation, CLI, artifact, or activation behavior
  changes.

## Maintainer Documentation

Use `docs/` to explain why a design exists. Current behavior belongs in runtime
policy, guidance, schema, or executable code. Significant design changes need
a compact ADR with Status, Context, Decision, Consequences, and References.

Historical ADRs remain decision records even when later vocabulary supersedes
part of their operational description. Do not modernize historical bodies by
mechanical replacement. Update Status/current-interpretation routing when a
later decision changes how an otherwise accepted ADR must be read.

## Submission Expectations

Summarize the problem, changed authorities, migration impact, and verification
evidence. Do not include generated dist files, local state, project boards,
logs, credentials, or unrelated formatting churn.

Before a requested commit, inspect the exact staged scope and scan for likely
credentials:

```bash
git status --short
rg -n -i 'token|secret|api[_-]?key|bearer|password|passwd|credential|private[_-]?key|client[_-]?secret|access[_-]?key' .
```
