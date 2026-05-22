# 02. Workflow Levels

> Status: draft · Last updated: 2026-05-22

## 1. Intent Classification

When a task enters CatPaw, classify user intent before choosing workflow weight.

```text
Intent decides what kind of work this is.
Level decides how heavy the workflow should be.
```

| Intent | Meaning | Default handling |
|---|---|---|
| Answer / Explain | Explanation, comparison, or Q&A; no file edits requested | Answer directly; verify if needed |
| Direct Task | Clear small task or local edit | Classify L0/L1 |
| Execution Objective | Feature, fix, refactor, or initiative to implement | Classify L1/L2/L3 |
| Plan-only / Research | User wants design, evaluation, or research before implementation | Research-first / plan-only; do not implement before approval |
| Review / Audit | Review code, plan, release risk, or security risk | Choose review depth and role |
| Release / External Action | Commit, push, PR, deploy, or destructive operation | L3 gate; require explicit user confirmation |

## 2. Dispatch Heuristic

CatPaw uses L0/L1/L2/L3 rather than gstack-style SIMPLE/MEDIUM/HEAVY/FULL/PLAN
names. It keeps the useful decision dimensions:

```text
Can it be done directly and safely? -> L0
Is it obvious but has multiple steps/files? -> L1
Does it need structured plan, research, or role review? -> L2
Does it involve high-risk gates, release, security, migration, or external action? -> L3
Is the user asking to think/design before building? -> plan-only / research-first, then reclassify
```

Key distinctions:

- A task is a clear action; an objective is a target state. Objectives normally require at least Think / Plan before Build.
- Plan-only / research-first is an intent mode, not implementation approval.
- L0-L3 is workflow weight, not user intent.

## 3. User-visible Dispatch

L0-L3 must not be hidden internal bookkeeping. When CatPaw participates in
routing, the agent must tell the user the classification before meaningful
execution:

```text
CatPaw dispatch: L2 — <short reason>. Artifacts: <none|req+plan|...>. Roles: <none|role set>. Verification: <inline|record|matrix>. Next: <next step>.
```

Rules:

- L0 may be one compact sentence, but the user should still know it is a lightweight direct task.
- L1/L2/L3 must state level, reason, artifact expectation, role stance, and verification/review intensity.
- If work escalates or de-escalates, state the transition, for example `L1 -> L2`, and why.
- Classification does not request approval by itself. Approval is required only by gates such as plan-only mode, external actions, or destructive operations.

## 4. Level Matrix

CatPaw uses L0/L1/L2/L3 only at the task orchestration layer.

Subsystems keep separate lightweight states:

- Review: `none / light / formal`.
- Tests: `inline verification / verification record / test matrix`.
- Lessons: `lesson / promotion candidate / rule`.

The task level sets minimum requirements for those subsystems.

| Level | Type | Default flow | Artifact requirement |
|---|---|---|---|
| L0 | Tiny edit / clear local fix | direct execution -> verify -> report | No CatPaw files |
| L1 | Standard single-module task | light plan -> execute -> verify -> report | No files by default; write artifacts only when cross-session, more complex, or requested |
| L2 | Complex / cross-cutting / uncertain | req -> research/plan -> execute -> verify -> review/report | Write req + plan + verification record |
| L3 | High-risk / release-grade | formal req/research/plan -> gates -> implementation -> test matrix -> formal review | Write req + plan + tests + reviews |

Additional rules:

- If L2 uses Expert Council, at least a review summary should be written.
- L3 optimizes for avoiding incidents, not speed.
- Role routing starts from the active lifecycle stage and then adds risk roles. See `specs/09-roles.md`.

## 5. L0 — Direct Execution

Use for:

- typos;
- tiny documentation changes;
- import sorting;
- clear local bug fixes;
- small follow-up tweaks to work just completed in the same session;
- explicit user requests such as "directly fix this" or "no plan needed."

Flow:

```text
execute -> local verification -> brief report
```

Do not invoke formal planning, research, Expert Council, or brainstorming by default.

## 6. L1 — Standard Work

Use for:

- ordinary bug fixes;
- single-module features;
- small low-risk refactors;
- two or three obvious steps with low risk.

Flow:

```text
light plan -> execute -> verify -> report
```

Rules:

- Do not write CatPaw artifacts by default.
- Write req/plan only when the work crosses sessions, becomes more complex, or the user asks.
- Use execution-methodology skills such as debugging, TDD, or verification as needed.
- Do not call Expert Council by default; use one role only when a clear risk appears.

## 7. L2 — Complex / Cross-cutting Work

Use for:

- cross-module or cross-layer work;
- high uncertainty;
- architecture impact;
- API contract changes;
- persistence format changes;
- performance-sensitive paths;
- complex UI flows;
- meaningful tradeoff analysis.

Flow:

```text
req -> brainstorm / research -> formal plan -> execute -> verify -> Expert Council review -> report
```

Rules:

- Write `reqs/`.
- Write `plans/`.
- Keep a verification record.
- Behavior-sensitive changes must define `Contracts / Invariants`, boundary verification, and a risk ledger in the plan.
- If Expert Council is used, write at least a review summary.
- Use one or two roles in most cases.

## 8. L3 — High-risk / Release-grade Work

Use for:

- auth, permission, or security logic;
- secrets or credentials;
- CI/CD;
- deploy or release;
- data migration;
- large refactors;
- final PR review;
- production incident fixes;
- force push, reset, or destructive-operation requests.

Flow:

```text
formal req / research / plan
-> explicit risk gates
-> implementation
-> test matrix
-> Expert Council formal review
-> optional multi-provider review
-> user approval for external actions
```

Rules:

- Write `reqs/`.
- Write `plans/`.
- Write `tests/`.
- Write `reviews/`.
- Include `Contracts / Invariants`, boundary cases, a risk ledger, and review summary checks.
- Summarize multi-provider disagreements.
