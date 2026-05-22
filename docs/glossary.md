# Glossary

CatPaw-specific terms only. Runtime behavior is defined in `src/runtime/specs/` and `src/runtime/commands/`.

## artifact

A markdown node under a project board: req, plan, research note, review summary, test matrix, or lessons entry.

## artifact graph

The req-rooted graph: `req -> plan -> research -> tests -> reviews -> lessons / project documentation artifacts` when those artifacts exist.

## board / project board

A project's `.catpaw/` directory. It holds artifacts and `index.md`; it never holds runtime files such as `specs/`, `commands/`, `templates/`, or `roles/`.

## canonical files

The `runtime-manifest.json` `canonicalFiles` list copied from a resolved runtime package root into `~/.catpaw/` by `upgrade-runtime`.

## command

A markdown runbook under `src/runtime/commands/`, installed as `~/.catpaw/commands/`. Commands define agent behavior; they are not executable code.

## global runtime

The installed CatPaw distribution at `~/.catpaw/`, stamped by `~/.catpaw/VERSION`.

## index (`index.md`)

A board's active dashboard and runtime stamp holder. It is not durable history.

## lifecycle frontmatter

YAML metadata on artifacts. Req frontmatter is the lifecycle source of truth for req status.

## migration / migration file

A `migrations/<version>.md` schema delta replayed by `upgrade-project` when a board moves from its stamp to the installed runtime.

## one-shot upgrade / replay

The default `upgrade-project` model: replay all existing migrations in `(stamp, installed-runtime]` in one dry-run/apply cycle.

## provider dialogue

A primary-agent-managed exchange with another provider. The primary agent owns prompt bounds, finding classification, and final decisions.

## registry

The per-machine board index at `~/.catpaw/state/projects.json`. It stores paths, stamps, and last-seen metadata; never artifact contents.

## runtime

The CatPaw distribution contract, whether authored in `src/runtime/`, built in `dist/runtime/`, or installed at `~/.catpaw/`.

## runtime stamp / stamp

The `runtime: x.y.z` value in board `index.md` frontmatter. It records the installed runtime version that last processed the board.

## source repo

The maintainer-facing checkout. Runtime package source lives under `src/runtime/`; source edits do not affect `~/.catpaw/` until explicit build/upgrade actions run.

## state directory (`~/.catpaw/state/`)

Per-machine local state inside the installed runtime path. Excluded from `canonicalFiles`, lazily created, never synced.

## upgrade pipeline

The explicit chain: source change -> `release-runtime` -> built runtime package -> `upgrade-runtime` -> registered board survey -> optional `upgrade-project` apply.
