# Guides

Scenario guides explain how a user starts using CatPaw through a specific
agent CLI or IDE.

AI agents must treat `AI-INSTALL.md` and `commands/*` as the operational source
of truth. Guides describe user journeys and provider-specific adapter surfaces.

| Guide | Use when |
|---|---|
| `codex-getting-started.md` | The user works with Codex. |
| `claude-getting-started.md` | The user works with Claude Code. |
| `cursor-getting-started.md` | The user works with Cursor. |
| `opencode-getting-started.md` | The user works with OpenCode. |

## Common Zero-to-Project Flow

Preconditions:

- CatPaw source is available as a local path or repository URL.
- The target project exists locally.
- The user opens the relevant provider in the target project.

User prompt:

```text
Please install CatPaw runtime from <catpaw-source-path-or-github-url> and enable CatPaw in the current project.
```

If the user provides a repository URL, the provider may fetch a temporary source
checkout; the user does not need to clone CatPaw manually.

Provider flow:

1. Resolve or fetch `<catpaw-source-repo>`, then read `AI-INSTALL.md`.
2. Ensure global runtime exists at `~/.catpaw/`.
3. If missing, install the runtime package from source.
4. If present, compare `VERSION` and `runtime-manifest.json`.
5. If older, follow `commands/upgrade-runtime.md`; if newer or inconsistent, stop and report.
6. Decide whether to add the provider's optional global adapter.
7. Enable CatPaw in the current project using the provider-specific adapter path.
8. Initialize `.catpaw/` with `commands/init-project.md` or migrate legacy artifacts with `commands/migrate-project.md`.
9. Preserve legacy `todos/` by default; do not delete, move, untrack, or bulk-clean without explicit confirmation.

After setup, users can ask for CatPaw work directly, for example:

```text
Use CatPaw for this requirement.
Create a req and plan.
Migrate this project's todos.
Close this CatPaw task.
Review the current plan.
```
