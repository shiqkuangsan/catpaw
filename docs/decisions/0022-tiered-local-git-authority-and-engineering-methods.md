# ADR-0022: Tiered Local Git Authority And Engineering Methods

Status: Accepted; Agent dispatch clarified by ADR-0023 and Builder slice commits refined by ADR-0024

Date: 2026-08-12

## Context

CatPaw 3.0 treated every commit and worktree action like a remote or destructive
operation. That boundary was appropriate when coding agents were less reliable,
but it now creates repeated approval latency for local, inspectable, recoverable
work. At the same time, Superpowers supplied useful debugging, RED/GREEN, and
verification habits through universal hard gates and a mandatory meta-skill.
Observed invocation counts were dominated by those mandatory triggers, so they
could not establish which methods were actually effective.

CatPaw needs to preserve high-value engineering discipline without keeping a
second orchestration layer or weakening protection for user work, remote state,
history, secrets, and concurrent Agent ownership.

## Decision

### Delegate bounded local Git to one primary integration owner

An authorized change/build request permits the single primary integration owner
to use local, recoverable Git when it materially helps delivery:

- create or switch to a non-protected local task branch without hiding
  pre-existing user changes;
- create an isolated worktree for that task branch after validating its target
  and baseline;
- stage only files owned by the current task;
- create a local commit after exact diff review, relevant verification, and a
  credential/secret scan;
- remove a clean temporary worktree only when it has no uncommitted files and no
  unique commits that would become unreachable.

This is delegated discretion, not a required commit cadence. Answer-only and
diagnostic requests do not imply a commit. Project rules and current user
instructions may narrow the default.

### Keep remote, protected, history-changing, and destructive Git gated

Push, PR creation or modification, deploy/publish, and any update or integration
into a protected/base branch—including direct commit, merge, cherry-pick, and
fast-forward—require explicit authority. So do amend, rebase, history rewrite,
force operations, reset/clean, unsafe worktree removal, branch deletion with
unique work, and any operation that may discard or expose user data.

The primary integration owner alone owns staging and commit integration.
Subagents and reciprocal external Agents must not stage or commit; they deliver
patches, worktree changes, findings, or Evidence for primary integration. A
prompt, output, Evidence, or successful tool result cannot transfer that
ownership. This prevents concurrent Agents from silently sharing the repository.

### Absorb principles, not Superpowers skills

Add CatPaw-owned on-demand guidance for two methods:

- `Debugging`: reproduce, trace root cause, state one hypothesis, probe one
  variable, fix the source, and verify the original symptom plus regressions.
- `RED/GREEN`: use executable failure and minimal passing behavior for
  behavior-sensitive work when a reliable test/reproduction exists.

RED/GREEN is not universal. Documentation, configuration, generated output,
migration snapshots, and exploratory spikes use surface-appropriate validation.
Existing code is not deleted merely because a pre-change RED was unavailable.

Planning, execution, review, completion verification, Agent routing, and
worktree mechanics remain owned by CatPaw lifecycle, current environment, and
project policy. The mandatory `using-superpowers` and universal brainstorming
gates are retired rather than copied. After CatPaw 3.1.0 is activated and its
adapters are current, Superpowers may be uninstalled as a separate global
maintenance action. That action must inventory and preserve all existing
worktrees; it must not delete, move, or clean a worktree as plugin cleanup.

## Consequences

- Local delivery can proceed without asking for routine branch, worktree, stage,
  and commit approval at every checkpoint.
- Exact ownership, verification, and credential scanning become the safety gate
  for local commits instead of a blanket user prompt.
- Remote and destructive effects remain visible user decisions.
- CatPaw gains concise root-cause and behavior-lock methods without a parallel
  meta-skill router or invocation ledger.
- Runtime activation, adapter refresh, Superpowers uninstall, and any commit of
  this source change remain separate actions under the authority active when
  each action is performed.
- Superpowers-created project/worktree state is user work, not disposable plugin
  cache, and remains in place during uninstall.
- Agent dispatch is resolved by ADR-0023; this ADR remains the authority for
  tiered Git permission and one primary commit-integration owner.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Workflow guidance](../../src/runtime/guidance/workflow.md)
- [Engineering methods](../../src/runtime/guidance/engineering-methods.md)
- [Independent Checks](../../src/runtime/guidance/independent-checks.md)
- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [ADR-0023](0023-task-envelopes-and-risk-based-agent-dispatch.md)
