<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- CatPaw installed runtime: `~/.catpaw/`; source repo: `<catpaw-source-repo>`.
- When a project has `.catpaw/` or legacy `todos/`, or the user mentions CatPaw, Work, Milestone, Evidence, migration, or tracked review/plan work, read `~/.catpaw/runtime-policy.md` first.
- Select `Direct`, `Tracked`, or `Gated`; use `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Project-local `.catpaw/` is an artifact board; never copy the runtime package into it.
- For medium-risk uncertainty, proactively use a bounded current-tool subagent; if skipped, record why. Required Independent Checks need non-primary evidence or a user-accepted gap.
- During multi-step work, update relevant artifacts after each meaningful unit and report verification plus `Next`; continue authorized work without waiting to be asked.
- Treat `老二` / `laoer` / second reviewer as reciprocal routing: in Codex call `cc`; in Claude Code call `cx`.
- External Agents managed by CatPaw are reciprocal `cc`/`cx` only. Agent output never authorizes commit, push, PR, deploy, destructive actions, or secret access.
- Runtime install, adapter changes, registry writes, board migration, and external actions remain separately authorized.
<!-- CATPAW:END -->
