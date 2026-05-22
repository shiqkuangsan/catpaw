# ADR-0010: Split Source Root From Runtime Package Root

Status: Accepted

## Context

Using the repository root as the runtime package root made early releases simple, but it blurred source-only files with installable runtime files. Future maintainer resources, tests, scripts, assets, and generated output needed room to exist without risking accidental installation.

## Decision

Author runtime-facing files under `src/runtime/` and build an installable package root at `dist/runtime/`.

`src/runtime/runtime-manifest.json` remains the package manifest. Its `canonicalFiles` are relative to the package root being authored or installed. Root-level files and directories such as `docs/`, `scripts/`, and `AGENTS.md` are source-only.

## Consequences

- The installed layout under `~/.catpaw/` stays unchanged.
- Install/upgrade flows must resolve a runtime package root before copying.
- Source checkouts build from `src/runtime/` to `dist/runtime/`.
- Maintainer resources can grow at repository root without entering the runtime distribution.

## References

- `scripts/build-runtime.mjs`
- `src/runtime/runtime-manifest.json`
- `src/runtime/AI-INSTALL.md`
- `src/runtime/commands/upgrade-runtime.md`
- `src/runtime/specs/11-runtime-package.md`
