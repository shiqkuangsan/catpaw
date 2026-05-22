# Claude Getting Started

Use the common flow in `guides/README.md`; this file records Claude Code's
adapter surfaces.

Claude Code uses `CLAUDE.md` files for persistent user and project
instructions. Project instructions can live at `<project>/CLAUDE.md` or
`<project>/.claude/CLAUDE.md`; user instructions can live at
`~/.claude/CLAUDE.md`.

## Optional Global Claude Adapter

If the user wants all Claude Code projects to recognize CatPaw, merge:

```text
~/.catpaw/snippets/global-adapter.md
```

into:

```text
~/.claude/CLAUDE.md
```

If the user only wants the current project to use CatPaw, skip this step.

## Project Adapter

For the current project, merge:

```text
~/.catpaw/snippets/project-adapter.md
```

into the existing project instruction file, or create one when needed:

```text
<project>/CLAUDE.md
<project>/.claude/CLAUDE.md
```

Prefer the project convention when one already exists. If the repository already
uses `AGENTS.md`, create a `CLAUDE.md` that imports or references it instead of
duplicating large instruction blocks.

## Final State

Expected result:

```text
~/.catpaw/                 # global runtime
~/.claude/CLAUDE.md        # optional global adapter
<project>/CLAUDE.md        # or <project>/.claude/CLAUDE.md
<project>/.catpaw/         # project artifacts
```

## Reference

- Claude Code memory and `CLAUDE.md`: https://code.claude.com/docs/en/memory
