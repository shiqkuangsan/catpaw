# catpaw:upgrade-project

Upgrade an existing project `.catpaw/` artifact board to the currently installed CatPaw runtime expectations.

## Default Mode

Default to `--dry-run`.

```text
catpaw:upgrade-project --dry-run
catpaw:upgrade-project --apply
```

## Scope

Only inspect or update project-local artifacts under `.catpaw/` and project-local
CatPaw adapter text when explicitly included by the user.

Do not upgrade the global runtime. Use `catpaw:upgrade-runtime` for `~/.catpaw/`.

## Preflight

- Confirm current repository and branch.
- Confirm installed runtime version from `~/.catpaw/VERSION`. If missing, stop and ask the user to install the runtime first.
- Check whether `.catpaw/` exists.
- Read project-local `AGENTS.md`, `CLAUDE.md`, README, and `.gitignore` only if they affect CatPaw routing or git strategy.
- Read `.catpaw/index.md` frontmatter to get the project's `runtime:` stamp. If missing, treat the project as `1.0.0` and warn the user that the stamp will be backfilled on apply.
- Run `catpaw:doctor` style checks first when existing artifacts are present.

## One-shot Upgrade Pipeline

Always converge to the installed runtime version in a single dry-run/apply cycle.

The installed runtime version comes from `~/.catpaw/VERSION`. Migration files
from `~/.catpaw/migrations/` provide artifact schema rewrites when they exist in
the version range.

Runtime-only releases still update the project board stamp. If the installed
runtime is `1.4.2` and the newest migration is `1.3.0`, a board stamped
`1.3.0` gets a stamp-only upgrade to `1.4.2`.

1. Determine `from = project stamp or 1.0.0` and `to = ~/.catpaw/VERSION`.
2. List `migrations/<version>.md` in order from `~/.catpaw/migrations/` for every version `v` such that `from < v <= to`.
3. For each migration file, parse its `Operations` and `User Decisions` sections.
4. Merge operations: a later `rename` overrides earlier `add` of the same field; later `drop` cancels earlier `add`.
5. Collect all user decisions across all replayed migrations into one batch.
6. Build a single dry-run patch summary that shows the converged target state.
7. On `--apply`, write all patches and update `.catpaw/index.md` frontmatter `runtime:` to `to`.

If the project is already at `to`, report no-op and exit.

If any migration declares a major-version break, stop at that version and require explicit user ack before continuing.

## Checks

The checks below are the converged target state for the installed runtime. They restate what the cumulative migrations produce; they do not replace the migration registry.

- Req files:
  - Required lifecycle frontmatter exists: `id`, `type`, `status`, `level`, `priority`, `created`, `updated`, `closed`.
- Plan files:
  - Add or suggest lightweight graph frontmatter: `id`, `req`, `status`, `updated`, `closed`.
- Test matrix files:
  - Add or suggest lightweight graph frontmatter: `id`, `req`, `plan`, `status`, `updated`, `closed`.
- Review summary files:
  - Add or suggest lightweight graph frontmatter: `req`, `plan`, `status`, `mode`, `updated`, `closed`.
- Index:
  - Keep `.catpaw/index.md` active-only.
  - Frontmatter must include `runtime: <installed-runtime-version>` after apply.
  - Do not add completed history.
  - Flag active entries that contradict req frontmatter.
- Links:
  - Flag `plans/active` links that should point to `plans/archive` after closeout.
- Stale wording:
  - Flag unresolved `pending`, `future`, `in progress`, `status: active`, and stale TODO wording when artifacts are terminal.

## Dry-run Output

Show:

```text
Installed runtime:
Project stamp (from):
Target (to):
Migrations replayed:
Findings:
Will update:
Needs user decision:
Recommended next command:
```

Example:

```text
Installed runtime: 1.2.0
Project stamp (from): 1.0.0 (no stamp; treated as 1.0.0)
Target (to): 1.2.0
Migrations replayed: 1.1.0, 1.2.0

Will update:
- .catpaw/index.md: add frontmatter `runtime: 1.2.0`
- .catpaw/plans/active/FR-001-title.md: add graph frontmatter
- .catpaw/tests/matrices/FR-001-title.md: add graph frontmatter

Needs user decision:
- .catpaw/reviews/FR-001-title/summary.md has no mode; choose light or formal.
```

## Apply Behavior

When `--apply` is explicitly requested:

- Apply only the patch-level changes shown in dry-run.
- Prefer adding missing frontmatter over rewriting body content.
- Preserve all user-authored narrative content.
- Always update `.catpaw/index.md` frontmatter `runtime:` to the installed runtime version on success. Runtime-only releases may therefore be stamp-only upgrades.
- Upsert the board's entry in `~/.catpaw/state/projects.json` per `specs/03-project-directory.md` §7: update `stamp` to the installed runtime version; update `lastSeenAt` and `lastSeenVia: upgrade-project`. If no entry exists for this `boardPath`, create one with `registeredVia: upgrade-project` and today's `registeredAt`.
- Re-run doctor-style checks after writing.
- Report changed files and remaining findings.

## Batch Caller Contract

`catpaw:upgrade-runtime` may call this command for every registered board. In
batch context, classify each board into one of these states:

- `current`: board stamp equals the installed runtime version.
- `will-update`: dry-run has patch-level changes and no blockers.
- `needs-user-decision`: migration user decisions cannot be inferred safely.
- `blocked`: major-version break, doctor-style blocker, unreadable board, or unsupported schema.
- `missing`: `boardPath` no longer exists.
- `stamp-mismatch`: registry stamp differs from `.catpaw/index.md`.
- `applied`: `--apply` completed successfully.
- `failed`: attempted apply failed; preserve the error.

## Preflight Registry Sync

When the board exists in `~/.catpaw/state/projects.json` and the run completes preflight without errors, opportunistically update `lastSeenAt` and `lastSeenVia: upgrade-project` even on dry-run, so the registry reflects activity. Do not change `stamp` on dry-run.

If the board does not have an entry, do not auto-register on dry-run; report it as a finding so apply will create the entry explicitly.

## Guardrails

- Do not copy global runtime files into project `.catpaw/`.
- Do not change req status to done/cancelled; use `catpaw:close`.
- Do not delete legacy artifacts.
- Do not modify `.gitignore` without stating the exact change first.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
