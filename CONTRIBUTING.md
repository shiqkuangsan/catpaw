# Contributing

CatPaw 3.0 is a Hybrid Runtime: agents make contextual decisions, executable
tools record and verify deterministic state, and users authorize writes and
external effects. Contributions should keep those boundaries visible and the
runtime small.

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

- Keep the lifecycle `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Preserve Direct, Tracked, and Gated semantics unless an accepted ADR changes
  them.
- Treat `src/runtime/schemas/board-v2.json` as the board metadata contract.
- Keep board mutations dry-run by default and write only with explicit
  `--apply`.
- Add a migration when a released project board schema must change.
- Keep callable external Agents limited to `cc` and `cx` unless a future
  accepted decision deliberately changes the boundary.
- Update public docs when installation, CLI, artifact, or activation behavior
  changes.

## Maintainer Documentation

Use `docs/` to explain why a design exists. Current behavior belongs in runtime
policy, guidance, schema, or executable code. Significant design changes need
a compact ADR with Status, Context, Decision, Consequences, and References.

Historical ADRs remain decision records even when later vocabulary supersedes
part of their operational description.

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
