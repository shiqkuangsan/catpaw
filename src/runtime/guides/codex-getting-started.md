# Codex Getting Started

Use the common flow in `guides/README.md`; this file records Codex adapter
surfaces.

## Optional Global Codex Adapter

If the user wants all Codex projects to recognize CatPaw, merge:

```text
~/.catpaw/snippets/global-adapter.md
```

into:

```text
~/.codex/AGENTS.md
```

If the user only wants the current project to use CatPaw, skip this step.

## Project Adapter

For the current project, merge:

```text
~/.catpaw/snippets/project-adapter.md
```

into one of:

```text
<project>/AGENTS.md
<project>/CLAUDE.md
```

Use the project convention when one already exists. Do not create both unless
the user asks.

## Final State

Expected result:

```text
~/.catpaw/                 # global runtime
~/.codex/AGENTS.md         # optional global adapter
<project>/AGENTS.md        # or project CLAUDE.md
<project>/.catpaw/         # project artifacts
```

## Reference

- Codex project instructions: `AGENTS.md`
