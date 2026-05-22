# catpaw:registry-doctor

Inspect the global CatPaw project registry for staleness and drift; optionally prune failed entries.

## Default Mode

Default to `--dry-run`.

```text
catpaw:registry-doctor --dry-run
catpaw:registry-doctor --apply
catpaw:registry-doctor --discover [root]
```

## Inputs

- `~/.catpaw/state/projects.json`
- `~/.catpaw/VERSION` (for project runtime target comparison)
- Filesystem reads of each `boardPath` to confirm presence

## Checks

- Missing board:
  - `boardPath` no longer exists on disk → propose `unregister`.
- Stale stamp:
  - Entry `stamp` < installed runtime version → propose `upgrade-project` for that board.
- Missing index frontmatter:
  - `boardPath/index.md` exists but has no `runtime:` field → propose `upgrade-project` for that board.
- Stamp mismatch:
  - `boardPath/index.md` `runtime:` differs from registry `stamp` → flag, do not auto-resolve; ask user which is authoritative.
- Schema version:
  - `schemaVersion` in registry does not match supported version → stop and report; do not auto-migrate.

## Discovery (`--discover [root]`)

Optional companion mode: scan a filesystem root for `.catpaw/` directories not in the registry, and propose registration. Defaults to scanning `$HOME/WorkSpace` if no root is given. Skips `node_modules/`, `.git/`, and other common noise directories.

Report only. `--apply` may prune missing registry entries, but it never
auto-registers discovered boards.

## Output

```text
Installed runtime: <version>
Registry path: ~/.catpaw/state/projects.json
Total entries: N

Missing:
  - <boardPath>: registered <date>, last seen <date>; suggest catpaw:unregister-project

Stale stamp:
  - <boardPath>: stamp <x.y.z> < installed <a.b.c>; suggest catpaw:upgrade-project

Stamp mismatch:
  - <boardPath>: registry <x>, board <y>; needs user decision

Discovered (with --discover):
  - <boardPath>: not in registry; report only; suggest catpaw:upgrade-project --apply for existing boards or catpaw:init-project for new projects
```

## Apply Behavior

When `--apply` is explicitly requested:

- Remove entries whose `boardPath` is missing on disk (after listing them in dry-run).
- Update `updatedAt`.
- Atomic write: write to `projects.json.tmp`, then rename.
- Never auto-update `stamp` from disk; that is `upgrade-project`'s job.
- Never auto-register discovered boards; user must run `catpaw:upgrade-project` (or `init-project` for new ones) on each.

## Limits

- Do not modify any project `.catpaw/` files.
- Do not modify any individual entry's `stamp` field.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
- Do not auto-register discovered boards.
