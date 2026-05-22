# OpenCode Getting Started

Use the common flow in `guides/README.md`; this file records OpenCode adapter
surfaces.

OpenCode uses `AGENTS.md` for custom instructions. Project rules live at
`<project>/AGENTS.md`; global rules live at `~/.config/opencode/AGENTS.md`.

## Optional Global OpenCode Adapter

If the user wants all OpenCode sessions to recognize CatPaw, merge:

```text
~/.catpaw/snippets/global-adapter.md
```

into:

```text
~/.config/opencode/AGENTS.md
```

If the user only wants the current project to use CatPaw, skip this step.

## Project Adapter

For the current project, merge:

```text
~/.catpaw/snippets/project-adapter.md
```

into:

```text
<project>/AGENTS.md
```

OpenCode can fall back to Claude Code's `CLAUDE.md`, but CatPaw should prefer
OpenCode's native `AGENTS.md` path for OpenCode users.

## Final State

Expected result:

```text
~/.catpaw/                       # global runtime
~/.config/opencode/AGENTS.md     # optional global adapter
<project>/AGENTS.md              # OpenCode project adapter
<project>/.catpaw/               # project artifacts
```

## Reference

- OpenCode rules: https://open-code.ai/en/docs/rules
