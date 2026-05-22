# Changelog

## 2.0.3 - 2026-05-21

- Add `scripts/verify-runtime.mjs` to check source, dist, installed runtime, key protocol invariants, and registered board stamps.
- Extend release verification guidance to run `verify-runtime` after build and installed runtime sync.
- Refresh the runtime README current version marker.

Migration note (2.0.2 -> 2.0.3):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so installed README and release guidance match 2.0.3.
Project impact: no required project artifact schema migration; registered boards can receive a stamp-only upgrade.
Required actions: build runtime, sync ~/.catpaw, run node scripts/verify-runtime.mjs.
Optional actions: use verify-runtime before future commits/releases to catch source/dist/installed drift.
Verification: source/dist/installed VERSION = 2.0.3; verify-runtime result is PASS.
Rollback / non-goals: no migrations/2.0.3.md is required; this release adds source-repo verification tooling and runtime docs, not project artifact schema.
```

## 2.0.2 - 2026-05-21

- Add the Progress Handoff Contract to require active state handoff after meaningful L1/L2/L3 steps.
- Require handoff reports to include completed work, updated artifacts, verification state, next action, and pending user decisions.
- Clarify that agents should update relevant plan step/status, verification notes, or risk ledger before reporting handoff when a CatPaw plan exists.
- Extend `status` and `close` command output guidance so users do not have to ask "what is next?" after a step or closeout.

Migration note (2.0.1 -> 2.0.2):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read the Progress Handoff Contract.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Active plans may receive more timely checkbox/status, verification, and risk-ledger updates during ongoing work.
Required actions: upgrade the installed runtime to 2.0.2.
Optional actions: for active multi-step work, adopt the compact Completed / Updated artifacts / Verification / Next / Needs user decision handoff shape.
Verification: ~/.catpaw/VERSION = 2.0.2; runtime-policy.md contains Progress Handoff Contract.
Rollback / non-goals: no migrations/2.0.2.md is required; this release changes agent reporting discipline, not artifact schema.
```

## 2.0.1 - 2026-05-21

- Clarify that `catpaw:status` and `catpaw:doctor` are project-artifact read-only commands while still allowing registry `lastSeen` metadata updates for registered boards.
- Make `catpaw:registry-doctor --discover` report-only in every mode; discovered boards are registered only through `catpaw:upgrade-project --apply` or `catpaw:init-project`.
- Fix the canonical test matrix path references in `specs/03-project-directory.md`.
- Fix `templates/test-matrix.md` relative links from `tests/matrices/` to req and plan files.
- Refresh stale install and project-directory wording around installed runtime stamps.

Migration note (2.0.0 -> 2.0.1):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read the clarified command semantics and fixed test matrix template links.
Project impact: no required project artifact schema migration; existing artifacts remain valid. Future generated test matrices should use the corrected ../../ links from tests/matrices/.
Required actions: upgrade the installed runtime to 2.0.1.
Optional actions: for any existing test matrix created from the old template under .catpaw/tests/matrices/, inspect Req/Plan links and adjust ../ to ../../ if broken.
Verification: ~/.catpaw/VERSION = 2.0.1; catpaw:registry-doctor says discover never auto-registers; templates/test-matrix.md links to ../../reqs and ../../plans.
Rollback / non-goals: no migrations/2.0.1.md is required; this release fixes runtime guidance and future template output, not project artifact schema.
```

## 2.0.0 - 2026-05-16

- Add lifecycle role orchestration so Expert Council roles are selected by active stage, workflow level, and risk trigger.
- Extend `runtime-policy`, workflow/subsystem specs, `classify`, `plan`, `review`, and operating rules with explicit role stance reporting.
- Add `Notes.Roles` to the plan template for compact L2 role stance.
- Expand the role spec from a light gear-shift table into stage routing, level rules, provider selection, reporting rules, and safety rules.
- Document ADR-0013 for stage-aware Expert Council routing.

Migration note (1.7.0 -> 2.0.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read lifecycle role orchestration.
Project impact: no required project artifact schema migration; existing reqs/plans/reviews/tests remain valid. New L2/L3 plans and reviews should name role stance when Expert Council participation matters.
Required actions: upgrade the installed runtime to 2.0.0.
Optional actions: for active L2/L3 work, add a compact role stance to plan Notes.Review or Council if the work crosses Think/Plan/Review/Test/Ship risks.
Verification: ~/.catpaw/VERSION = 2.0.0; catpaw:classify dispatch includes Roles; specs/09-roles.md contains Lifecycle Role Orchestration.
Rollback / non-goals: no migrations/2.0.0.md is required; this release changes orchestration guidance and reporting expectations, not artifact paths or frontmatter. The major version marks a protocol baseline, not a breaking project artifact schema.
```

## 1.7.0 - 2026-05-16

- Add contract-first quality gates for behavior-sensitive L2/L3 work.
- Extend plan, review, and test matrix templates with contracts/invariants, boundary tests, semantic checks, and risk ledgers.
- Tighten Engineering Reviewer, QA Strategist, and Performance Reviewer guidance around semantic equivalence, fast paths, caches, query behavior, and implementation branch boundaries.
- Document ADR-0012 for the contract-first gate decision.

Migration note (1.6.0 -> 1.7.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read the new contract-first gates.
Project impact: no required project artifact schema migration; existing reqs/plans/reviews/tests remain valid. New or materially updated L2/L3 behavior-sensitive plans should fill the new contract, boundary-test, and risk-ledger sections.
Required actions: upgrade the installed runtime to 1.7.0.
Optional actions: for active L2/L3 work touching search/query/ranking, cache, pagination, async lifecycle, serialization, DB migrations, or performance fast paths, add contract/invariant and boundary-test entries before continuing.
Verification: ~/.catpaw/VERSION = 1.7.0; new templates include Contracts / Invariants, Boundary Cases, Semantic Checks, and Risk Ledger sections.
Rollback / non-goals: no migrations/1.7.0.md is required; this release changes process expectations and future artifact templates, not existing artifact frontmatter or paths.
```

## 1.6.0 - 2026-05-16

- Add `catpaw:provider` for CLI/native-subagent provider orchestration beyond review.
- Define provider modes: `ask`, `discuss`, `debug`, `review`, `implement`, and `summarize`.
- Add default CLI playbook entries for Claude Code (`cc`), Codex (`cx`), and Gemini.
- Add CatPaw-mediated multi-round dialogue state so provider-native resume/session memory is optional, not required.
- Add `templates/provider-dialogue.md` for durable architecture, debugging, or research dialogues.
- Add ADR-0011 for the provider dialogue design.

Migration note (1.5.0 -> 1.6.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents can load commands/provider.md.
Project impact: no required project artifact schema delta; provider-dialogue notes are optional research artifacts.
Required actions: upgrade the installed runtime to 1.6.0 before relying on catpaw:provider.
Optional actions: use .catpaw/research/<topic>/provider-dialogue.md for durable multi-round provider discussions.
Verification: ~/.catpaw/commands/provider.md exists; runtime-manifest.json commands includes provider.
Rollback / non-goals: no migrations/1.6.0.md is required; this does not authorize providers to commit, push, create PRs, deploy, or perform destructive operations.
```

## 1.5.0 - 2026-05-15

- Split the source checkout from the runtime package root: authored runtime files now live under `src/runtime/`.
- Add `scripts/build-runtime.mjs` to generate and verify `dist/runtime/` from `src/runtime/runtime-manifest.json`.
- Keep the installed runtime shape unchanged at `~/.catpaw/`; install and upgrade now resolve a runtime package root before copying.
- Add root bootstrap `README.md` and `AI-INSTALL.md` for source-checkout workflows.

Migration note (1.4.2 -> 1.5.0):

```text
Runtime upgrade: when installing or upgrading from a source checkout, run node scripts/build-runtime.mjs first and copy from dist/runtime/. If the input path already contains runtime-manifest.json, copy from that package root directly.
Project impact: no project artifact schema delta; existing project boards can be stamp-only upgraded to runtime 1.5.0.
Required actions: use root AI-INSTALL.md for source checkouts, or src/runtime/AI-INSTALL.md from a resolved package root.
Optional actions: none.
Verification: dist/runtime/VERSION = 1.5.0; dist/runtime/runtime-manifest.json exists; command files declared in manifest exist under dist/runtime/commands/.
Rollback / non-goals: no migrations/1.5.0.md is required; installed runtime layout under ~/.catpaw/ is unchanged.
```

## 1.4.2 - 2026-05-15

- Clarify that the project board `runtime:` stamp tracks the latest installed runtime that has processed the board, including runtime-only releases.
- Restore `upgrade-project` target semantics to the installed runtime version while still replaying only existing `migrations/<version>.md` files in the version range.
- Define runtime-only project upgrades as stamp-only updates: no schema patch is required, but `.catpaw/index.md` and the registry stamp still advance to the installed runtime.
- Add ADR-0009 to supersede the temporary "project artifact target only" interpretation.

Migration note (1.4.1 → 1.4.2):

```text
Runtime upgrade: run catpaw:upgrade-runtime once.
Project impact: stamp-only upgrade for projects already schema-current; no project artifact schema delta.
Required actions: run catpaw:upgrade-runtime --apply-projects to advance all unblocked registered boards to runtime 1.4.2.
Optional actions: inspect blocked boards individually with catpaw:upgrade-project --dry-run.
Verification: ~/.catpaw/VERSION = 1.4.2; every registered board's .catpaw/index.md frontmatter and registry entry stamp are 1.4.2.
Rollback / non-goals: no migrations/1.4.2.md is required; no req/plan/review/test schema rewrite is implied.
```

## 1.4.1 - 2026-05-15

- Clarify req path stability: req files stay directly under `.catpaw/reqs/` for their full lifecycle because req IDs are artifact graph roots.
- Document that req terminal state is represented by frontmatter (`status`, `closed`), not by `reqs/done/` or archive directories.
- Clarify `reviews/archive/` as explicitly archived standalone/historical review material, not the default terminal state for req-bound review summaries.
- Add ADR-0008 for the design rationale.

Migration note (1.4.0 → 1.4.1):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read the clarified path semantics.
Project impact: none; no project artifact schema delta.
Required actions: upgrade the installed runtime to 1.4.1.
Optional actions: none.
Verification: ~/.catpaw/VERSION = 1.4.1; project artifact target remains the latest migration version (currently 1.3.0).
Rollback / non-goals: no migrations/1.4.1.md is required; do not reorganize existing req files.
```

## 1.4.0 - 2026-05-15

- Make `catpaw:upgrade-runtime` the registry-aware upgrade entrypoint: after syncing `~/.catpaw/`, it reads `~/.catpaw/state/projects.json` and runs a project-board upgrade survey.
- Add `upgrade-runtime --apply-projects` semantics for applying only unblocked project-board upgrades; blocked or ambiguous boards are reported for user decision.
- Add `upgrade-runtime --runtime-only` semantics for skipping project-board orchestration.
- Define the project artifact target version as the newest `migrations/<version>.md` version not newer than the installed runtime. Runtime-only releases no longer make project boards stale.
- Update `upgrade-project`, `registry-doctor`, `init-project`, and `migrate-project` wording to use the project artifact target version instead of blindly stamping every installed runtime version.

Migration note (1.3.1 → 1.4.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once. It syncs ~/.catpaw/ and then reports all registered project boards from ~/.catpaw/state/projects.json.
Project impact: no project artifact schema delta in 1.4.0; existing boards at project target 1.3.0 remain current.
Required actions: upgrade the installed runtime to 1.4.0 and review the project-board summary.
Optional actions: use catpaw:upgrade-runtime --apply-projects when a future release has unblocked project-board migrations.
Verification: ~/.catpaw/VERSION = 1.4.0; project target version is the latest migration version, currently 1.3.0 unless a newer migrations/<version>.md exists.
Rollback / non-goals: no migrations/1.4.0.md is required; this changes upgrade orchestration and stale-stamp semantics, not project artifact schema.
```

## 1.3.1 - 2026-05-15

- Make CatPaw workflow routing user-visible: agents must state the selected `L0` / `L1` / `L2` / `L3` level, reason, artifact expectation, and verification level when CatPaw applies to a task.
- Require explicit user-facing notice when a task escalates or de-escalates between workflow levels.
- Update `catpaw:classify`, Status Sync, and workflow specs so level selection is no longer hidden internal reasoning.

Migration note (1.3.0 → 1.3.1):

```text
Runtime upgrade: run catpaw:upgrade-runtime once so agents read the new visible-dispatch policy.
Project impact: none; project .catpaw artifacts and schema do not change.
Required actions: upgrade the installed runtime to 1.3.1.
Optional actions: refresh embedded provider adapter snippets only if a provider file copied old CatPaw text instead of referencing ~/.catpaw/runtime-policy.md.
Verification: ~/.catpaw/VERSION = 1.3.1; CatPaw-routed tasks begin with a concise dispatch note such as "CatPaw dispatch: L2 ...".
Rollback / non-goals: no project migrations; this changes agent reporting behavior only.
```

## 1.3.0 - 2026-05-14

- Add global per-machine project registry at `~/.catpaw/state/projects.json` for board discovery and batch operations.
- Add `unregister-project` command to remove a board entry without touching board files.
- Add `registry-doctor` command for read-only registry health checks (`--dry-run` / `--apply` / `--discover`).
- `init-project`, `migrate-project`, and `upgrade-project --apply` now upsert the board into the registry.
- `status`, `doctor`, `reconcile`, and `close` opportunistically refresh `lastSeenAt` when the board is already registered.
- Tighten `migrations/1.2.0.md` wording: index `runtime:` stamp value is always the upgrade *target*, never the migration's own version.
- `~/.catpaw/state/` is per-machine local state: not in `runtime-manifest.canonicalFiles`, never copied into source repo, never touched by `upgrade-runtime` or `release-runtime`.

Migration note (1.0.x → 1.3.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once.
Project impact: additive only (frontmatter + index stamp + registry entry).
Required actions: run catpaw:upgrade-project --dry-run, then --apply per board. One pass replays 1.1.0 + 1.2.0 + 1.3.0.
Optional actions: run catpaw:registry-doctor --discover to find unregistered boards on disk.
Verification: ~/.catpaw/VERSION = 1.3.0; .catpaw/index.md frontmatter `runtime: 1.3.0`; entry exists in ~/.catpaw/state/projects.json.
Rollback / non-goals: no breaking changes; registry is per-machine local state.
```

## 1.2.0 - 2026-05-14

- Add release discipline for CatPaw source changes through `release-runtime`.
- Add existing project artifact upgrade guidance through `upgrade-project`.
- Define when runtime changes require migration notes.
- Formalize the source repo → installed runtime → project artifact upgrade pipeline.
- Introduce per-project `runtime: x.y.z` stamp written to `.catpaw/index.md` frontmatter by `init-project`, `migrate-project`, and `upgrade-project --apply`.
- Introduce `migrations/<version>.md` schema delta registry so `upgrade-project` can replay any version range in one shot.
- Backfill migration entries for 1.1.0 (plan/review/test-matrix frontmatter) and 1.2.0 (stamp introduction); existing 1.0.x project boards upgrade in a single `upgrade-project --apply` pass.

Migration note (1.0.x → 1.2.0):

```text
Runtime upgrade: run catpaw:upgrade-runtime once.
Project impact: additive only (new optional frontmatter + index stamp).
Required actions: run catpaw:upgrade-project --dry-run, then --apply per project.
Optional actions: none.
Verification: ~/.catpaw/VERSION = 1.2.0; .catpaw/index.md frontmatter `runtime: 1.2.0`; plan/review/test-matrix files have graph frontmatter.
Rollback / non-goals: no breaking changes; old artifacts without frontmatter continue to load.
```

## 1.1.0 - 2026-05-14

- Add Status Sync and Artifact Integrity semantics for CatPaw project artifacts.
- Add `status`, `doctor`, and `reconcile` command drafts.
- Upgrade `close` semantics to scoped `--dry-run` / `--apply` closeout transactions.
- Define req-rooted artifact graph checks across reqs, plans, research, tests, reviews, lessons, and docs.
- Add lightweight frontmatter to plan, review summary, and test matrix templates for graph reconciliation.
- Clarify that doctor/reconcile/close never authorize commit, push, PR, deploy, destructive cleanup, or fabricated verification evidence.

## 1.0.0 - 2026-05-07

- Establish CatPaw as a provider-neutral global runtime installed at `~/.catpaw`.
- Add runtime versioning with `VERSION` and `runtime-manifest.json`.
- Add AI-facing install, upgrade, project initialization, and legacy migration guidance.
- Include explicit command semantics for project init, project migration, runtime upgrade, workflow classification, planning, review, and closeout.
- Define project `.catpaw/` as artifact storage only; runtime specs, commands, roles, and templates stay global.
- Keep req files in `.catpaw/reqs/` for their lifecycle and track terminal state through YAML frontmatter.
