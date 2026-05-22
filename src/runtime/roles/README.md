# Expert Council Role Prompts

> Status: draft · Last updated: 2026-04-28

This directory stores CatPaw Expert Council role prompts. `../specs/09-roles.md`
is the catalog; this directory contains runtime-loadable role cards.

## Usage

When calling Expert Council:

1. CatPaw chooses roles based on workflow level and risk.
2. The relevant role prompt is loaded.
3. The role prompt is handed to the selected provider.
4. The provider outputs advisory findings only; it does not automatically edit code, commit, push, create PRs, or deploy.
5. CatPaw summarizes findings in `.catpaw/reviews/<req-id>-<slug>/summary.md`.

## Roles

| Role | Prompt |
|---|---|
| Product Strategy Advisor | [product-strategy-advisor.md](product-strategy-advisor.md) |
| Architecture Reviewer | [architecture-reviewer.md](architecture-reviewer.md) |
| Engineering Reviewer | [engineering-reviewer.md](engineering-reviewer.md) |
| Design Reviewer | [design-reviewer.md](design-reviewer.md) |
| Developer Experience Reviewer | [developer-experience-reviewer.md](developer-experience-reviewer.md) |
| QA Strategist | [qa-strategist.md](qa-strategist.md) |
| Security Reviewer | [security-reviewer.md](security-reviewer.md) |
| Release Strategist | [release-strategist.md](release-strategist.md) |
| Performance Reviewer | [performance-reviewer.md](performance-reviewer.md) |
| Debugging Advisor | [debugging-advisor.md](debugging-advisor.md) |
| Retrospective Advisor | [retrospective-advisor.md](retrospective-advisor.md) |

## Shared Rules

- Advisory-only by default.
- Verify claims against available code, docs, tests, logs, or source evidence.
- Separate facts, risks, assumptions, and recommendations.
- Push back when the requested scope is wrong or unsafe.
- Do not perform external actions.
- Do not recommend broad refactors unless they are necessary for the task.
- If evidence is insufficient, say what evidence is missing instead of guessing.
