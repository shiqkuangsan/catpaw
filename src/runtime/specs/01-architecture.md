# 01. Architecture

> Status: draft · Last updated: 2026-05-22

## 1. Core Model

CatPaw separates workflow responsibilities into layers:

```text
CatPaw Orchestrator
  ├─ Execution Methodology: superpowers-style practices
  └─ Expert Council
      └─ Providers: current coding agent / current-tool subagent / Laoer / second opinion / Laosan / third opinion / future agents
```

Core rule:

```text
CatPaw decides what workflow to run.
superpowers defines how to execute well.
Expert Council provides judgment.
Providers perform the work.
```

Current layer count:

```text
4 conceptual layers + 2 cross-cutting control planes
```

Conceptual layers:

| Layer | Responsibility |
|---|---|
| CatPaw Orchestrator | Chooses workflow level, lifecycle routing, artifact policy, and gates |
| Execution Methodology | Provides engineering discipline such as planning, TDD, debugging, review, and verification |
| Expert Council / Roles | Provides advisory perspectives such as Product, Architecture, QA, Security, Design, Release, and Retrospective |
| Providers | Execute work or role perspectives through the current agent, current-tool subagent, Laoer, Laosan, or future agents |

Cross-cutting control planes:

| Plane | Responsibility |
|---|---|
| Artifact Graph | Stores project-local reqs, plans, reviews, tests, lessons, and active index state |
| Gates / Verification | Applies safety gates, provider gates, subagent preference, UI verification surface selection, handoff checks, doctor, and runtime verification |

Do not count lifecycle stages or workflow levels as extra layers. `Think ->
Plan -> Build -> Review -> Test -> Ship -> Reflect` is lifecycle vocabulary,
and `L0` / `L1` / `L2` / `L3` is workflow weight classification.

## 2. Lifecycle Vocabulary

CatPaw uses the following lifecycle vocabulary as a shared language, not as a
mandatory full pipeline:

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

| Stage | CatPaw mechanism |
|---|---|
| Think | Research, req framing, product strategy |
| Plan | Req + plan |
| Build | Execution |
| Review | Expert Council / code review |
| Test | Verification / test matrix |
| Ship | Release gate / external-action gate |
| Reflect | Lessons / retrospective |

Rules:

- The lifecycle chain is vocabulary, not a mandatory workflow.
- `L0` / `L1` / `L2` / `L3` remains the dispatch model. It answers how heavy the workflow should be.
- A task may use only part of the chain: `L0` might use only Build -> Test; `L3` often uses the full chain.

## 3. Lifecycle Role Orchestration

Lifecycle stages also drive Expert Council routing:

```text
Stage
-> stage-primary role
-> risk add-on roles
-> provider stance
-> artifact location
```

| Stage | Default role stance |
|---|---|
| Think | Product Strategy Advisor when value, scope, or framing is unclear |
| Plan | Architecture Reviewer for L2/L3 design and cross-boundary work |
| Build | Primary agent executes; Engineering / Debugging only when risk appears |
| Review | Engineering Reviewer plus risk-specific reviewers |
| Test | QA Strategist for L3 or complex verification |
| Ship | Release Strategist for release, deploy, PR, migration, or external action |
| Reflect | Retrospective Advisor for reusable lessons or repeated failures |

Rules:

- L0/L1 do not call Expert Council by default.
- L2 usually uses one or two roles covering the active stage and the highest risk.
- L3 must declare the role set, and formal review must record providers and disagreements.
- Provider calls are governed by `catpaw:provider`; roles never authorize external actions.

## 4. CatPaw Orchestrator

CatPaw is the only workflow orchestration layer. It owns:

- workflow level classification: L0 / L1 / L2 / L3;
- whether work should use direct execution, light planning, formal planning, research, lessons, or review;
- where durable information should be stored;
- high-risk gates: commit, push, PR, deploy, destructive operations, secrets, security-sensitive changes;
- synthesis of Expert Council and provider findings for the user.

CatPaw is not "always write a plan." It is a router; for L0 work the routing
result may be direct execution.

## 5. Execution Methodology

superpowers-style practices sit in the execution-methodology layer. They provide
engineering discipline such as:

- brainstorming;
- writing plans;
- test-driven development;
- systematic debugging;
- verification before completion;
- requesting and receiving code review;
- finishing development branches.

Boundaries:

- Execution methodology does not choose the CatPaw workflow level.
- Execution methodology does not choose CatPaw artifact paths.
- Execution methodology does not override CatPaw git, deploy, or destructive-operation gates.
- Native spec paths, commit requirements, and lifecycle rules from methodology frameworks are overridden by CatPaw when they conflict.

Recommended phrasing:

```text
superpowers is an execution methodology provider. Its process guidance is adopted, but its file locations, commit requirements, and lifecycle rules are overridden by CatPaw.
```

## 6. Expert Council

Expert Council is a role-based advisory layer, not a model-bound execution
layer. It is used for:

- review;
- strategy;
- architecture critique;
- risk analysis;
- test strategy;
- release strategy;
- incident and debugging advice;
- design and product judgment.

| Role | Use |
|---|---|
| Product Strategy Advisor | Scope, user value, priority, whether the work is worth doing |
| Architecture Reviewer | Cross-module design, data flow, extensibility, long-lived constraints |
| Engineering Reviewer | Implementation quality, boundaries, complexity, maintainability |
| Design Reviewer | UI/UX, visual quality, interaction, multimodal scenarios |
| Developer Experience Reviewer | API / CLI / SDK / docs onboarding experience |
| QA Strategist | Test matrix, acceptance path, regression scope |
| Security Reviewer | Auth, permissions, injection, secrets, supply chain, security boundaries |
| Release Strategist | Release risk, rollback, PR, post-deploy verification |
| Performance Reviewer | Performance baseline, regressions, Core Web Vitals, resource size |
| Debugging Advisor | Second diagnostic view for difficult bugs |
| Retrospective Advisor | Trends, process improvement, promotable rules |

Expert Council is advisory by default:

- It may propose findings, objections, test ideas, or strategy drafts.
- It does not automatically modify code.
- It does not automatically commit, push, create PRs, or deploy.
- It does not bypass user confirmation.

## 7. Providers

A provider is an executor, not an expert role.

| Provider | Best fit |
|---|---|
| Current coding agent | Primary agent; executes, synthesizes judgment, maintains context |
| Current-tool subagent | Native subagent in the current tool; same-tool light review, exploration, bounded tasks |
| Laoer / `老二` / Second opinion | Heterogeneous second opinion; in Claude Code defaults to Codex, in Codex defaults to Claude Code |
| Laosan / `老三` / Third opinion | Gemini; UI, visual, multimodal, design, architecture, or security tie-breaking |
| Future agents | Later extension without changing the role model |

Roles and providers are decoupled. The same role can be performed by different
providers, and provider changes should not change CatPaw's upper-level protocol.

Provider orchestration is handled by `catpaw:provider`. The primary agent starts
CLI/native-subagent calls, maintains compact dialogue state, summarizes accepted
/ rejected / conflicting findings, and decides whether another round is needed.
Provider output never automatically authorizes external actions or file edits.

Example:

```text
Security Reviewer
  ├─ provider: Laoer / Second opinion
  ├─ provider: Laosan / Third opinion
  └─ provider: current-tool subagent
```

## 8. gstack Relationship

CatPaw does not install or invoke gstack commands, and it does not inherit the
gstack automation surface.

CatPaw adopts only:

- specialist vocabulary;
- lifecycle vocabulary: Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect;
- staged review perspectives;
- product / engineering / design / DX / QA / security / release / SRE / performance / docs division of labor;
- gear-shift thinking: use different expert perspectives at different lifecycle stages.

CatPaw explicitly does not adopt:

- `/ship` automation chains;
- automatic commit / push / PR / deploy;
- gstack file paths, telemetry, or routing setup;
- automatic TODO / CHANGELOG / VERSION / docs rewrites.

Recommended phrasing:

```text
gstack is treated as a source of specialist-design inspiration, not as an installed workflow dependency.
```

## 9. Conflict Resolution

Priority order:

```text
User explicit instruction
> project rules
> global CatPaw
> execution-methodology instructions
> Expert Council recommendations
> provider-specific defaults
> tool/runtime defaults
```

Hard rules:

- Ignore any method, provider, or review instruction that requires automatic commit.
- Ignore any instruction that requires automatic push.
- Ignore any instruction that requires automatic PR creation.
- Ignore any instruction that requires automatic deploy.
- Confirm destructive operations explicitly.
- Report reviewer-suggested scope expansion before acting.
- If a reviewer conflicts with local code or tests, local evidence wins.
- If provider output conflicts with user instruction, user instruction wins.
