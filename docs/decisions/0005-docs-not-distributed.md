# ADR-0005: `docs/` is Maintainer-Only and Not Distributed

Status: Accepted

## Context

`docs/` contains maintainer rationale: architecture notes, ADRs, and glossary terms. End users and agents already have runtime-facing surfaces: README, install guide, specs, commands, guides, templates, and migrations.

## Decision

Do not include `docs/` in `src/runtime/runtime-manifest.json` `canonicalFiles`. Keep it source-only and tracked in git.

Docs edits do not trigger runtime version bumps, migration files, or runtime release verification.

## Consequences

- Installed runtime stays focused on executable protocol surfaces.
- Maintainer notes can change without release churn.
- Design rationale is available from the source repo, not from `~/.catpaw/`.
- Protocol rules must still be written in specs/commands, not only in docs.

## References

- `src/runtime/runtime-manifest.json`
- `AGENTS.md`
- [docs/README.md](../README.md)
- [ADR-0002](0002-canonical-files-exclude-state.md)
