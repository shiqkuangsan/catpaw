# ADR-0001: Project Board Version Stamp Lives in `index.md`

Status: Superseded by ADR-0019

## Context

`upgrade-project` needs a stable way to know which runtime last processed a board. Inferring from artifact shape is brittle, per-artifact stamps are noisy, and a hidden stamp file adds another surface.

## Decision

Store the board runtime stamp in `.catpaw/index.md` frontmatter:

```yaml
runtime: x.y.z
```

`init-project`, `migrate-project`, and `upgrade-project --apply` write it. Missing stamps are treated as pre-stamp boards. ADR-0009 later clarifies that the value is the installed runtime target, not a migration file's version.

## Consequences

- The stamp is user-visible and travels with the board dashboard.
- `index.md` must keep valid frontmatter.
- Manual edits can damage the stamp, so doctor/registry checks must detect drift.
- The board has one version source instead of per-artifact runtime metadata.

## References

- `src/runtime/commands/init-project.md`
- `src/runtime/commands/migrate-project.md`
- `src/runtime/commands/upgrade-project.md`
- [ADR-0003](0003-one-shot-upgrade-via-migrations.md)
- [ADR-0009](0009-project-stamps-track-runtime.md)
