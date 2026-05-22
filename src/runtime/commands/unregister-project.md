# catpaw:unregister-project

Remove a project board entry from the global CatPaw registry without touching any board files.

## Default Mode

```text
catpaw:unregister-project [boardPath]
```

If `boardPath` is omitted, default to the current project's `.catpaw/` directory resolved to absolute path.

## Rule

This command modifies only `~/.catpaw/state/projects.json`. It never deletes, moves, or alters any project `.catpaw/` directory or content.

## Preflight

- Confirm `~/.catpaw/state/projects.json` exists; if not, report no-op.
- Resolve `boardPath` to an absolute path.
- Look up the entry by `boardPath`.
- If not found, report no-op and list nearest matches by suffix.

## Behavior

- Remove the matching entry from `projects[]`.
- Update `updatedAt` to today.
- Write atomically: write to `projects.json.tmp`, then rename to `projects.json`.

## Output

```text
Unregistered:
  boardPath: <abs path>
  stamp: <previous stamp>
  registeredAt: <date>
  lastSeenAt: <date>

Note: board files at <boardPath> were not modified. Delete them manually if intended.
```

If multiple matches by suffix appear, prompt the user to disambiguate before removing.

## Limits

- Do not delete board files.
- Do not modify any other entries.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
