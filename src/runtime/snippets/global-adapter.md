<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- CatPaw installed runtime: `~/.catpaw/`; source repo: `<catpaw-source-repo>`.
- When a project has `.catpaw/` or legacy `todos/`, or the user mentions CatPaw, Work, Milestone, Evidence, migration, or tracked review/plan work, read `~/.catpaw/runtime-policy.md` first.
- Select `Direct`, `Tracked`, or `Gated`; use `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Project-local `.catpaw/` is an artifact board; never copy the runtime package into it.
- CatPaw exposes a structured Role Catalog and advisory collaboration patterns; the Agent Executor chooses Agents/models/transports, Role composition, count, order/parallelism, fallback, integration owner, and final adoption.
- For medium-risk uncertainty, consider one or more bounded Agents; if a recommended check is skipped, record why. Required Independent Checks need a distinct non-primary actor or a user-accepted gap.
- During multi-step work, update relevant artifacts after each meaningful unit and report verification plus `Next`; continue authorized work without waiting to be asked.
- Treat `老二` / `laoer` / second reviewer as reciprocal routing: in Codex call `cc`; in Claude Code call `cx`.
- Within an authorized change/build task, the Agent Executor designates one accountable integration owner per mutable surface. If the Executor retains that ownership, it may use a non-protected local task branch/worktree and bounded local commits for exact task-owned changes after diff review, verification, and secret scan.
- A delegated integration owner may write only its assigned isolated surface; integration ownership alone grants no Git authority. Candidate/reconciliation commits require the Builder Role plus a complete Builder Git Envelope. After the Executor decides adoption, exact clean inbound fast-forward/cherry-pick requires an Integration Git Envelope bound to the assigned non-protected surface, target/base, commit list, and verification.
- A current-tool Builder may create a bounded local commit series only when its Task Envelope explicitly opts in and binds an exclusive isolated worktree, dedicated non-protected branch/base, exact scope, verification, diff review, and secret scan; the Executor still owns final adoption.
- Scout, Architect, Reviewer, Verifier, non-opted-in Agents, and current `cc`/`cx` profiles must not stage or commit; Integrator/integration ownership alone grants no Git authority.
- Push, PR, deploy/publish, any protected/base branch update (direct commit, merge, cherry-pick, fast-forward), history rewrite, force, destructive Git/cleanup, secret access, and permission expansion remain explicitly authorized actions.
- Runtime install, adapter changes, registry writes, board migration, and external actions remain separately authorized.
<!-- CATPAW:END -->
