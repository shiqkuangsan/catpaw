# catpaw:release-runtime

Prepare a CatPaw runtime source change for release, then guide global runtime and project upgrade actions.

## Rule

This command defines release discipline. It does not automatically commit, push,
publish, upgrade `~/.catpaw/`, or modify project `.catpaw/` artifacts.

## Change Classification

Classify the source change before release:

| Change type | Examples | Version / notes |
|---|---|---|
| docs-only | README wording, guide examples, typo fixes | Patch version optional; no project migration note by default |
| command semantics | new or changed `src/runtime/commands/*.md` behavior | Version update required; migration note if user/project action changes |
| runtime policy | `runtime-policy.md` routing, gates, lifecycle rules | Version update required; migration note usually required |
| artifact schema | templates, frontmatter, graph metadata, index semantics | Version update required; project migration note required |
| provider adapter | snippets or provider-specific guidance | Version update required; adapter migration note required |
| install layout | manifest, runtime path, package tree | Version update required; runtime migration note required |

## Source Release Checklist

Update source repo files as needed:

- `src/runtime/VERSION`
- `src/runtime/runtime-manifest.json`
- `src/runtime/CHANGELOG.md`
- `src/runtime/README.md`
- `AGENTS.md`
- `AI-INSTALL.md`
- `README.md`
- `scripts/build-runtime.mjs`
- `src/runtime/AI-INSTALL.md`
- `src/runtime/runtime-policy.md`
- `src/runtime/commands/`
- `src/runtime/specs/`
- `src/runtime/templates/`
- `src/runtime/guides/`
- `src/runtime/snippets/`
- `src/runtime/migrations/`

If a new command file is added, `src/runtime/runtime-manifest.json.commands` must include it.

If the release changes project artifact behavior (schema, frontmatter, layout, command output that affects existing projects), `migrations/<version>.md` must be added before release is considered ready. See `Schema Delta Registry` below.

If the release embodies a non-obvious design decision (new boundary, new mechanism, new constraint), add an ADR under `docs/decisions/NNNN-*.md`. ADRs are maintainer-only and do not block release, but skipping them loses the rationale.

## Migration Note Gate

Write a migration note when any of these are true:

- Existing installed runtime requires user-visible upgrade steps.
- Existing project `.catpaw/` artifacts need new metadata or layout changes.
- Provider adapters need changes.
- Command behavior changes what users or agents should do.
- Old artifacts remain valid but gain optional upgrade steps.

The migration note may live in `src/runtime/CHANGELOG.md`, `src/runtime/README.md`, or a dedicated guide.
For larger upgrades, prefer `src/runtime/guides/migrating-to-<version>.md`.

Minimum migration note shape:

```text
Runtime upgrade:
Project impact:
Required actions:
Optional actions:
Verification:
Rollback / non-goals:
```

## Schema Delta Registry

Project artifact upgrades go through `migrations/<version>.md`, not through ad-hoc reading of CHANGELOG. This lets `catpaw:upgrade-project` walk from any prior stamp to the installed runtime in one pass. Runtime-only releases without migration files are stamp-only project upgrades.

Rules:

- Each minor or major release that touches project artifact schema, layout, or required content must add `migrations/<version>.md`.
- If a release has no project-side delta, omit the file (no empty placeholder).
- `migrations/<version>.md` deltas must be expressible as ordered, idempotent operations: add field, rename field, move file, drop field, rewrite section.
- Operations within a single migration file are unordered between files but ordered semantically (`add` then `rename` then `drop`).
- One-shot upgrade is the default user experience: `catpaw:upgrade-project` reads the project board's `runtime:` stamp, walks every migration file in (stamp, target] order, batches user decisions, and writes the new stamp on apply.
- Major version bumps may break this contract; they must say so explicitly in the migration file.

Minimum migration file shape:

```markdown
# Migration: <version>

Runtime upgrade: <prev> -> <version>
Project impact: <none / additive / breaking>

## Operations

- add: <path>: <field>: <default or rule>
- rename: <path>: <old> -> <new>
- move: <old-path> -> <new-path>
- drop: <path>: <field>
- rewrite: <path>: <description>

## User Decisions

- <decision-id>: <prompt>; choices: <list>

## Notes

<short rationale>
```

## Verification

Before reporting release readiness, run:

```text
git diff --check
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
node -e "parse src/runtime/runtime-manifest.json and verify command files exist"
rg -n -i 'token|secret|api[_-]?key|bearer|password|passwd' .
rg -n '^(<<<<<<<|=======|>>>>>>>)' .
```

Also verify:

- `src/runtime/VERSION` matches `src/runtime/runtime-manifest.json.version`.
- `src/runtime/CHANGELOG.md` has an entry for the source version.
- `scripts/verify-runtime.mjs` passes after the installed runtime is synced, or
  its failures are explained as expected pre-upgrade drift.
- New runtime package files are included by manifest or covered by an existing directory entry.
- Root `AI-INSTALL.md`, `src/runtime/AI-INSTALL.md`, or command docs explain user-facing upgrade behavior.
- If the release has project-side schema delta, `src/runtime/migrations/<version>.md` exists and is well-formed.

## Global Runtime Upgrade Handoff

After the source release is ready and the user asks to upgrade the installed runtime:

- Follow `commands/upgrade-runtime.md`.
- Build the package when installing from a source checkout, then copy only manifest-listed runtime files to `~/.catpaw/`.
- Verify `~/.catpaw/VERSION`.
- Verify `~/.catpaw/runtime-manifest.json`.
- Verify new command files exist.
- Run a secrets keyword scan over `~/.catpaw/`.
- Do not modify provider adapters unless the user explicitly asks.

## Project Upgrade Handoff

When a release changes project artifact behavior:

- Do not rewrite every project by default.
- Prefer `catpaw:upgrade-runtime` after runtime sync; it reads the global registry and reports all registered project boards in one dry-run summary.
- Use `catpaw:upgrade-runtime --apply-projects` only for unblocked project-board migrations.
- Use `catpaw:upgrade-project --dry-run` for a single board or for blocked boards that need focused inspection.
- Run `catpaw:doctor` first when `.catpaw/` already exists.
- Use `catpaw:reconcile --dry-run` for low-risk derived fixes.
- Apply changes only after user confirmation.
- Never copy runtime specs, roles, commands, or templates into project `.catpaw/`.

## Completion Report

Report:

```text
Source version:
Change classification:
Migration note:
Source verification:
Global runtime status:
Project upgrade impact:
Next recommended action:
Needs user decision:
```

## Limits

- Do not commit automatically.
- Do not push automatically.
- Do not upgrade `~/.catpaw/` automatically.
- Do not modify provider adapters automatically.
- Do not modify project `.catpaw/` automatically.
