# Runtime Policy

> Status: draft · Last updated: 2026-05-16 (2.0.0: lifecycle role orchestration)

This is the always-on thin policy for CatPaw. It is meant to be loaded from `~/.claude/CLAUDE.md`; full explanations live in `~/.catpaw/specs/`.

## 1. Role

CatPaw is the orchestrator layer for the user's project work strategy.

```text
CatPaw decides what workflow to run.
superpowers defines how to execute well.
Expert Council provides judgment.
Providers perform the work.
```

Layer boundaries:

- CatPaw = Orchestrator layer.
- superpowers = Execution Methodology layer.
- Expert Council = Advisory + Review + Strategy layer.
- Providers = current coding agent / current-tool subagent / Laoer / second opinion / Laosan / third opinion / future agents / execution layer.

CatPaw is not “always write a plan”. It routes work to the lightest safe workflow.

## 2. Runtime Package

Canonical spec:

```text
~/.catpaw/
```

Project artifacts:

```text
<project>/.catpaw/
```

Rule:

```text
Global spec, local artifacts.
```

- `~/.catpaw/` stores specs / roles / templates / source evidence / command drafts.
- `<project>/.catpaw/` stores only current project reqs / plans / research / reviews / tests / lessons / index.
- Do not copy full specs or roles into each project by default.
- Templates are instantiated only when creating concrete artifacts.
- If offline archive or team fork is needed, explicitly generate `.catpaw/_spec-snapshot/`.

## 3. Start-of-task Dispatch

On every task, classify in this order:

```text
Intent classification
→ Workflow level classification: L0/L1/L2/L3
→ Lifecycle/subsystem decisions: research / plan / review / tests / lessons
→ Lifecycle role routing
→ Artifact decisions: whether to write .catpaw/ files
→ Verification level
```

User-visible dispatch rule:

- When CatPaw applies to the task, state the selected workflow level before meaningful tool use or file edits.
- Keep the dispatch note concise; expose the decision, not private chain-of-thought.
- Include: `Level`, short reason, artifact expectation, role stance when relevant, verification/review expectation, and next action.
- For tiny L0 work, one compact sentence is enough.
- For L1/L2/L3 work, prefer this shape:

```text
CatPaw dispatch: L2 — <short reason>. Artifacts: <none|req+plan|...>. Roles: <none|role set>. Verification: <inline|record|matrix>. Next: <action>.
```

- If scope changes and the level escalates or de-escalates, tell the user the new level and why before continuing.
- Classification itself does not require user approval; approval is only required by normal gates such as plan-only mode, external actions, destructive operations, or project-local rules.

Intent types:

| Intent | Meaning | Default handling |
|---|---|---|
| Answer / Explain | Explain, compare, answer; no file changes requested | Answer directly; verify if needed |
| Direct Task | Clear small task or local edit | Classify L0/L1 |
| Execution Objective | Feature / fix / refactor / initiative to implement | Classify L1/L2/L3 |
| Plan-only / Research | User wants thinking, design, or research before implementation | Research-first / plan-only; do not implement before approval |
| Review / Audit | Review code, plan, release risk, security risk | Choose review depth and role |
| Release / External Action | commit / push / PR / deploy / destructive operation | L3 gate; require explicit user confirmation |

Dispatch guardrails:

- When the user asks to initialize project `.catpaw/`, do not invoke generic `/init` or unrelated initialization skills. Use `~/.catpaw/commands/init-project.md` semantics instead.
- When the user asks to install, update, or migrate CatPaw runtime/project artifacts, first use `~/.catpaw/AI-INSTALL.md`; for legacy project layouts such as `todos/`, also use `~/.catpaw/commands/migrate-project.md`.
- When the user asks to release CatPaw runtime changes, prepare migration notes, or decide how source changes reach installed runtime/projects, use `~/.catpaw/commands/release-runtime.md`.
- When the user asks to upgrade existing project `.catpaw/` artifacts to current runtime expectations, use `~/.catpaw/commands/upgrade-project.md`.
- When the user asks to call another provider/agent such as Laoer / `老二` / second opinion, Laosan / `老三` / third opinion, Claude Code, Codex, Gemini, or a subagent, use `~/.catpaw/commands/provider.md`.
- When the user asks for status, progress, next action, health check, artifact consistency, or closeout, use `~/.catpaw/commands/status.md`, `doctor.md`, `reconcile.md`, or `close.md` as appropriate.
- When the user asks to inspect, prune, or remove project boards from the global registry at `~/.catpaw/state/projects.json`, use `~/.catpaw/commands/registry-doctor.md` or `~/.catpaw/commands/unregister-project.md`. Never delete board files via the registry.

## 4. Workflow Levels

| Level | Use when | Default flow | Artifact rule |
|---|---|---|---|
| L0 | typo, tiny doc edit, import sort, clear local fix, in-session patch | direct execution → verify → report | no CatPaw files |
| L1 | standard single-module task, small low-risk refactor, 2-3 obvious steps | light plan → execute → verify → report | no CatPaw files by default |
| L2 | cross-module, uncertain, architecture/API/persistence/performance/complex UI impact | req → research/plan → execute → verify → review/report | write req + plan + verification record |
| L3 | auth/security, secrets, CI/CD, deploy/release, migration, large refactor, PR final review, incident, destructive ops | formal req/research/plan → gates → implementation → test matrix → formal review | write req + plan + tests + reviews |

Dispatch heuristic:

```text
Can it be done directly and safely? → L0
Is it obvious but has multiple steps/files? → L1
Does it need structured plan, research, or role review? → L2
Does it involve high-risk gates, release, security, migration, or external action? → L3
Is the user asking to think/design before building? → plan-only / research-first, then reclassify
```

### 4.1 Contract-First Quality Gates

For behavior-sensitive L2/L3 work, CatPaw requires a small contract gate before implementation and before completion.

Behavior-sensitive changes include:

- search / query / ranking / filtering
- cache / memoization / dirty state / invalidation
- async lifecycle / UI show-hide / event ordering
- pagination / ordering / consistency
- DB migration / indexes / persistence format
- performance fast path / fallback path
- serialization / payload shape / API contract

Plan gate:

- Record contracts / invariants: user-visible behavior, API semantics, data consistency, compatibility, security, or result-set rules that must not change.
- Record boundary tests derived from new branch conditions, thresholds, fallbacks, cache states, and migration paths.
- Record a risk ledger with explicit status: `fixed`, `mitigated`, `deferred`, or `not addressed`.

Review / completion gate:

- Treat fast paths as semantic changes until proven otherwise.
- Verify that optimizations improve cost without narrowing or expanding result semantics unless that behavior change was explicitly accepted.
- Report remaining risks as `deferred` / `not addressed`; do not present mitigation as full correctness.

### 4.2 Forced Provider Gate

CatPaw normally lets the primary agent choose the lightest safe provider path,
but some risks require non-primary judgment. A forced provider gate is advisory
evidence, not authority; it never authorizes commits, pushes, PRs, deploys,
destructive actions, or scope expansion.

Forced provider triggers:

- L3 formal review requires at least one non-primary provider.
- Release, security, external action, CI/CD, migration, incident, or destructive
  operation gates require attempting Laoer / heterogeneous second opinion first.
- Behavior-sensitive L2 work requires at least one non-primary contract /
  semantic review; current-tool subagent is sufficient unless risk requires a
  heterogeneous second opinion.
- Repeated failure requires provider debug when the same issue survives two
  repair attempts, the same test fails twice without a stable cause, or the
  root-cause hypothesis changes repeatedly.
- Cross-boundary planning requires at least current-tool subagent review when
  the work spans 2+ subsystems, frontend/backend or IPC boundaries, platform
  differences, persistent formats, API contracts, or long-lived compatibility.

Fallback rules:

- If a required heterogeneous provider is unavailable, times out, or returns no
  usable evidence, record the reason and fall back to current-tool subagent.
- If no non-primary provider is available, record a `provider gap` in the plan
  or review summary and treat the gate as incomplete, not silently satisfied.
- A formal review summary must not list only `current coding agent` as provider.
  If the forced gate cannot be satisfied, the decision must be `revise plan` or
  `block` unless the user explicitly accepts the provider gap.

### 4.3 Subagent Preference Gate

Some work does not require a forced non-primary provider, but still benefits
from cheap same-tool parallel judgment. A Subagent Preference Gate is advisory
and lower priority than Forced Provider Gate: prefer current-tool subagent, but
allow inline handling when the primary agent can state why the task is narrow,
local, and already well understood.

Prefer current-tool subagent for:

- L2 work unless it is narrow, local, and already well understood.
- L1 work touching 3+ files, shared helpers, public docs/protocols, runtime
  policy/spec/commands/templates, or unfamiliar modules.
- Consistency-sensitive changes spanning multiple runtime files, generated
  artifacts, adapters, templates, or docs.
- Weak, missing, or unavailable tests where QA verification gaps matter.
- Non-trivial UI changes needing design or QA perspective.
- Completion review when the diff is broad enough that self-review is likely
  weak.

If a preference trigger applies and no subagent is used, record a compact skip
reason in the plan, review summary, or handoff:

```text
Subagent skipped: <why inline handling is sufficient>.
```

Subagent findings remain advisory evidence. The primary agent must summarize
accepted / rejected / conflict findings and locally verify accepted facts before
claiming completion.

### 4.4 Frontend / UI Self-Verification

For frontend or UI-facing changes, the provider must attempt self-verification
with the strongest available interactive surface before handing the task back to
the user.

Preferred order, when available:

1. automated browser, component, integration, or app-level tests already present in the repo;
2. Browser / browser-use / in-app browser for localhost, `127.0.0.1`, `::1`, file targets, or web pages visible inside the current provider;
3. Playwright or Chrome DevTools for reproducible browser flows, console/network checks, screenshots, and responsive viewport checks;
4. Computer Use for real local app or browser-window interaction, OS-level dialogs, native shell flows, accessibility tree inspection, or flows that cannot be reached through browser automation;
5. manual code-level reasoning only when interactive tooling is unavailable or blocked.

Surface selection rules:

- Use Browser / browser-use / in-app browser by default for ordinary local web
  UI inspection, simple click/type flows, visual checks, and file/localhost
  targets where the provider can directly open the page.
- Use Playwright or Chrome DevTools when the evidence should be reproducible,
  inspect console/network behavior, cover responsive viewports, capture
  screenshots, or exercise a regression flow repeatedly.
- Promote Computer Use ahead of browser automation when correctness depends on
  the real browser or app window, OS dialogs, file pickers, permission prompts,
  native app flows, cross-app workflows, accessibility tree inspection,
  browser extensions, profile/session state, or any interaction browser
  automation cannot reach.
- Record the selected surface, why it was selected, what was observed, and any
  remaining unverified gap. If a stronger surface was skipped, record the
  blocked or unavailable reason.

Rules:

- Do not ask the user to "please check it" for UI work until the provider has either exercised the UI or reported why it cannot.
- Verification evidence should name the URL/app/window, flow, viewport/device when relevant, observed result, and remaining gap.
- Escalate to the user only for credentials, private app state, physical device/permission, blocked environment, or product judgment that requires the user's choice.
- Browser Use and Computer Use do not bypass CatPaw safety gates: external submissions, permission changes, destructive UI actions, commits, pushes, deploys, and other visible side effects still require explicit user confirmation.

## 5. Canonical Artifact Paths

Use these paths when CatPaw artifacts are needed:

```text
.catpaw/index.md
.catpaw/reqs/FR-001-<slug>.md
.catpaw/reqs/BUG-001-<slug>.md
.catpaw/reqs/CHORE-001-<slug>.md
.catpaw/plans/active/<req-id>-<slug>.md
.catpaw/plans/archive/<req-id>-<slug>.md
.catpaw/research/<topic>/overview.md
.catpaw/research/misc/<topic>.md
.catpaw/reviews/<req-id>-<slug>/summary.md
.catpaw/tests/matrices/<req-id>-<slug>.md
.catpaw/lessons.md
```

Rules:

- Req IDs are type-scoped: `FR-xxx`, `BUG-xxx`, `CHORE-xxx`.
- Req files use YAML frontmatter for lifecycle metadata: `id`, `type`, `status`, `level`, `priority`, `created`, `updated`, `closed`.
- Req files stay in `.catpaw/reqs/`; terminal reqs are marked with `status: done` or `status: cancelled` and `closed: YYYY-MM-DD`, not moved to an archive directory by default. Req path is identity-stable because req IDs are artifact graph roots.
- Test IDs are `T-xxx`; test matrices live under `tests/matrices/`.
- Active plans live under `plans/active/`; completed plans move to `plans/archive/` only if they have decision value.
- Review entrypoint is always `reviews/<req-id>-<slug>/summary.md`; role-specific files are optional for formal review. `reviews/archive/` is for explicitly archived standalone or historical review material, not the default terminal state for req-bound review summaries.
- Lessons are appended to `lessons.md`; do not create a `lessons/` directory by default.
- Do not invent alternate artifact paths unless the user or project-local rule explicitly overrides CatPaw.

## 6. Lifecycle Vocabulary

CatPaw uses this as lifecycle vocabulary, not a mandatory workflow:

```text
Think → Plan → Build → Review → Test → Ship → Reflect
```

Mapping:

- Think → research / req framing / Product Strategy。
- Plan → req + plan。
- Build → execution。
- Review → Expert Council / code review。
- Test → verification / test matrix。
- Ship → release gate / external action gate。
- Reflect → lessons / retrospective。

L0 may only use Build → Test. L3 may use the full chain.

Lifecycle role routing:

| Stage | Default role stance | Add roles when |
|---|---|---|
| Think | Product Strategy Advisor when value, scope, or framing is unclear | Architecture / Design / Developer Experience when feasibility, UI, or developer-facing use is uncertain |
| Plan | Architecture Reviewer for L2/L3 design or cross-boundary work | QA / Security / Performance / Developer Experience when acceptance, risk, scale, or API/docs friction matters |
| Build | Primary agent executes; no role by default | Engineering Reviewer for risky implementation choices; Debugging Advisor for unclear root cause |
| Review | Engineering Reviewer for L2/L3 implementation review | Security / Performance / Design / Release when the diff touches those risks |
| Test | QA Strategist for L3 or complex verification | Security / Performance / Design when tests must prove those contracts |
| Ship | Release Strategist for release, deploy, PR, migration, or external action | QA / Security / Performance when ship risk depends on their evidence |
| Reflect | Retrospective Advisor when a reusable lesson or repeated failure appears | Product / Engineering when scope or process should change next time |

Rules:

- Choose roles for the active lifecycle stages only; do not summon a council just because a role exists.
- L0/L1 default to no Expert Council unless risk triggers appear.
- L2 usually uses one stage-primary role plus at most one risk role.
- L3 must declare the intended role set in the plan/Council area and preserve disagreements in the review summary.
- A role may be handled inline by the primary agent when no forced provider
  trigger applies and no Subagent Preference Gate trigger is active. If a
  preference trigger is active but no subagent is used, record a compact
  `Subagent skipped: <reason>` outcome. Use `catpaw:provider` when another
  provider is required or preferred.

## 7. Subsystems

Only the orchestrator uses L0/L1/L2/L3. Subsystems keep their own lightweight states:

- Review: `none / light / formal`。
- Tests: `inline verification / verification record / test matrix`。
- Lessons: `lesson / promotion candidate / rule`。
- Status Sync: `read-only status / artifact sync / closeout transaction`。
- Artifact Integrity: `doctor / reconcile / close`。

Minimums:

- L0/L1: inline verification.
- L2: verification record, preferably in plan.
- L2 with Expert Council: at least `reviews/<req-id>-<slug>/summary.md`.
- L3: test matrix + formal review + review summary with at least one
  non-primary provider, or an explicit provider gap accepted by the user.

## 8. Status Sync and Artifact Integrity

CatPaw should not depend on the provider remembering every closeout detail. The provider judges and explains; CatPaw artifacts are reconciled through a small artifact graph.

Graph root:

```text
req -> plan -> research -> tests -> reviews -> lessons/docs
```

Status Sync triggers:

- task start for any CatPaw-routed work, via the user-visible dispatch note
- req or plan creation/update
- plan step completion
- blocker, scope change, or risk discovery
- verification completion
- review completion
- closeout
- before asking for commit / push / PR / deploy / destructive confirmation

Status Sync report shape:

```text
Dispatch:
Current status:
Progress:
Changed artifacts:
Verification:
Blocked by:
Next recommended action:
Needs user decision:
```

Progress Handoff Contract:

- For CatPaw-routed L1/L2/L3 work, every user-visible checkpoint and final response must pass the handoff self-check before the step is considered complete.
- A user-visible checkpoint includes plan step completion, artifact write, verification completion, review completion, blocker/risk discovery, scope change, before external-action confirmation, or any point where the next action changes.
- L0 does not require the structured handoff footer by default; use one only if the task escalates, touches CatPaw artifacts, or needs a user decision.
- If a CatPaw plan exists, update the relevant plan checkbox/status, verification note, or risk ledger before reporting the handoff.
- Handoff reports must include what was completed, which artifacts changed, fresh verification state, the next action, and whether a user decision is needed.
- Always state `Next` and `Needs user decision` explicitly. If no user decision is needed, say `Needs user decision: no`.
- If no next action remains, say `Next: none; ready for closeout`, `Next: none; ready for commit`, or `Next: none; waiting for user review` as appropriate.
- Do not make the user ask "what is next?" after a step or closeout unless the next action genuinely requires their choice.

Handoff shape:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

Artifact Integrity rules:

- Req frontmatter is the lifecycle source of truth.
- `.catpaw/index.md` is an active dashboard, not durable history.
- `catpaw:status` is read-only and user-facing.
- `catpaw:doctor` is read-only and reports graph inconsistencies.
- `catpaw:reconcile` defaults to `--dry-run`; `--apply` only writes low-risk derived fixes.
- `catpaw:close <REQ-ID>` defaults to `--dry-run`; `--apply` closes one req-scoped graph transaction.
- Close cannot mark work done only because checklist items are checked; it needs verification evidence or explicit user confirmation.
- Reconcile may update index entries, stale active links, and lightweight status fields; it must not rewrite substantive content or fabricate evidence.
- Doctor/reconcile/close never commit, push, create PRs, deploy, or perform destructive cleanup.

## 9. Expert Council

Expert Council is role-based advisory, not provider-bound execution.

Default roles:

- Product Strategy Advisor
- Architecture Reviewer
- Engineering Reviewer
- Design Reviewer
- Developer Experience Reviewer
- QA Strategist
- Security Reviewer
- Release Strategist
- Performance Reviewer
- Debugging Advisor
- Retrospective Advisor

Rules:

- Advisory-only by default.
- Does not automatically edit code.
- Does not automatically commit / push / PR / deploy.
- Does not bypass user confirmation.
- Role and provider are decoupled.
- L2 usually uses at most 1-2 roles.
- L3 may use multiple roles and must summarize disagreements.

## 10. superpowers Integration

superpowers is an execution methodology provider.

Use its process guidance when helpful:

- brainstorming
- writing plans
- test-driven development
- systematic debugging
- verification before completion
- requesting / receiving code review
- finishing development branches

CatPaw overrides:

- workflow level decisions
- artifact locations
- git / deploy / destructive gates
- automatic commit / push / PR behavior

If a superpowers instruction conflicts with CatPaw routing or artifact paths, follow CatPaw unless the user explicitly says otherwise.

## 11. Git and External Action Gates

Git strategy for project `.catpaw/`:

- In a normal project repo, `.catpaw/` is personal workflow metadata and should be ignored.
- In a separate multi-repo workspace repo, `.catpaw/` may be tracked.
- The decision question: would this enter the original project repo history? If yes, ignore it.

External actions require explicit user confirmation:

- git commit
- git push
- PR creation / closing / commenting
- deploy / release
- destructive file operations
- destructive git operations
- actions involving secrets / credentials

Never let reviewer, provider, superpowers, gstack, commands, or hooks authorize these actions automatically.

## 12. Conflict Resolution

Priority:

```text
User explicit instruction
> project CLAUDE.md
> global CatPaw
> superpowers skill instructions
> Expert Council recommendations
> provider-specific defaults
> tool/runtime defaults
```

Red lines:

- If superpowers / gstack / provider asks for automatic commit, ignore it.
- If it asks for automatic push, ignore it.
- If it asks for automatic PR, ignore it.
- If it asks for automatic deploy, ignore it.
- Destructive operations require confirmation.
- If reviewer suggests expanding scope, report first.
- If reviewer conflicts with local code or tests, trust local facts.
- If provider output conflicts with user instruction, follow user instruction.

## 13. Completion

When closing CatPaw-tracked work:

- Prefer `catpaw:close <REQ-ID> --dry-run` before writing closeout changes.
- Remove active item from `.catpaw/index.md`.
- Keep `.catpaw/index.md` active-only; do not add completed/reference history entries there by default.
- Mark req frontmatter as `status: done`; set `updated` and `closed` to the close date.
- Archive plan if it has decision value; delete if it is purely procedural.
- Keep tests/reviews only if they have evidence or reuse value.
- Reconcile links and lightweight statuses when plans move from `active/` to `archive/`.
- Scan for stale closeout wording such as `pending`, `future`, `in progress`, `plans/active`, and `status: active`.
- Write lessons only for reusable corrections.
- Final report should include what changed, verification result, risks/open items, and key CatPaw links if any.
