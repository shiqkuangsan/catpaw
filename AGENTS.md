# AGENTS.md

This repository is the versioned source for the CatPaw runtime package.

## CatPaw Protocol

- CatPaw runtime path: `~/.catpaw/`; source repo: this repository.
- When this repository's `.catpaw/` board is involved, or the user mentions
  CatPaw/init/migration/reqs/plans/research/reviews, read
  `~/.catpaw/runtime-policy.md` before acting.
- Project-local `.catpaw/` directories are artifact boards; do not copy the
  full runtime package into them.

## Repository role

- This repo defines and evolves the CatPaw runtime.
- The installed runtime distribution lives at `~/.catpaw/`.
- Normal CatPaw users and AI agents should treat `~/.catpaw/` as the trusted runtime reference after installation.
- Editing this source repo does not automatically update `~/.catpaw/`; install or upgrade must be explicit.
- Project-local `.catpaw/` directories are artifact boards and must not receive copies of this full runtime package.

## Runtime package

Canonical runtime package source files are declared in
`src/runtime/runtime-manifest.json`. Its `canonicalFiles` entries are relative
to `src/runtime/` and currently include:

- `VERSION`
- `runtime-manifest.json`
- `README.md`
- `AI-INSTALL.md`
- `CHANGELOG.md`
- `runtime-policy.md`
- `commands/`
- `guides/`
- `migrations/`
- `roles/`
- `snippets/`
- `source-evidence/`
- `specs/`
- `templates/`

When changing runtime behavior, command semantics, artifact schema, install layout, or provider adapter behavior, check whether `src/runtime/VERSION`, `src/runtime/CHANGELOG.md`, `src/runtime/runtime-manifest.json`, and `scripts/build-runtime.mjs` also need updates.

## Operational routing

- If asked to install CatPaw from this repo, read root `AI-INSTALL.md` first, then `src/runtime/AI-INSTALL.md`.
- If asked to release or prepare a CatPaw runtime source change, read `src/runtime/commands/release-runtime.md`.
- If asked to upgrade an existing installed runtime, read root `AI-INSTALL.md`, `src/runtime/AI-INSTALL.md`, and `src/runtime/commands/upgrade-runtime.md`.
- If asked to upgrade an existing project `.catpaw/` artifact board, read `src/runtime/commands/upgrade-project.md`.
- If asked to call another provider/agent such as Laoer / 老二 / second opinion, Laosan / 老三 / third opinion, Claude Code, Codex, Gemini, or a subagent, read `src/runtime/commands/provider.md`.
- If asked to remove a project board entry from the global registry, read `src/runtime/commands/unregister-project.md`.
- If asked to inspect or prune the global project registry, read `src/runtime/commands/registry-doctor.md`.
- If asked to initialize CatPaw in a project, read `src/runtime/AI-INSTALL.md` and `src/runtime/commands/init-project.md`.
- If asked to migrate an older CatPaw artifact layout such as `todos/`, read `src/runtime/AI-INSTALL.md` and `src/runtime/commands/migrate-project.md`.
- If asked about workflow classification, planning, review, status, artifact health, reconciliation, or closeout semantics, prefer the matching file in `src/runtime/commands/` plus `src/runtime/runtime-policy.md`.
- Provider-specific user walkthroughs live in `src/runtime/guides/`; provider adapter snippets live in `src/runtime/snippets/`.

## Source vs installed runtime

- Source repo root files are maintainer-facing.
- Runtime package source files live under `src/runtime/`.
- `dist/runtime/` is generated from `src/runtime/` by `scripts/build-runtime.mjs` and is not tracked.
- Installed files under `~/.catpaw/` are the normal runtime reference for user projects.
- Do not claim a runtime install or upgrade is complete just because this source repo changed.
- Runtime install or upgrade reports should verify the installed tree, runtime version or manifest, and obvious secret scan results.
- Do not install runtime files under provider-specific config directories such as `~/.claude/` or `~/.codex/`; those locations should only receive thin adapter instructions when the user asks.

## Maintainer Docs

- Design rationale, architecture overviews, and decision records live in `docs/`.
- `docs/` is maintainer-only: not in `src/runtime/runtime-manifest.canonicalFiles`, never copied to `~/.catpaw/`, never affects releases.
- When the answer to a question is "what should agents follow?" use `src/runtime/specs/` or `src/runtime/commands/`. When it is "why is it like this?" use `docs/`.
- Significant design decisions should result in a new ADR under `docs/decisions/NNNN-*.md`.

## Language and style

- Main documentation is Simplified Chinese by default, with technical terms kept in English where natural.
- Runtime-facing names must not include `v4` or other version suffixes.
- Prefer precise, compact protocol wording over broad explanations.
- Keep `AGENTS.md` operational; put explanatory protocol detail in `src/runtime/runtime-policy.md` or `src/runtime/specs/`.

## Safety

- Do not commit, push, create GitHub repositories, create PRs, deploy, or publish anything unless explicitly asked.
- Do not run destructive cleanup of old project artifacts such as `todos/` without separately listing targets and receiving confirmation.
- Do not delete unknown files from `~/.catpaw/` during install or upgrade.
- Do not modify provider global files such as `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md` unless the user explicitly asks.
- Before commits, check for credentials with `rg -i 'token|secret|api[_-]?key|bearer|password|passwd'`.

## CatPaw boundaries

- CatPaw is the workflow orchestration layer.
- superpowers is the execution methodology layer.
- gstack is specialist vocabulary and staged review inspiration, not an installed workflow dependency.
- Expert Council is the advisory, review, and strategy layer.
- Providers such as the current coding agent, current-tool subagents, Laoer / 老二 / second opinion, Laosan / 老三 / third opinion, and future tools perform the work.
- Expert Council, providers, superpowers, gstack, commands, and hooks never authorize commit, push, PR, deploy, or destructive operations automatically.
