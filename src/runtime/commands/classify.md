# catpaw:classify

Classify the current request before choosing workflow weight.

Classification is user-visible routing, not hidden internal bookkeeping. When
CatPaw applies to a task, report the selected level before meaningful tool use
or file edits.

## Flow

```text
Intent classification
→ Workflow level classification: L0/L1/L2/L3
→ Lifecycle/subsystem decisions
→ Lifecycle role routing
→ Artifact decisions
→ Verification level
```

## Intents

- Answer / Explain
- Direct Task
- Execution Objective
- Plan-only / Research
- Review / Audit
- Release / External Action

## Levels

- L0: direct execution, no artifacts.
- L1: light plan, no artifacts by default.
- L2: req + plan + verification record.
- L3: req + plan + tests + formal review + explicit gates.

## Lifecycle Role Routing

- L0/L1 default to no Expert Council unless a clear risk trigger appears.
- L2 usually names one stage-primary role plus at most one risk role.
- L3 must name the intended role set for the plan `Council` section and formal review.
- If another provider is useful, route through `catpaw:provider`; otherwise the primary agent may apply the role inline.

## Boundaries

- Classification is advisory routing only.
- Do not create CatPaw artifacts from classification alone.
- Do not commit, push, create PRs, deploy, or perform destructive actions from classification alone.
- If the user asks for plan-only / research-first work, classify and stop before implementation.

## Output

Return concise classification. For ordinary task start, use the compact dispatch
line; for explicit `catpaw:classify` requests, include the structured fields.

Compact form:

```text
CatPaw dispatch: L2 — <short reason>. Artifacts: <none|req+plan|req+plan+tests+reviews>. Roles: <none|role set>. Verification: <inline|record|matrix>. Next: <action>.
```

Structured form:

```text
Intent:
Level:
Artifacts:
Roles:
Review:
Verification:
Reason:
Next action:
```

If the level changes while working, report the change explicitly:

```text
CatPaw dispatch changed: L1 → L2 — <short reason>. Artifacts now: <...>. Next: <...>.
```
