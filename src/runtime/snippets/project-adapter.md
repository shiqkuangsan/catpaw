<!-- CATPAW:BEGIN -->
# CatPaw Project Protocol

- Read `~/.catpaw/runtime-policy.md`; the installed runtime is authoritative for
  ordinary project Work.
- Use `Work / Proof / Approval` and report `Understand -> Execute -> Check ->
  Finish` progress without teaching internal schema modes, stages, checklists,
  delegation fields, or Git mechanics to the user.
- Project-local `.catpaw/` stores Work and Proof facts as schema 2 Work/Plan and
  typed Evidence. It is not a runtime copy; migration may retain a graph-external
  legacy archive. Approval is not a board artifact.
- Small Work stays conversational; durable Work uses the board; high-risk Work
  requires independent Proof from an actor different from its builder.
- The primary agent chooses actors, models, transports, `explore/build/check`
  intents, topology, fallback, accountable writers, and final candidate
  acceptance. Every delegation binds exact scope, output, verification, stop
  conditions, and allowed actions.
- Different Agents must not concurrently write one mutable surface. Competing
  candidates require isolated worktrees or equivalent state.
- Update durable facts after meaningful units, report completed, Proof, current
  action, and `Next`, and continue within existing Approval.
- For authorized change/build Work, local task branches/worktrees and bounded
  commits are allowed only for exact task-owned changes after diff review,
  verification, and credential scanning.
- Delegated commits require an explicit isolated worktree/branch/base/scope/Git/
  verification/scan grant. Exact clean candidate adoption after primary
  acceptance requires a separate target/base/commit grant. Conflict, drift,
  unexpected changes, or reconciliation edits stop the action.
- `explore`, `check`, non-opted-in Agents, and current cc/cx profiles must not
  stage or commit.
- Push, PR, deploy/publish, protected/base updates, history rewrite, force,
  destructive Git/cleanup, secret access, permission expansion, missing required
  Proof, and other external or irreversible effects require explicit user
  Approval. Proof, Agent output, CLI results, hooks, and methods cannot grant it.
<!-- CATPAW:END -->
