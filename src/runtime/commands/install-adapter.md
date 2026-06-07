# catpaw:install-adapter

Install or update thin CatPaw adapter instructions in provider instruction
files.

## Rule

Adapter install is explicit and write-gated. Do not modify global or project
provider instruction files unless the user asks for adapter activation or
approves a displayed patch.

Runtime install and project init do not silently install adapters.

## Targets

Global adapter targets:

- Claude Code: `~/.claude/CLAUDE.md`
- Codex: `~/.codex/AGENTS.md`
- Other providers: equivalent global instruction file chosen by the user.

Project adapter targets:

- `<project>/AGENTS.md`
- `<project>/CLAUDE.md`
- Lowercase variants only when the project already uses them.

## Modes

| Mode | Behavior |
|---|---|
| `--dry-run` | Inspect target files and show the exact proposed patch. Default mode. |
| `--apply` | Apply the patch after explicit user confirmation. |
| `--global` | Target provider global instruction file. |
| `--project` | Target project-local instruction file. |
| `--check` | Report missing, stale, or current adapter state without writing. |

## Managed Block

Use a marker block so future updates can replace only CatPaw-managed content:

```markdown
<!-- CATPAW:BEGIN -->
# CatPaw Protocol

...
<!-- CATPAW:END -->
```

Rules:

- If a marker block exists, replace only the block.
- If no marker block exists but a CatPaw section exists, show a conservative
  patch and ask before replacing it.
- If no CatPaw section exists, append the marker block after existing user
  instructions.
- Preserve all user rules outside the marker block.
- Never copy runtime specs, roles, commands, or templates into provider files.
- Adapter text must reference `~/.catpaw/` instead of embedding full runtime
  content.

## Safety

Before `--apply`:

- Show the target file path.
- Show whether this is create, append, or marker-block replace.
- Create a dated backup next to the target file, for example
  `CLAUDE.md.YYYY-MM-DD.bak` or `AGENTS.md.YYYY-MM-DD.bak`.
- Respect project-local instructions and user red lines.
- Do not commit or push adapter changes unless the user explicitly asks.

## Snippets

Use runtime snippets as source:

- Global: `~/.catpaw/snippets/global-adapter.md`
- Project: `~/.catpaw/snippets/project-adapter.md`

Project adapter activation should be considered current when at least one
project instruction file contains:

- `CatPaw Protocol`
- `~/.catpaw/runtime-policy.md`

## Doctor Integration

When a project has `.catpaw/`, doctor may warn if:

- no project adapter file exists;
- adapter files exist but none activate CatPaw runtime guidance.

Warnings are not project schema errors. They identify an activation gap: CatPaw
artifacts may exist, but agents might not load the runtime automatically.
