# Changelog

## 3.0.2 - 2026-07-13

- Make strict activation compare only manifest-managed installed files while
  preserving and reporting local state, backups, unknown files, and symlinks.
- Declare retired 2.x runtime roots through `legacyRuntimePaths` and fail strict
  verification if stale command, role, spec, guide, source-evidence, or tool
  authority remains live after activation.
- Require explicit canonical/retired path arrays and validate retired paths in
  both build and verification as unprotected top-level directories with
  case-insensitive collision checks; `state/`, `backups/`, root, file, and
  nested targets are invalid.
- Keep `build-runtime` cleanup fixed to the repository dist root instead of
  exposing destructive source/dist overrides through process environment.
- Run installed CLI smoke only after exact managed file/directory parity and a
  contained executable entrypoint are proven; bound smoke time and report the
  actual failing init/status stage.
- Require local active documentation links to remain lexically and physically
  inside the runtime root, reject absolute filesystem and `file:` targets, and
  allow only explicit web/mail schemes before reporting installation current.
- Keep the thin global adapter's `老二` routing explicit for reciprocal
  Codex-to-`cc` and Claude-Code-to-`cx` checks without restoring a third Agent.

Migration note (3.0.1 -> 3.0.2):

```text
Runtime activation: explicit; source/dist 3.0.2 does not update ~/.catpaw automatically.
Project impact: board schema remains 2 and schema 1 migration behavior is unchanged from 3.0.1.
Required actions: rebuild and verify source/dist; stage activation with local extras preserved and every legacyRuntimePaths entry backed up and absent from live runtime.
Safety: strict verification does not read local-only surfaces, but still rejects drift inside canonical runtime directories and checks installed CLI mode/links/smoke.
Optional actions: refresh stale global or project adapters separately when they reference retired 2.x paths or providers.
Non-goals: no adapter rewrite, registry mutation, board migration, commit, push, or cleanup is implied by this hotfix.
Rollback: keep the installed 2.1.7 runtime until 3.0.2 and required adapter patches are separately approved.
```

## 3.0.1 - 2026-07-13

- Replace exhaustive schema 1 conversion with active-closure migration;
  preserve incomplete historical artifacts and converted originals under an
  isolated, checksummed `legacy/schema-1/` archive.
- Normalize canonical filename IDs, prefix-derived types, exact status aliases,
  terminal stage `reflect`, and uniquely resolvable path bindings without
  inventing active dates, stages, modes, or accepted gaps.
- Extend active dependency closure through active Milestone Scope, block active
  Work/Milestone identity or terminal-routing conflicts, and suppress Plan or
  Milestone findings that merely cascade from one invalid active Work Item.
- Collapse cascaded metadata failures into actionable active Work/Plan root
  blockers; require project-local links to exist and physically remain inside
  the project, including through symlinks.
- Preserve source file, BOM, and legacy-directory modes; validate schema 2
  boards before reporting migration no-op.
- Keep human migration output compact while retaining complete machine-readable
  mappings, warnings, legacy dispositions, and checksums.

Migration note (3.0.0 -> 3.0.1):

```text
Runtime activation: explicit; source/dist 3.0.1 does not update ~/.catpaw automatically.
Project impact: board schema remains 2; existing schema 2 boards are unchanged, while schema 1 boards should rerun migration dry-run because 3.0.0 previews are superseded.
Required actions: build and verify source/dist; inspect each schema 1 board's active blockers and legacy manifest before any separately authorized apply.
Safety: incomplete history is byte-preserved with SHA-256; active dependency ambiguity and filesystem hazards still block migration.
Non-goals: no installed-runtime activation, registry rewrite, adapter rewrite, board migration, legacy cleanup, commit, or push is implied by this source change.
Rollback: keep the installed 2.x runtime and schema 1 boards until explicit activation and per-project migration approval.
```

## 3.0.0 - 2026-07-11

- Replace workflow levels with `Direct`, `Tracked`, and `Gated` while preserving
  `Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect`.
- Introduce board schema 2 with Milestone, Work Item, Plan, and typed Evidence;
  add deterministic schema 1 migration with dry-run, staged validation, complete
  backup, and exact second-run no-op.
- Add the Node CLI for board/work/milestone/evidence operations and observable
  Agent sessions.
- Make Gated completion depend on substantive test plus independent Evidence
  (or an accepted gap that names every current missing gate) across close,
  doctor, and migration validation.
- Reject non-UTF-8 migration inputs, preserve mapped file modes, and keep tmux
  failures/provider-access uncertainty factual in Agent diagnostics; retain
  provider process exit status and fallback through observable sessions.
- Replace the old role tree with five Lens cards and lifecycle-owned review,
  testing, release, debugging, and reflection methods.
- Select optional execution methods by concrete lifecycle trigger instead of
  meta-skill invocation; classify Agent delivery/adoption without adding a new
  artifact ledger.
- Treat prompt-only read-only as insufficient for sensitive state: require
  enforceable sandbox/allowlist/read-only data access and bounded side-effect
  audit when such work is delegated.
- Limit managed reciprocal external Agents to Claude Code (`cc`) and Codex
  (`cx`); remove third-provider invocation guidance and blocking session waits.
- Consolidate runtime authority into one routing policy, four guidance files,
  five Lenses, two provider recipes, one schema, and four templates.

Migration note (2.x -> 3.0.0):

```text
Runtime activation: explicit; source/dist 3.0.0 does not update ~/.catpaw automatically.
Project impact: board schema changes from 1 to 2; existing boards remain readable but mutation requires an explicit board migrate dry-run/apply.
Required actions: build and verify source/dist; install runtime only when current work can tolerate activation; migrate each project independently.
Safety: runtime upgrade preserves ~/.catpaw/state and unknown files; board apply writes a complete preimage backup before publishing the staged board.
Non-goals: no global apply, registry rewrite, adapter rewrite, project migration, commit, or push is implied by this source release.
Rollback: keep the installed 2.x runtime and schema 1 boards until explicitly activated; never delete published migration backups automatically.
```

## 2.1.7 - 2026-07-07
- Update Claude Code provider review/debug defaults to stdin pipe +
  `--safe-mode` + `--permission-mode plan` with write tools denied.
- Document `--add-dir` as variadic and require prompts through stdin for
  multi-directory/worktree review.
- Clarify safe-mode's context cost, no-usable-output fallback semantics, and
  verifier guardrails for Claude Code CLI guidance.
Migration note (2.1.6 -> 2.1.7):
```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use safer Claude Code provider review/debug invocation.
Project impact: no required project artifact schema migration; existing artifacts remain valid.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: refresh provider adapters only if they quote Claude Code invocation examples directly.
Verification: source/dist/installed VERSION = 2.1.7 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.7.md is required; this release changes runtime provider guidance, not project artifact schema.
```

## 2.1.6 - 2026-07-03
- Add lightweight adversarial review mode for high-risk review and closeout.
- Add root-problem framing for complex bug/architecture work without creating a
  mandatory prompt ritual.
- Extend provider/subagent routing, focused role cards, plan/review templates,
  and verifier guardrails for bounded adversarial checks.
Migration note (2.1.5 -> 2.1.6):
```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use adversarial review guidance.
Project impact: no required project artifact schema migration; existing artifacts remain valid.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: use adversarial review for high-risk closeout, repeated failures, and broad completion review.
Verification: source/dist/installed VERSION = 2.1.6 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.6.md is required; this release changes runtime guidance and templates, not required project artifact schema.
```

## 2.1.5 - 2026-06-29

- Add built-in Milestone guidance as an optional phase artifact for L2/L3
  multi-FR continuous objectives.
- Add `catpaw:milestone` command guidance and a milestone artifact template.
- Extend project status/doctor tooling to read active milestones and detect
  milestone/FR state drift.
- Strengthen Subagent Preference Gate so preferred stance needs provider
  evidence or an explicit skip reason, with doctor coverage.

Migration note (2.1.4 -> 2.1.5):

```text
Runtime upgrade: recommended for agents that should use Milestone mode or stronger autonomous subagent routing.
Project impact: no required project artifact schema migration; existing artifacts remain valid. New boards may include .catpaw/milestones/.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: group existing related FRs into .catpaw/milestones/MS-001-<slug>.md when a phase objective spans multiple FRs.
Verification: source/dist/installed VERSION = 2.1.5 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.5.md is required; this release changes runtime guidance and project inspector checks, not required project artifact schema.
```

## 2.1.4 - 2026-06-29

- Add repository slimming guardrails to `scripts/verify-runtime.mjs`, including
  current line budgets for high-churn runtime docs and invariant checks for
  workflow vocabulary, provider gates, stance/outcome terms, role routing, and
  safety gates.
- Slim historical changelog content by keeping recent operational release notes
  complete and replacing older repeated migration-note blocks with a compact
  historical summary.
- Thin `runtime-policy.md` into a compact always-on core card that preserves
  dispatch, gates, verification, provider, role, handoff, and external-action
  rules while pointing detailed semantics to canonical commands/specs.
- Slim `specs/08-operating-rules.md` into compact execution rules, removing
  duplicated provider/workflow prose and preserving provider stance/outcome,
  UI verification, provider availability, and reporting invariants.
- Shorten Expert Council role cards into compact Mission / Focus / Findings /
  Output / Limits prompts while preserving role intent and UI verification
  guardrails.

Migration note (2.1.3 -> 2.1.4):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use the slimmer runtime policy/changelog and source checkout slimming guardrails.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: continue FR-008 slimming rounds using verify-runtime line budgets and invariants as guardrails.
Verification: source/dist/installed VERSION = 2.1.4 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.4.md is required; this release changes runtime documentation and source checkout verification, not project artifact schema.
```

## 2.1.3 - 2026-06-07

- Clarify provider availability as a capability-aware routing decision: tmux,
  Claude Code, Codex, Gemini, OpenCode, and cross-provider subscriptions are
  optional capabilities, not CatPaw prerequisites.
- Add the provider fallback ladder: observable provider session ->
  provider-native or non-interactive CLI -> current-tool subagent -> inline role
  lens with explicit provider gap / skip reason.
- Add `tools/provider-session.sh check <provider>` so agents can record whether
  tmux and the target provider CLI are available before choosing a fallback.
- Clarify that missing tmux, missing provider CLI, missing subscription, or a
  user choice to use only one provider should downgrade verification strength,
  not break ordinary CatPaw work.

Migration note (2.1.2 -> 2.1.3):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use capability-aware provider fallback guidance and provider-session check diagnostics.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: run ~/.catpaw/tools/provider-session.sh check <provider> before long-running provider calls, especially on machines where tmux or secondary provider CLIs may be missing.
Verification: source/dist/installed VERSION = 2.1.3 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.3.md is required; this release changes provider fallback guidance and optional diagnostics, not project artifact schema.
```

## 2.1.2 - 2026-06-07

- Add observable long-running provider mode guidance for L3 review,
  release/security/incident gates, multi-round discuss/debug, and provider work
  expected to read many files.
- Clarify that no stdout while a provider process/session is still alive is not
  sufficient evidence of provider unavailability.
- Add optional tmux-backed `tools/provider-session.sh` for mainstream provider
  aliases: Claude Code (`cc` / `claude`), Codex (`cx` / `codex`), Gemini, and
  OpenCode (`oc` / `opencode`).
- Update provider dialogue template, review guidance, and operating rules to
  record invocation, observable surface, observed status, progress checks, and
  wait policy.
- Add ADR-0015 and runtime verification coverage for observable provider
  sessions.

Migration note (2.1.1 -> 2.1.2):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use observable provider session guidance and the optional provider-session tool.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: use ~/.catpaw/tools/provider-session.sh for long-running provider reviews when tmux and the provider CLI are available.
Verification: source/dist/installed VERSION = 2.1.2 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.2.md is required; this release changes provider orchestration guidance and adds an optional tool, not project artifact schema.
```

## 2.1.1 - 2026-06-07

- Add `catpaw:install-adapter` for explicit global/project provider adapter
  activation with dry-run, backup, and marker-block replacement rules.
- Add managed `<!-- CATPAW:BEGIN -->` / `<!-- CATPAW:END -->` blocks to global
  and project adapter snippets.
- Update install, init, and doctor guidance so adapter activation is explicit:
  runtime install and project init do not silently modify provider instruction
  files.
- Extend the source checkout project doctor to warn when a project `.catpaw/`
  board has no `AGENTS.md` / `CLAUDE.md` adapter, or when existing adapter files
  do not reference `~/.catpaw/runtime-policy.md`.
- Extend tests and `scripts/verify-runtime.mjs` to guard adapter activation
  guidance and doctor coverage.

Migration note (2.1.0 -> 2.1.1):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use explicit adapter activation and doctor warnings.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: run catpaw:install-adapter --global or --project --dry-run before applying adapter changes; run project doctor to detect adapter activation gaps.
Verification: source/dist/installed VERSION = 2.1.1 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.1.md is required; this release adds adapter activation guidance and warnings, not project artifact schema.
```

## 2.1.0 - 2026-06-07

- Add `specs/13-workflow-control-model.md` as the canonical decision table for
  workflow level, lifecycle stage, tracked state, artifact policy,
  role/provider routing, and verification.
- Clarify that workflow state is control vocabulary, not a new required
  frontmatter schema.
- Update runtime policy, classification, closeout, operating rules, and
  architecture specs to reference the canonical workflow control model.
- Extend `scripts/verify-runtime.mjs` to guard the workflow control model and
  state-aware dispatch guidance.

Migration note (2.0.11 -> 2.1.0):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use the canonical workflow control model.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: use specs/13-workflow-control-model.md when discussing workflow state, artifact creation policy, or role/provider routing drift.
Verification: source/dist/installed VERSION = 2.1.0 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.1.0.md is required; this release adds a canonical control model and guidance, not project artifact schema.
```

## 2.0.11 - 2026-06-07

- Strengthen the source checkout project doctor with executable governance
  checks for invalid provider stance values, L3 reqs missing test matrices, and
  plan directory/status drift.
- Add Node test coverage for provider stance validation, L3 test matrix
  requirements, and active/archive plan status contradictions.
- Extend `scripts/verify-runtime.mjs` to guard the new project inspector
  behavior and release metadata coverage.
- Update `catpaw:doctor` guidance to describe provider stance and plan status
  consistency checks.

Migration note (2.0.10 -> 2.0.11):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use the stronger source checkout doctor and verifier checks.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs and node --test.
Optional actions: run node scripts/catpaw-project.mjs doctor --project <project-root> --json on registered boards to detect newly-checkable drift.
Verification: source/dist/installed VERSION = 2.0.11 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.0.11.md is required; this release adds executable inspection checks, not project artifact schema or write-through commands.
```

## 2.0.10 - 2026-06-07

- Fix provider stance terminology so `inline`, `preferred`, and `forced` remain
  the only provider stance values.
- Clarify that `used`, `skipped`, `unavailable`, and `gap` are provider
  outcomes, not provider stances.
- Update plan, review, runtime policy, and operating rules so Subagent
  Preference Gate skip handling keeps stance as `preferred` and records
  `Subagent skipped: <reason>` separately.
- Extend `scripts/verify-runtime.mjs` to reject stale provider stance/outcome
  wording and old `materially improves judgment` language.

Migration note (2.0.9 -> 2.0.10):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use the corrected provider stance/outcome terminology.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs.
Optional actions: refresh provider global/project adapters if they should include the Computer Use priority selection rule and Subagent Preference Gate stance/outcome wording.
Verification: source/dist/installed VERSION = 2.0.10 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.0.10.md is required; this release changes runtime guidance and verifier checks, not project artifact schema or write-through commands.
```

## 2.0.9 - 2026-06-07

- Add Computer Use priority guidance for frontend / UI self-verification
  surface selection.
- Clarify that Browser / browser-use remains the default for ordinary local web
  UI, Playwright / Chrome DevTools is preferred for reproducible browser
  evidence, and Computer Use moves ahead for real-window, OS/native, cross-app,
  accessibility, browser-extension, profile/session, or browser-automation
  unreachable flows.
- Update plan/review commands, QA Strategist, Design Reviewer, operating specs,
  adapter snippets, and templates to record selected surface, selection reason,
  observed evidence, and remaining verification gap.
- Add Subagent Preference Gate guidance so medium-risk L1/L2 mapping,
  consistency, review, QA, and UI/design work prefers current-tool subagent
  participation while still allowing explicit inline skip reasons.
- Clarify provider stance as `forced`, `preferred`, or `inline`, and require
  `Subagent skipped: <reason>` only when a preference trigger is skipped.
- Clarify CatPaw's architecture as 4 conceptual layers plus 2 cross-cutting
  control planes: Artifact Graph and Gates / Verification.
- Extend `scripts/verify-runtime.mjs` to guard Computer Use priority guidance in
  source, dist, and installed runtime.
- Extend `scripts/verify-runtime.mjs` to guard Subagent Preference Gate guidance
  in source, dist, and installed runtime.

Migration note (2.0.8 -> 2.0.9):

```text
Runtime upgrade: optional; run catpaw:upgrade-runtime if agents should use the stronger Computer Use surface selection and Subagent Preference Gate guidance.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs.
Optional actions: refresh provider global/project adapters if they should include the Computer Use priority selection rule.
Verification: source/dist/installed VERSION = 2.0.9 after runtime sync; verify-runtime result should be PASS after installed runtime sync.
Rollback / non-goals: no migrations/2.0.9.md is required; this release changes UI verification guidance and templates, not project artifact schema or write-through commands.
```

## Historical Summary

Older entries are summarized to keep the installed runtime lightweight. Schema
migration details remain in `migrations/`; decision rationale remains in
source-only `docs/decisions/`.

| Version | Date | Summary | Project impact |
|---|---|---|---|
| 2.0.8 | 2026-06-02 | Added read-only source checkout project graph status/doctor tooling and standardized active index tables. | No schema migration; registered boards can stamp-only upgrade. |
| 2.0.7 | 2026-05-27 | Added Forced Provider Gate for L3, high-risk ship/security gates, behavior-sensitive L2, repeated failures, and cross-boundary plans. | No schema migration. |
| 2.0.6 | 2026-05-25 | Added frontend/UI self-verification surfaces and evidence requirements. | No schema migration; adapter refresh optional. |
| 2.0.5 | 2026-05-24 | Strengthened Progress Handoff Contract for L1/L2/L3 checkpoints and final response. | No schema migration. |
| 2.0.4 | 2026-05-22 | Prepared public source distribution, provider-neutral adapter guidance, aliases, and open-source metadata. | No schema migration. |
| 2.0.3 | 2026-05-21 | Added `scripts/verify-runtime.mjs` for source/dist/installed/runtime invariant checks. | No schema migration. |
| 2.0.2 | 2026-05-21 | Added active state handoff after meaningful L1/L2/L3 steps. | No schema migration. |
| 2.0.1 | 2026-05-21 | Clarified read-only command wording, registry discovery semantics, and test matrix links. | No schema migration. |
| 2.0.0 | 2026-05-16 | Added lifecycle role orchestration and role stance reporting. | No schema migration; new plans/reviews can name role stance. |
| 1.7.0 | 2026-05-16 | Added contract-first gates, boundary tests, semantic checks, and risk ledgers. | No schema migration; new behavior-sensitive work should use the new sections. |
| 1.6.0 | 2026-05-16 | Added `catpaw:provider`, provider modes, CLI playbooks, dialogue state, and provider-dialogue template. | No schema migration; provider-dialogue is optional research. |
| 1.5.0 | 2026-05-15 | Split source checkout from runtime package source and added `build-runtime`. | Installed runtime layout unchanged. |
| 1.4.2 | 2026-05-15 | Clarified runtime stamp semantics for runtime-only project upgrades. | Stamp-only upgrade. |
| 1.4.1 | 2026-05-15 | Clarified req path stability and terminal state semantics. | No schema migration. |
| 1.4.0 | 2026-05-15 | Made `upgrade-runtime` registry-aware and formalized runtime-only upgrade semantics. | No schema migration. |
| 1.3.1 | 2026-05-15 | Made workflow routing user-visible. | No schema migration. |
| 1.3.0 | 2026-05-14 | Added global per-machine project registry and registry commands. | Additive registry/frontmatter upgrade. |
| 1.2.0 | 2026-05-14 | Added release discipline, project upgrade pipeline, runtime stamps, and migration registry. | Additive frontmatter/index stamp upgrade. |
| 1.1.0 | 2026-05-14 | Added status, doctor, reconcile, closeout transactions, and graph frontmatter. | Additive frontmatter for plan/review/test matrix. |
| 1.0.0 | 2026-05-07 | Established provider-neutral global runtime, manifest, install/upgrade/init/migrate commands, and project artifact storage. | Initial runtime baseline. |
