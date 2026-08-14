# ADR-0024: Bounded Builder Slice Commits

Status: Accepted; commit cadence amended by ADR-0025, and Builder/authority vocabulary by ADR-0026

Date: 2026-08-13

## Current Interpretation

Under ADR-0026, `Builder` below now means an Agent acting under the `build`
intent, not a persona or user-facing Role. The bounded local-commit exception
remains an internal exact grant and cannot create Approval. One accountable
writer owns a mutable surface at a time; the primary agent still owns candidate
acceptance and final adoption, while `explore` and `check` actors cannot receive
the build commit exception.

## Context

ADR-0022 delegated recoverable local Git only to the Primary integration owner,
and ADR-0023 required Builder subagents to hand off uncommitted changes. That
was a useful conservative default, but stronger current-tool models can now own
a sharply bounded implementation slice without making Primary perform every
mechanical stage/commit step.

Giving every subagent general Git authority would still be unsafe. Several
Builders can run concurrently, Git staging is repository-wide within one
worktree, a commit can silently include unrelated files, and a local commit is
not the same decision as adopting or integrating that commit.

## Decision

### Separate slice commit ownership from integration ownership

There remains exactly one Primary integration owner. Primary owns dispatch,
final adoption, conflict resolution, final verification, integration, and every
protected/base or external action.

A current-tool Builder may become the owner of one local slice commit, but only
when Primary explicitly opts in through a complete Task Envelope. The Builder
does not become an integration owner, and its commit is only a handoff candidate.

### Require an exact opt-in and isolated Git surface

The exception is available only for an already-authorized change/build task
and only when all of these conditions hold:

- Primary created and validated a dedicated non-protected slice branch in an
  exclusive isolated worktree before dispatch;
- the Envelope states `slice commit: allowed` and records absolute worktree,
  exact branch, exact base commit, exact write scope, verification, and stop
  conditions; omission means forbidden;
- the worktree baseline is clean and contains no user or other-Agent changes;
- the Builder stages only the declared scope, reviews the exact staged diff,
  runs relevant verification and a credential/secret scan, and creates at most
  one local commit;
- the handoff reports base/head/commit hashes, committed paths, verification,
  scan result, and clean worktree status.

Capability name, Agent output, prior sessions, Evidence, available tools, and
generic prompt wording do not opt in or expand this authority.

### Keep integration and risky Git with Primary

The Builder cannot push, create or modify a PR, merge, cherry-pick, amend,
rebase, reset/clean, force, create/switch/delete branches or worktrees, access
secrets, or update a protected/base branch. It also cannot fetch/pull, stash,
tag, or perform any Git mutation or remote Git operation beyond the exact stage
and one commit grant. Baseline drift, overlap, unexpected files, conflicts, or
failed verification stop the Builder.

Primary independently audits the commit against its recorded base and Task
Envelope. Primary may reject it, retain it for more review, or adopt it through
a verified fast-forward/cherry-pick onto a non-protected integration branch.
Conflicts return to Primary; the Builder is not allowed to enlarge its slice.
Any protected/base update or integration remains explicitly authorized.

### Exclude independent and external Agents

Scout, Reviewer, Verifier, and any subagent without exact opt-in cannot stage or
commit. A Builder cannot satisfy the required independent review of its own
slice. Reciprocal `cc`/`cx` profiles remain read-only and do not receive the
exception; external Builder remains unavailable.

## Amendments By ADR-0025 And ADR-0026

The one-commit cadence and Primary-owned adoption language above are retained as
decision history. The current contract permits an opted-in `build` Agent to
create a primary-agent-chosen bounded local commit series inside one unchanged
exact Git grant. A delegated integration owner receives no Git authority from
the ownership token: candidate or reconciliation commits require the build
grant, while clean inbound adoption requires a separate exact integration grant
bound to target, base, commit list, allowed operation, and verification. The
primary agent still owns final adoption; protected/base and external actions
remain explicit Approval gates.

## Consequences

- Strong current-tool Builders can hand off an auditable commit instead of an
  ambiguous dirty worktree.
- Parallel Builders remain separated by branch, worktree, and exact write
  scope, while final integration remains serial and Primary-owned.
- The additional preconditions and handoff fields cost more than an inline
  edit, so Primary should opt in only when the slice is large enough to justify
  the isolation and audit overhead.
- Board schema remains 2 and no new artifact or invocation ledger is added.
- Runtime activation, adapter refresh, commits of this source change, push, PR,
  deploy, and project mutation remain separate actions under their own gates.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Agent Dispatch](../../src/runtime/guidance/agent-dispatch.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [Independent Checks](../../src/runtime/guidance/independent-checks.md)
- [Agent transports](../../src/runtime/providers/README.md)
- [ADR-0022](0022-tiered-local-git-authority-and-engineering-methods.md)
- [ADR-0023](0023-task-envelopes-and-risk-based-agent-dispatch.md)
- [ADR-0025](0025-executor-owned-advisory-orchestration.md)
- [ADR-0026](0026-user-facing-concept-consolidation.md)
