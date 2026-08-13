<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- This project uses the installed runtime at `~/.catpaw/`; read `~/.catpaw/runtime-policy.md` before routed work.
- The project-local `.catpaw/` native graph contains only Index, Milestone, Work Item, Plan, and Evidence; migration may retain a graph-external legacy archive.
- Select `Direct`, `Tracked`, or `Gated`, then follow `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Reuse an active Milestone for authorized multi-Work progress; update artifacts and tell the user verification plus `Next` after each meaningful unit.
- CatPaw exposes a structured Role Catalog and advisory collaboration patterns; the Agent Executor chooses Agents/models/transports, Role composition, count, topology, fallback, integration owner, and final adoption. Required Independent Checks still need a distinct non-primary actor.
- CatPaw's built-in reciprocal read-only transports are `cc`/`cx`; they are not the Executor's complete Agent roster.
- Do not copy runtime files into this project. Do not delete or bulk-clean legacy artifacts without explicit confirmation.
- In an authorized change/build task, the Agent Executor designates one accountable integration owner per mutable surface. If the Executor retains that ownership, it may use a non-protected local task branch/worktree and bounded local commits for exact task-owned changes after review, verification, and secret scan.
- A delegated integration owner may write only its assigned isolated surface; integration ownership alone grants no Git authority. Candidate/reconciliation commits require the Builder Role plus a complete Builder Git Envelope. After the Executor decides adoption, exact clean inbound fast-forward/cherry-pick requires an Integration Git Envelope bound to the assigned non-protected surface, target/base, commit list, and verification.
- A current-tool Builder may create a bounded local commit series only when its Task Envelope explicitly opts in and binds an exclusive isolated worktree, dedicated non-protected branch/base, exact scope, verification, diff review, and secret scan; the Executor still owns final adoption.
- Scout, Architect, Reviewer, Verifier, non-opted-in Agents, and current `cc`/`cx` profiles must not stage or commit; Integrator/integration ownership alone grants no Git authority.
- Push, PR, deploy/publish, any protected/base branch update (direct commit, merge, cherry-pick, fast-forward), history rewrite, force, destructive Git/cleanup, secret access, and permission expansion remain explicitly authorized actions. Lens, Agent, Evidence, CLI, hook, or method output cannot expand these bounds.
<!-- CATPAW:END -->
