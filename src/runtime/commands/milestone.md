# catpaw:milestone

Create, update, summarize, or close a CatPaw Milestone.

Milestone mode is a thin phase layer over existing reqs. It reduces fragmented
"what next?" loops for a continuous objective, but it is not a fifth workflow
level and does not replace FRs. In short: not a fifth workflow level.

## Default Mode

Default to planning/status behavior. Apply writes only when the user asks to
create, update, reconcile, or close milestone artifacts.

```text
catpaw:milestone start MS-001 <title>
catpaw:milestone status [MS-001]
catpaw:milestone add-fr MS-001 FR-001
catpaw:milestone close MS-001 --dry-run
catpaw:milestone close MS-001 --apply
```

## When To Use

Use a milestone when:

- the user asks for milestone / phase / 一整个阶段 / 继续推进;
- work has an L2/L3 phase goal spanning multiple FRs;
- several FRs have a clear sequence, shared acceptance path, or common
  release/commit boundary;
- stopping after each FR would create needless replanning.

Do not create a milestone for L0/L1 one-off work unless the user explicitly
asks.

## Artifact Path

```text
.catpaw/milestones/MS-001-<slug>.md
```

No `milestones/active/`, `milestones/archive/`, or `milestones/index.md` is
required in the minimal model. Milestone paths are identity-stable; terminal
state lives in frontmatter. Active milestones appear in `.catpaw/index.md`.

## Status Values

Use the existing artifact vocabulary:

- `draft`: phase is being framed;
- `active`: phase is being worked;
- `blocked`: progress needs user input, provider availability, credentials, or
  external state;
- `done`: phase is closed with evidence;
- `cancelled`: phase intentionally stopped.

Avoid milestone-only aliases such as `in_progress`, `completed`, or `shipped`.

## Relationship To FRs

- A milestone can include multiple FRs.
- FR remains the smallest verifiable requirement unit.
- Milestone is the phase objective and progress rollup.
- Each included FR should still have its own req and, for L2/L3, plan and
  verification record.
- A draft milestone may temporarily have no FRs while framing the phase.
- An active or done milestone should name at least one FR unless the user
  explicitly keeps it as a research-only phase.
- A milestone cannot be `done` while included FRs are active, blocked, or
  missing, unless unresolved FRs are explicitly deferred or cancelled in the
  milestone closeout.

## Index Behavior

`.catpaw/index.md` may include:

```markdown
## Active Milestones

| ID | Title | Status | Target | Links |
|---|---|---|---|---|
| MS-001 | Example phase | active | beta usable | [Milestone](milestones/MS-001-example.md) · [FR-001](reqs/FR-001-example.md) |
```

Keep the index active-only. Remove terminal milestones from active dashboard
sections during close/reconcile.

## Start / Add-FR Behavior

When starting a milestone:

- create `.catpaw/milestones/` if needed;
- instantiate `templates/milestone.md`;
- record outcome, non-goals, included FRs if known, exit criteria,
  verification entrypoints, user-assistance points, current status, and next
  action;
- update `.catpaw/index.md` Active Milestones.

When adding an FR:

- ensure the FR file exists or create it through `catpaw:plan`;
- add the FR to the milestone Scope table;
- update milestone progress and index links;
- do not change FR scope just because it is in a milestone.

## Status Behavior

When the user asks "where are we?", "next?", "continue MS-001", or "推进 M1":

- read active milestone files plus included FR req/plan/test/review artifacts;
- report milestone outcome, completed FRs, active/blocked FRs, verification
  state, next action, and whether user input is needed;
- if no active milestone exists, fall back to normal `catpaw:status`.

## Close Behavior

Before closing a milestone:

- every included FR is `done` or explicitly cancelled/deferred;
- milestone exit criteria are checked;
- verification commands/manual checks are recorded;
- remaining risks and next milestone/action are summarized;
- `.catpaw/index.md` no longer lists the milestone as active.

Milestone close does not commit, push, create PRs, deploy, or perform
destructive actions automatically. If "commit by milestone" is the natural next
step, report it and wait for explicit user confirmation.
