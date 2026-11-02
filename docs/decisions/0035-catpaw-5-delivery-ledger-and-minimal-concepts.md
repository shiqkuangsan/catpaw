# ADR-0035: CatPaw 5 Delivery Ledger And Minimal Concepts

Status: Accepted

Date: 2026-11-02

## Context

A read-only audit of seven active boards (about 460 Work, 1170 Evidence records)
and local Codex/Claude Code transcripts showed where CatPaw actually helps:

- Honest delivery receipts: development, production and excluded scope stated
  separately, with exact authorization limits.
- Retained failures: only 9 of about 1170 Evidence records are failed/blocked,
  but each marks a moment where a false "done" was avoided (held release,
  retained 0/24 failure, archived-repository block).
- Handoff on long Work: a few Work items carry real takeover history.

Most structure did not earn its cost:

| Observation | Data |
|---|---|
| Work closed the day it started | 180/224, 67/107, 18/23 on the three largest boards |
| Long Work degrades into journals | 12 Work over 8 KB on one board, max 50 KB, with superseded sections |
| Evidence `origin: captured` | 8 vs about 260 asserted; `evidence run` used about 6 times |
| Empty Limits template | 44/44, 47/51, 211/343 on three boards |
| CLI usage | `work update`, `evidence add`, `work show` dominate; milestone, plan, transport, runtime and migrate commands are effectively unused |
| Completion refusals | about 9 sessions; samples show Agents reading runtime source to debug candidate hashing |
| Multi-repository Work | candidate fingerprints cannot cover sibling repositories; Agents write manual SHA manifests |

The runtime exposes about 60 named concepts across schema, guidance and CLI:
seven stages, three modes, five Evidence types, five lenses, three intents,
nine delegation fields, several Git grant kinds, Proof/Approval aliases, four
runtime surfaces and more. ADR-0026 through ADR-0034 repeatedly renamed and
consolidated them without removing them. Most were introduced by Agents to
describe their own process; they rarely change a next action. The observed
value comes mainly from a few behavioral rules, not from the vocabulary.

## Decision

CatPaw 5 is a **delivery ledger for coding agents**: local files that make a
"done" claim checkable and resumable. It is not a task tracker, method library,
orchestrator or permission system.

### Concepts

Four nouns. Nothing else is public or stored.

| Concept | Meaning |
|---|---|
| **Work** | One delivery: goal, acceptance, repositories in scope, decisions, Next, and status `open`, `blocked`, `done` or `dropped`. `risk: high` is an optional flag. |
| **Check** | A dated result against acceptance: `passed`, `failed`, `blocked` or `not-run`; `self` or `independent`; the snapshot it ran on; where raw output lives. |
| **Gap** | Something acceptance needs that is not verified. Either `open` or `accepted` by the user, with the reason. |
| **Note** | Any other dated log entry: decision, finding, handoff. |

Snapshot is an attribute of Check, not a concept: for each repository in scope,
`HEAD` commit plus a hash of the uncommitted diff. It covers sibling
repositories and worktrees directly.

### Rules

1. Records, checks and tool output never grant permission. Permission belongs
   to the user, project and host rules.
2. Checks and Notes are append-only. A later failure is never hidden by an
   earlier pass; a pass is current only on the current snapshot.
3. `done` requires no `open` Gap. Accepting a Gap keeps it visible and never
   turns it into a passed Check.
4. `risk: high` Work additionally needs the latest `self` and the latest
   `independent` Check on the current snapshot to be passed.
5. One writer per mutable scope; an independent checker is not the implementer.

### Storage

```text
.catpaw/
  work/<ID>/WORK.md   current state, rewritten on update, kept short
  work/<ID>/LOG.md    append-only Checks and Notes
```

`WORK.md` frontmatter: `id`, `title`, `status`, `risk`, `repos`, `parent`,
`created`, `updated`. Sections: Goal, Acceptance, Gaps, Decisions, Next. Status
output is generated; no hand-maintained dashboard. The CLI code owns the format;
there is no separate schema file.

Record writes apply immediately. Only `convert` previews by default, because it
replaces the board; dry-run on every append doubled Agent calls in practice.

### Enforcement

- A SessionStart hook injects open Work, Gaps and Next, so resumption no longer
  depends on the Agent remembering to read the board.
- `catpaw gate` exits non-zero when Work in scope violates rules 2–4. It is
  meant for pre-push hooks and CI, turning the completion rule from guidance
  into a mechanical check.

### Removed concepts

| Removed | Replacement |
|---|---|
| Plan, Milestone | Acceptance and Next inside Work; optional `parent` link |
| Evidence, Proof; types research/review/test/provider/reflection; topic Evidence | Check or Note; topic research moves to project docs |
| Approval, permission boundaries, three-way decision split | Rule 1 and rule 3 |
| Understand/Execute/Check/Finish phases; seven stages | Status plus Next |
| modes direct/tracked/gated; Work types feature/bug/chore | `risk: high` flag |
| contract, cycle, sequence, origin, claim coverage, completion scope, verification path | Snapshot binding and Gaps |
| intents explore/build/check, delegation fields, integration owner, Git grants, opted-in build agent | Rule 5; host and user rules own delegation and Git |
| lenses, engineering methods | Optional separate skill, not part of CatPaw |
| transports, providers, cc/cx | Removed; second opinions use host subagents or the user's own tools |
| source/dist/installed surfaces, activation, adapter merge, registry, preimage, recovery journal | Versioned package distribution; atomic writes stay internal |

### Distribution And Compatibility

- Ship as a versioned npm package invoked with `npx`, plus a thin host snippet
  and hooks. Remove runtime install, activation, recovery, adapter merge and
  the project registry.
- Schema 3 is a hard switch. A one-shot converter maps each schema 2 board,
  previewed first and applied per project with separate authorization; the
  original board is archived unchanged. No dual-read path. Schema 1 migration
  is frozen and removed from the package.
- The policy shrinks to one file of roughly 150 lines.

## Consequences

The public model drops from about 60 terms to four nouns and five rules. The CLI
target is about 3–4k lines instead of about 13.6k. Advice formerly carried by
methods, lenses and delegation guidance is no longer CatPaw's responsibility;
users who want it install a separate skill.

Risks:

- Compressing guidance may weaken Agent behavior that produced honest receipts.
  Validate by running real deliveries on two heavy boards with CatPaw 5 and
  comparing failure retention and Gap disclosure against the audit baseline.
- The converter must preserve every existing failed/blocked result and handoff
  section; lossy mapping of Limits and stages is acceptable.
- Hooks differ across hosts; Claude Code and Codex are first targets. Without
  hooks, CatPaw still works but resumption and gating fall back to guidance.

Not in scope: task planning, team sync, automatic orchestration, authentication
of checker identity, semantic judgment of acceptance.

## References

- [ADR-0032](0032-work-centered-runtime-and-verifiable-operations.md)
- [ADR-0033](0033-permission-boundaries-without-a-public-authorization-concept.md)
- [ADR-0034](0034-agent-owned-judgment-and-lightweight-continuity.md)
- [Board schema 2](../../src/runtime/schemas/board-v2.json)
