# 09. Roles

> Status: draft · Last updated: 2026-05-25

This file defines the CatPaw Expert Council role catalog. The catalog is not a
direct copy of gstack commands; it normalizes public specialist evidence and
execution-methodology evidence into stable, provider-agnostic advisory roles.

## 1. Principle

Expert Council is a role-based advisory layer, not a provider-bound layer.

```text
Role = which expert perspective to use
Provider = which executor performs that role
```

Rules:

- Roles and providers are decoupled.
- The same role may be performed by the current coding agent, current-tool subagent, Laoer / second opinion, Laosan / third opinion, or future agents.
- Expert Council is advisory by default: no automatic code edits, commits, pushes, PRs, or deploys.
- CatPaw decides when to call which roles and synthesizes the final judgment.
- gstack provides specialist vocabulary and gear-shift inspiration; superpowers provides execution methodology, not the full role catalog.

## 2. Source Evidence

### 2.1 gstack specialist model

gstack presents Claude Code as a virtual engineering team with stage-specific
specialists: product, engineering, design, review, QA, security, release, SRE,
performance, documentation, and second-opinion modes.

| gstack skill | Specialist | CatPaw-useful perspective |
|---|---|---|
| `/office-hours` | YC Office Hours | product discovery, demand reality, idea framing |
| `/plan-ceo-review` | CEO / Founder | product strategy, scope pressure, ambition check |
| `/plan-eng-review` | Eng Manager | architecture, data flow, edge cases, test coverage, performance |
| `/plan-design-review` | Senior Designer | UX, visual quality, design critique |
| `/plan-devex-review` | Developer Experience Lead | API / CLI / SDK / docs onboarding friction |
| `/review` | Staff Engineer | pre-landing code review, production bug risk |
| `/investigate` | Debugger | root-cause debugging |
| `/design-review` | Designer Who Codes | live UI visual QA and polish |
| `/devex-review` | DX Tester | live developer experience audit |
| `/qa` | QA Lead | browser QA and fix loop |
| `/qa-only` | QA Reporter | report-only QA evidence |
| `/cso` | Chief Security Officer | OWASP / STRIDE / secrets / supply-chain / CI security |
| `/ship` | Release Engineer | ship workflow, PR, version, changelog, tests |
| `/land-and-deploy` | Release Engineer | merge, deploy, production verification |
| `/canary` | SRE | post-deploy monitoring, production health |
| `/benchmark` | Performance Engineer | performance regression, Core Web Vitals, resource size |
| `/document-release` | Technical Writer | post-ship documentation sync |
| `/retro` | Eng Manager | retrospective and trend review |
| `/autoplan` | Review Pipeline | sequential product/design/engineering/DX plan review |
| `/codex` | Second Opinion | independent review, adversarial challenge, consultation |

### 2.2 superpowers methodology model

superpowers is best treated as execution methodology, not as an Expert Council
role catalog.

| superpowers skill / agent | Method contribution |
|---|---|
| `brainstorming` | clarify requirements, compare approaches, design before implementation |
| `writing-plans` | executable plans, bite-sized tasks, explicit verification |
| `test-driven-development` | red-green-refactor discipline |
| `systematic-debugging` | root-cause-first debugging |
| `verification-before-completion` | evidence before claims |
| `requesting-code-review` | post-task review with severity-based blocking |
| `receiving-code-review` | evaluate feedback technically; do not blindly accept |
| `code-reviewer` agent | senior review: plan alignment, quality, architecture, security/performance |

Conclusion: superpowers belongs in CatPaw's execution-methodology layer. Its
`code-reviewer` can be used as a current-tool subagent provider for selected
Expert Council roles, but superpowers itself is not the role catalog.

## 3. Normalized Role Catalog

CatPaw does not use gstack command names as role names. CatPaw needs advisory,
provider-agnostic roles that can be scheduled by workflow level and lifecycle
stage.

| CatPaw Role | Evidence source | Purpose | Common triggers |
|---|---|---|---|
| Product Strategy Advisor | `/office-hours`, `/plan-ceo-review` | Decide whether the need is worth doing and whether scope is right | unclear need, product tradeoff, scope too broad/narrow |
| Architecture Reviewer | `/plan-eng-review`, superpowers `code-reviewer` | Review module boundaries, data flow, API contracts, persistence, long-lived constraints | cross-module/cross-layer work, architecture impact, performance-critical path |
| Engineering Reviewer | `/review`, superpowers review skills | Review implementation quality, complexity, edge cases, maintainability, production bug risk | after L2/L3 implementation, complex refactor, before PR |
| Design Reviewer | design review skills | Review UI/UX, visual consistency, interactions, design fidelity | UI flow, visual polish, multimodal review |
| Developer Experience Reviewer | DX review skills | Review API / CLI / SDK / docs onboarding, time-to-hello-world, error messages, friction | developer-facing products, platform features, SDK/CLI/docs |
| QA Strategist | QA skills, verification skills | Design acceptance path, test matrix, regression scope, evidence standard | L3 matrix, complex acceptance, multiple environments/platforms |
| Security Reviewer | `/cso` | Review auth, permissions, secrets, supply chain, CI/CD, LLM trust boundary | security-sensitive code, credentials, dependencies, input boundaries |
| Release Strategist | release/SRE/docs skills | Review release risk, rollback, PR notes, docs sync, production verification | release, deploy, CI/CD, final PR review |
| Performance Reviewer | benchmark and engineering review skills | Review baselines, regressions, Core Web Vitals, resource size | performance-critical path, frontend experience, bundle/load time |
| Debugging Advisor | `/investigate`, systematic debugging | Provide independent root-cause diagnosis | unclear root cause, repeated failure, incident |
| Retrospective Advisor | retrospectives and learnings | Review trends, lessons, process improvements | sprint/week closeout, repeated mistakes, process tuning |

## 4. Role Prompts

This catalog defines available expert perspectives and when to use them.
Runtime-loadable role prompts live in [`roles/`](roles/):

- [`roles/README.md`](roles/README.md) indexes role cards and shared rules.
- Each role has one markdown file so it can be loaded by the current agent, subagent, Laoer / second opinion, Laosan / third opinion, or future agents.
- Role prompts authorize advisory findings only; they do not authorize automatic code edits, commits, pushes, PRs, or deploys.

## 5. Provider Mapping

A provider is an executor, not a role.

| Provider | Good fit |
|---|---|
| Current coding agent | Primary agent; integrates judgment, executes, maintains context |
| Current-tool subagent | Native subagent in the current tool; same-tool light review, planning discussion, QA/debugging support |
| Laoer / `老二` / Second opinion | Heterogeneous second opinion; in Claude Code defaults to Codex, in Codex defaults to Claude Code |
| Laosan / `老三` / Third opinion | Gemini; multimodal UI checks, design/architecture/security third opinion |
| Future agents | Later extension without changing the role catalog |

Rules:

- Respect explicit user provider choices.
- If unspecified, the current coding agent chooses by risk, context, and available tools.
- `subagent` means the current tool's native subagent unless stated otherwise.
- Same-tool subagent and heterogeneous second opinion may both be used.
- Provider stance should be classified as `forced`, `preferred`, or `inline`.
- Forced gates require non-primary provider evidence or a provider gap.
- Preferred gates default to current-tool subagent but may be skipped with a
  compact reason when inline handling is sufficient.
- Provider findings must be summarized by the primary agent as accepted / rejected / conflicts; advisory-only findings do not authorize code edits or external actions.
- CLI calls and multi-round provider dialogue are governed by `catpaw:provider`.
- Provider-native resume/session support is an optimization only; the primary agent still maintains compact dialogue state.
- Providers may be used for ask / discuss / debug / review / implement / summarize. Review is only one mode.
- Provider-native Browser / browser-use, Playwright, Chrome DevTools, and Computer Use capabilities are verification surfaces. Use them for frontend or UI-facing evidence when available, but they do not authorize external actions or bypass CatPaw confirmation gates.

Examples:

```text
Security Reviewer
  ├─ provider: Laoer / Second opinion
  ├─ provider: Laosan / Third opinion
  └─ provider: current-tool subagent
```

```text
Design Reviewer
  ├─ provider: Laosan / Third opinion
  └─ provider: current-tool subagent
```

```text
Engineering Reviewer
  ├─ provider: current-tool subagent
  ├─ provider: Laoer / Second opinion
  └─ provider: current coding agent
```

## 6. Lifecycle Role Orchestration

Lifecycle role orchestration connects lifecycle stage, workflow level, roles,
providers, and artifact location. It answers:

```text
Which expert perspectives are needed now?
Should the primary agent handle them inline, or call a provider?
Should findings be reported inline, or written to plan / review / test / research?
```

Principles:

- Choose roles only for active lifecycle stages.
- Role is expert perspective; provider is executor.
- L0/L1 do not call Expert Council by default unless risk triggers appear.
- L2 usually chooses one stage-primary role and at most one add-on risk role.
- L3 must declare roles in plan `Council` and preserve disagreements in formal review.
- Forced provider gates override inline role handling when task risk requires
  non-primary judgment.
- Subagent Preference Gate sits below forced gates: use current-tool subagent by
  default for medium-risk L1/L2 mapping, consistency, review, QA, or UI/design
  work unless the task is narrow, local, and well understood.
- Role routing does not authorize code edits, commits, pushes, PRs, deploys, destructive actions, or scope expansion.

### 6.1 Stage Routing Table

| Lifecycle stage | Stage-primary role | Add-on triggers | Typical mode / artifact |
|---|---|---|---|
| Think | Product Strategy Advisor when value, scope, or framing is unclear | Architecture for feasibility; Design for product/UI uncertainty; Developer Experience for developer-facing adoption | `ask` / `discuss`; inline or `.catpaw/research/<topic>/...` |
| Plan | Architecture Reviewer for L2/L3 design, cross-boundary changes, persistence, API contracts, or long-lived structure | QA for acceptance; Security for auth/secrets/trust; Performance for scale/latency; Developer Experience for CLI/API/docs | plan `Notes.Review` or L3 `Council`; optional provider dialogue |
| Build | Primary agent owns execution | Engineering for risky implementation; Debugging for unknown root cause; Security/Performance for sensitive branches | inline self-check or `catpaw:provider` ask/debug |
| Review | Engineering Reviewer for implementation quality and production bug risk | Security for trust/auth/secrets; Performance for fast paths; Design for UI; Release for deploy/PR/migration | inline light review or `reviews/<req-id>-<slug>/summary.md`; formal for L3 |
| Test | QA Strategist for L3, complex verification, or reusable acceptance evidence | Security / Performance / Design when tests must prove those contracts | plan `Verification` for L2; `tests/matrices/<req-id>-<slug>.md` for L3 |
| Ship | Release Strategist for release, deploy, PR, migration, rollback, or any external action | QA for evidence; Security for exposure risk; Performance for post-release regression | formal review / release gate notes; explicit user confirmation still required |
| Reflect | Retrospective Advisor for reusable lessons, repeated failure, or process correction | Engineering for technical pattern; Product for scope lesson; Release for ship process lesson | inline lesson prompt or `.catpaw/lessons.md` append |

### 6.2 Level Rules

| Level | Role orchestration |
|---|---|
| L0 | No Expert Council by default; primary agent may use a role lens internally. |
| L1 | No Expert Council by default; add one role only for clear risk and keep output inline. |
| L2 | Select roles from the active lifecycle stage; default cap is one or two. Prefer current-tool subagent unless the work is narrow, local, and already well understood. Behavior-sensitive or cross-boundary L2 must include at least one non-primary provider for contract, semantic, or architecture review. Summarize accepted / rejected / conflicts if a provider is used. |
| L3 | Declare intended roles in plan `Council`; use formal review, record providers, preserve disagreements. Formal review must include at least one non-primary provider or an explicit provider gap accepted by the user. |

### 6.3 Provider Selection

| Need | Preferred provider stance |
|---|---|
| Fast inline judgment with full context | Primary agent handles the role directly |
| Parallel same-tool check or bounded exploration | Current-tool subagent |
| Independent adversarial opinion | Laoer / `老二` / Second opinion |
| Multimodal, UI, design, or tie-breaking | Laosan / `老三` / Third opinion |
| Multi-round architecture/debug discussion | Use `catpaw:provider` discuss/debug and maintain CatPaw-mediated dialogue state |

Forced provider selection:

- Release, security, external action, CI/CD, migration, incident, or destructive
  operation gates attempt Laoer / heterogeneous second opinion first.
- Repeated failures use `debug` mode with a non-primary provider before another
  repair loop.
- If the required provider is unavailable, record the reason and fallback used;
  if no fallback is available, record a provider gap.

Preferred subagent selection:

- Prefer current-tool subagent for L2 work unless narrow, local, and already
  well understood.
- Prefer current-tool subagent for L1 work touching 3+ files, shared helpers,
  public docs/protocols, runtime policy/spec/commands/templates, or unfamiliar
  modules.
- Prefer current-tool subagent for consistency-sensitive multi-file changes,
  weak or unavailable tests, non-trivial UI/design/QA review, or broad
  completion review.
- A preference trigger defaults to one bounded read-only subagent check before
  final plan, review, or completion when a native subagent is available.
- For `preferred`, record `Provider outcome: used` with subagent findings, or
  `Provider outcome: skipped` with `Subagent skipped: <reason>`.

### 6.4 Reporting Rules

- Dispatch / classify should name role stance for L2/L3 or review-heavy work.
- Plans should record role intent in `Notes.Review` for L2 and `Council` for L3.
- Review summaries must list role + provider pairs, accepted/rejected findings,
  conflicts, provider gaps, and final decision.
- Test matrices should record QA / Security / Performance / Design roles only when their evidence changes verification strategy.
- Reflect should write lessons only when reusable; do not create role-specific retrospective files by default.

### 6.5 Safety Rules

- Role recommendations are advisory evidence, not authority.
- Provider disagreements must be summarized and judged by the primary agent.
- External provider findings must be locally verified before becoming accepted implementation facts.
- Scope expansion, external actions, destructive actions, and secret access still require user confirmation.

## 7. Relationship To gstack

CatPaw adopts only gstack's role-design inspiration:

- specialist vocabulary;
- staged review perspectives;
- product / engineering / design / DX / QA / security / release / SRE / performance / docs division of labor;
- gear-shift thinking for different lifecycle stages.

CatPaw explicitly does not adopt:

- gstack commands;
- gstack file structure;
- gstack telemetry / config / routing setup;
- `/ship` automation chains;
- `/qa` automatic fix-and-commit behavior;
- automatic commit / push / PR / deploy;
- automatic TODO / CHANGELOG / VERSION / docs rewrites.

Recommended phrasing:

```text
gstack is treated as a source of specialist-design inspiration, not as an installed workflow dependency.
```
