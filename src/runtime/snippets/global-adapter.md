<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- CatPaw installed runtime: `~/.catpaw/`; source repo: `<catpaw-source-repo>`.
- When a project has `.catpaw/` or legacy `todos/`, or the user mentions CatPaw, Work, Milestone, Evidence, migration, or tracked review/plan work, read `~/.catpaw/runtime-policy.md` first.
- Select `Direct`, `Tracked`, or `Gated`; use `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Project-local `.catpaw/` is an artifact board; never copy the runtime package into it.
- For medium-risk uncertainty, proactively use a bounded current-tool subagent; if skipped, record why. Required Independent Checks need non-primary evidence or a user-accepted gap.
- During multi-step work, update relevant artifacts after each meaningful unit and report verification plus `Next`; continue authorized work without waiting to be asked.
- Treat `老二` / `laoer` / second reviewer as reciprocal routing: in Codex call `cc`; in Claude Code call `cx`.
- Within an authorized change/build task, the primary integration owner may create a non-protected local task branch/worktree and commit only task-owned changes after exact diff review, verification, and secret scan.
- A current-tool Builder may create one local slice commit only when its Task Envelope explicitly opts in and binds an exclusive isolated worktree, dedicated non-protected branch/base, exact scope, verification, diff review, and secret scan; Primary still owns adoption and integration.
- Scout, Reviewer, Verifier, non-opted-in subagents, and external Agents must not stage or commit; current `cc`/`cx` profiles remain read-only.
- Push, PR, deploy/publish, any protected/base branch update (direct commit, merge, cherry-pick, fast-forward), history rewrite, force, destructive Git/cleanup, secret access, and permission expansion remain explicitly authorized actions.
- Runtime install, adapter changes, registry writes, board migration, and external actions remain separately authorized.
<!-- CATPAW:END -->
