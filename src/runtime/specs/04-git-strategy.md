# 04. Git Strategy

> Status: draft · Last updated: 2026-05-22

## 1. Principle

CatPaw is a personal/project workflow layer. It should not pollute an original
business, open-source, or team repository unless the user explicitly wants the
project board tracked.

This file only governs whether project/workspace `.catpaw/` artifacts enter
git. It does not govern the global runtime `~/.catpaw/`, which should follow the
user's dotfiles or backup strategy.

Hard rule:

```text
If `.catpaw/` would be committed into the original project repository, ignore it.
If `.catpaw/` lives in a separate workspace repository above or beside original repos, it may be tracked.
```

Short version:

```text
Ignore it when it pollutes the original repo; track it when it is part of a dedicated workspace system.
```

## 2. Single Original Project Repo

If the current directory is the actual business, open-source, or team project:

```text
project/
├── .git/
├── src/
└── .catpaw/   # ignored
```

Rules:

- `.catpaw/` is personal workflow metadata.
- Add it to `.gitignore` by default.
- Do not put it in the original project history.
- Do not affect PRs, open-source publication, or team collaboration unless explicitly intended.
- It may contain immature ideas, reviews, debugging notes, and strategy.

Suggested `.gitignore`:

```gitignore
/.catpaw/
```

## 3. Multi-repo Workspace

If the current directory is a dedicated workspace repository that organizes
multiple upstream repos, forks, and experiments:

```text
workspace/
├── .git/
├── .catpaw/          # tracked
├── upstream-repo/   # its own .git/
├── fork-repo/       # its own .git/
└── experiments/
```

Rules:

- The workspace itself is the work-system repository.
- `.catpaw/` may be tracked in the workspace git history.
- Child repos remain independent and are not polluted.
- CatPaw can record cross-repo strategy, integration plans, upstream comparisons, patch routes, and review conclusions.

## 4. Decision Rule

Ask one question:

```text
Would this `.catpaw/` enter the original project repo history?
```

- Yes -> ignore it.
- No, and the current repo is a workspace repo -> it may be tracked.
