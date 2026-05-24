# CatPaw Protocol

- CatPaw runtime path: `~/.catpaw/`; source repo: `<catpaw-source-repo>`.
- When a repository has `.catpaw/`, legacy `todos/`, or the user mentions CatPaw/init/migration/reqs/plans/research/reviews, read `~/.catpaw/runtime-policy.md` before acting.
- When CatPaw routes a task, tell the user the selected `L0`/`L1`/`L2`/`L3` level, short reason, artifact expectation, and verification expectation before meaningful work.
- For CatPaw-routed L1/L2/L3 work, every user-visible checkpoint and final response must include a compact handoff with `Completed`, `Updated artifacts`, `Verification`, `Next`, and `Needs user decision`. L0 stays lightweight unless it escalates or needs a decision.
- For project-local CatPaw init, follow `~/.catpaw/commands/init-project.md`.
- For legacy CatPaw artifact migration, follow `~/.catpaw/commands/migrate-project.md`.
- Project-local `.catpaw/` directories are artifact boards; do not copy the full runtime package into them.
- Project-local rules or current task constraints override this global protocol when they are more specific.
- Full specs, templates, roles, source evidence, and command drafts live in `~/.catpaw/`.
