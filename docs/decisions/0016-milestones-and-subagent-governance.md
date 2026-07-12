# ADR-0016: Milestones And Subagent Governance

Status: Accepted; artifact and Agent vocabulary amended by ADR-0019

## Context

CatPaw originally centered project work around individual reqs. That kept the
runtime light, but multi-FR phases could become fragmented: after each FR the
user often had to ask what came next, and the agent could lose the broader
phase objective.

CatPaw also had Subagent Preference Gate guidance, but preferred subagent use
could be skipped silently. That made `preferred` too easy to treat as a vague
suggestion instead of an observable routing decision.

## Decision

Add Milestone as an optional phase artifact:

```text
.catpaw/milestones/MS-001-<slug>.md
```

A milestone groups related reqs into a phase objective. It is not a fifth
workflow level, not a replacement for FRs, and not mandatory for L0/L1 or
single-FR work. FRs remain the smallest verifiable unit.

Milestone membership lives in the milestone body, not in req frontmatter, to
avoid duplicate state. Milestone paths are identity-stable; terminal state lives
in frontmatter.

Strengthen preferred subagent governance: when an artifact records
`Provider stance: preferred`, it should also record either current-tool
subagent evidence or a compact `Subagent skipped: <reason>`. Project doctor
warns when preferred stance lacks that outcome evidence.

## Consequences

- Users can ask CatPaw to continue a phase without being interrupted after
  every FR.
- Status output can show active milestones before individual active work.
- Existing boards without `.catpaw/milestones/` remain valid.
- Preferred subagent routing becomes auditable without forcing subagents for
  every task.
- The skip path remains available for narrow, local, answer-only, explicitly
  single-agent, or privacy-sensitive work.
- Milestones and providers still do not authorize commit, push, PR, deploy,
  destructive action, scope expansion, or secret access.

## References

- `src/runtime/commands/milestone.md`
- `src/runtime/templates/milestone.md`
- `src/runtime/runtime-policy.md`
- `src/runtime/commands/provider.md`
- `scripts/catpaw-project.mjs`
