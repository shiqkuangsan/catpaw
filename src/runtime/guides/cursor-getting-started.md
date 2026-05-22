# Cursor Getting Started

Use the common flow in `guides/README.md`; this file records Cursor adapter
surfaces.

Cursor supports global user rules through Cursor Settings and project rules in
`.cursor/rules/*.mdc`.

## Optional Global Cursor Rules

If the user wants all Cursor projects to recognize CatPaw, add the content from:

```text
~/.catpaw/snippets/global-adapter.md
```

to Cursor Settings -> Rules.

If the user only wants the current project to use CatPaw, skip this step.

## Project Rules

For the current project, create or update:

```text
<project>/.cursor/rules/catpaw.mdc
```

Use this content:

```mdc
---
alwaysApply: true
description: CatPaw project workflow protocol
---

# CatPaw Protocol

- This project follows the global CatPaw runtime at `~/.catpaw/`.
- When working with project workflow artifacts, read `~/.catpaw/runtime-policy.md` first.
- Project CatPaw artifacts live in this repository's `.catpaw/` directory.
- Use `.catpaw/index.md` as the active work dashboard.
- For project-local CatPaw init, follow `~/.catpaw/commands/init-project.md`.
- For legacy CatPaw artifact migration, follow `~/.catpaw/commands/migrate-project.md`.
- Do not copy global runtime files such as specs, roles, templates, source evidence, or commands into this project.
- Do not delete, move, untrack, or bulk-clean legacy workflow artifacts such as `todos/` without explicit confirmation.
```

If the project already has a convention around `AGENTS.md`, the project may also
keep CatPaw instructions there for other agents, but Cursor should use
`.cursor/rules/catpaw.mdc` as its native project adapter.

## Final State

Expected result:

```text
~/.catpaw/                         # global runtime
Cursor Settings -> Rules           # optional global adapter
<project>/.cursor/rules/catpaw.mdc # Cursor project adapter
<project>/.catpaw/                 # project artifacts
```

## Reference

- Cursor rules: https://cursor.com/docs
