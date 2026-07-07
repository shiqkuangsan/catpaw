# catpaw:review

Run an Expert Council review for the current task, plan, implementation, or release gate.

## Behavior

- Choose roles by risk and task stage.
- Use lifecycle role orchestration before falling back to generic role selection.
- L2 usually uses 1-2 roles.
- L3 may use multiple roles and must preserve disagreements.
- Review mode may be `none`, `light`, `adversarial`, or `formal`.
- Use `adversarial` when the goal is to actively challenge assumptions,
  contracts, boundary cases, simpler alternatives, hostile/weird inputs, or
  missing evidence before completion.
- `summary.md` is the review entrypoint.
- Role files are optional unless formal review or reusable findings justify them.
- Providers are execution details; roles are expert perspectives.
- For behavior-sensitive changes, include contract / semantic checks even when review mode is light.
- For forced provider triggers, include non-primary provider evidence or an
  explicit provider gap.
- For Subagent Preference Gate triggers, include current-tool subagent findings
  or a compact skip reason.
- For frontend or UI-facing work, include whether available interactive
  verification was attempted through repo tests, Browser / browser-use /
  in-app browser, Playwright, Chrome DevTools, or Computer Use. Record the
  selected surface, why it was sufficient, and any skipped stronger surface with
  its blocked/unavailable reason.

## Role Selection

Stage-first routing:

- Think: Product Strategy Advisor; add Architecture / Design / Developer Experience when framing depends on feasibility, UI, or developer adoption.
- Plan: Architecture Reviewer; add QA / Security / Performance / Developer Experience when acceptance, safety, scale, or API/docs friction matters.
- Build: primary agent by default; add Engineering Reviewer for risky implementation choices or Debugging Advisor for unclear root cause.
- Review: Engineering Reviewer; add Security / Performance / Design / Release when the diff touches those risks.
- Test: QA Strategist; add Security / Performance / Design when tests must prove those contracts.
- Ship: Release Strategist; add QA / Security / Performance when ship risk depends on their evidence.
- Reflect: Retrospective Advisor when there is a reusable lesson or repeated failure.

Risk triggers:

- Product scope or user value uncertainty: Product Strategy Advisor.
- Architecture, API, persistence, or cross-module changes: Architecture Reviewer.
- Implementation quality, maintainability, or refactor risk: Engineering Reviewer.
- UI / UX changes: Design Reviewer.
- Tooling, workflow, docs, or onboarding impact: Developer Experience Reviewer.
- Test strategy, acceptance, or release confidence: QA Strategist.
- Auth, secrets, permissions, supply chain, or data exposure: Security Reviewer.
- Deploy, migration, rollback, or external action: Release Strategist.
- Latency, throughput, memory, or scale risk: Performance Reviewer.
- Root cause analysis or recurring failures: Debugging Advisor.
- Reusable process lessons: Retrospective Advisor.

## Provider Playbook

- Respect explicit user provider choices first.
- If the user did not specify a provider, the current coding agent chooses based on risk, context, and available tools.
- `subagent` means the current tool's native subagent by default; use it for same-tool light review, planning discussion, or QA/debugging support.
- Laoer / `老二` / second opinion / second reviewer is a heterogeneous second opinion: in Claude Code it defaults to Codex; in Codex it defaults to Claude Code.
- Laosan / `老三` / third opinion / third reviewer defaults to Gemini; use it for multimodal UI checks or third-party judgment.
- Same-tool subagent and heterogeneous second opinion may both be used for review, planning discussion, debugging, or risk calls.
- The summary must name role and provider, for example `Engineering Reviewer via current-tool subagent + Security Reviewer via Laoer / second opinion`.
- Provider stance should be reported as `forced`, `preferred`, or `inline` when
  provider participation is required, preferred, or explicitly handled inline.
  Provider outcomes such as `used`, `skipped`, `unavailable`, or `gap` should be
  reported separately from stance.
- L3 formal review must include at least one non-primary provider. `current
  coding agent` alone is not a valid provider list for formal review.
- Release, security, external action, CI/CD, migration, incident, or destructive
  operation review must attempt Laoer / heterogeneous second opinion first.
- L3 formal review and release/security/incident review should prefer
  observable long-running provider mode when the provider task may run silently
  for a long time.
- Behavior-sensitive L2 review must include at least one non-primary contract /
  semantic review provider.
- Repeated-failure review must use provider `debug` before another repair loop.
- If a required provider is unavailable, times out, or returns no usable
  evidence, record the reason, fall back to current-tool subagent, and mark any
  remaining provider gap. No stdout from a live provider process/session is not
  sufficient evidence of unavailability; inspect status, recent output, or
  provider-native state first. Initialization chatter, repo status, or
  "Ready for your next task" style output without review/debug findings counts
  as no usable output.
- For preferred subagent triggers, skip only when inline review is sufficient
  and record `Subagent skipped: <reason>`.
- For `preferred`, final review/completion evidence must show either
  `Provider outcome: used` with subagent findings, or `Provider outcome:
  skipped` with `Subagent skipped: <reason>`.
- Generic provider orchestration for CLI calls, multi-round dialogue, debug, ask, implement, or summarize uses `catpaw:provider`.

## Interactive UI Evidence

For UI review, prefer evidence from the strongest available surface:

- repo-native automated tests;
- Browser / browser-use / in-app browser for ordinary local web UI inspection;
- Playwright or Chrome DevTools for reproducible browser flows, console/network
  checks, screenshots, and responsive viewport coverage;
- Computer Use for real local app/browser-window, OS dialogs, file pickers,
  permission prompts, native flows, cross-app workflows, accessibility tree
  checks, browser extensions, profile/session state, or browser-automation
  unreachable UI;
- blocked/unavailable reason when no interactive surface can be used.

Review evidence should name the selected surface, selection reason, observed
result, and remaining verification gap.

Browser Use and Computer Use do not authorize external submissions,
destructive UI actions, permission changes, commits, pushes, PRs, deploys, or
other visible side effects.

## Contract / Semantic Checks

Use for search/query/ranking, cache, async lifecycle, pagination/order consistency, DB migration/indexes, performance fast paths, serialization, or API payload changes.

- What contract or invariant is supposed to remain true?
- Does the implementation change result semantics, ordering, visibility, freshness, or error behavior?
- Are fallback and boundary conditions covered by tests?
- Which risks are fixed, mitigated, deferred, or not addressed?
- Is any reviewer finding accepted only after local verification?

## Adversarial Checks

Use for L3, behavior-sensitive L2, repeated failures, security/performance
paths, broad diffs, milestone closeout, or explicit requests to challenge a
solution.

- What assumption would break this solution if it were false?
- What hostile, oversized, malformed, stale, future-dated, reordered, or
  duplicated input could expose a flaw?
- Is there a smaller or more direct solution that preserves the same contract?
- What evidence would convince a skeptical reviewer that the risk is closed?
- Which risk remains only mitigated or deferred?

## Artifact Rule

- Light review may be reported inline without writing files.
- Formal review writes `.catpaw/reviews/<req-id>-<slug>/summary.md`.
- Role-specific files are optional and should only be written when they contain durable evidence, disagreements, or reusable decisions.
- `reviews/archive/` is not the normal terminal state for req-bound review summaries. Use it only for explicitly archived standalone or historical review material.

## Output

Write or report review summary:

```text
Mode: none | light | adversarial | formal
Roles:
Providers:
Provider gaps:
Provider stance:
Subagent skipped:
Adversarial checks:
Accepted findings:
Rejected findings:
Contract / semantic checks:
Risk ledger:
Conflicts:
Decision: proceed | revise plan | block
```

## Limits

- Advisory-only by default.
- Do not auto-apply reviewer fixes without user approval when findings came from external providers.
- Do not commit / push / PR / deploy.
- Do not mark a forced provider gate as `proceed` when the only provider is the
  current coding agent, unless the user explicitly accepted the provider gap.
