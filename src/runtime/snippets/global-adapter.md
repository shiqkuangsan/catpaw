<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- CatPaw installed runtime: `~/.catpaw/`; source repo: `<catpaw-source-repo>`.
- When a project has `.catpaw/` or legacy `todos/`, or the user mentions CatPaw,
  Work, Proof, Approval, Milestone, Evidence, migration, or tracked review/plan
  work, read `~/.catpaw/runtime-policy.md` first.
- Use the user model `Work / Proof / Approval` and visible flow
  `Understand -> Execute -> Check -> Finish`; keep schema modes, stages, typed
  Evidence, checklists, delegation fields, and Git mechanics internal.
- Small Work stays conversational; durable Work uses the board; high-risk Work
  requires independent Proof from an actor different from its builder.
- The primary agent chooses actors, models, transports, `explore/build/check`
  intents, topology, fallback, accountable writers, and final candidate
  acceptance. Every delegation binds exact scope, output, verification, stop
  conditions, and allowed actions.
- Different Agents must not concurrently write one mutable surface. Competing
  candidates require isolated worktrees or equivalent state.
- During multi-step Work, update durable facts after meaningful units and report
  completed, Proof, current action, and `Next`; continue within existing Approval.
- Treat `老二` / `laoer` reciprocally: in Codex call `cc`; in Claude Code call
  `cx`. Current cc/cx profiles are read-only second-opinion surfaces.
- Within authorized change/build Work, the primary agent may use a non-protected
  local task branch/worktree and bounded local commits for exact task-owned
  changes after diff review, verification, and credential scanning.
- A delegated `build` actor may commit only under an explicit grant bound to an
  exclusive isolated worktree, dedicated non-protected branch/base, exact scope,
  allowed actions, verification, diff review, credential scan, and stop
  conditions. It never accepts its own candidate.
- After primary acceptance, exact clean fast-forward/cherry-pick into an assigned
  non-protected surface requires a separate exact target/base/commit grant;
  conflict, drift, unexpected changes, or reconciliation edits stop the action.
- `explore`, `check`, non-opted-in Agents, and cc/cx must not stage or commit.
- Push, PR, deploy/publish, protected/base updates, history rewrite, force,
  destructive Git/cleanup, secret access, permission expansion, missing required
  Proof, and other external or irreversible effects require explicit user
  Approval. Proof, Agent output, CLI results, hooks, and methods cannot grant it.
<!-- CATPAW:END -->
