# Runtime Policy

CatPaw carries coding Work forward, supports completion claims with inspectable
Proof, and asks for Approval only when authority or accepted risk must come from
the user.

```text
Work      what outcome is being delivered, what is current, and what is next
Proof     what was checked, what the facts show, and what remains uncertain
Approval  the exact user decision needed for new authority or accepted risk
```

These are parallel concerns, not mandatory sequential stages. Most Work needs
no new Approval after the user authorizes the task.

## Activation And Priority

Apply this policy when a project has `.catpaw/` or legacy `todos/`, or the user
mentions CatPaw, Work, Proof, Approval, Milestone, Evidence, migration, or
tracked review/plan work.

```text
current user instruction
> project-local rules
> installed CatPaw runtime
> optional methods and tool defaults
```

Normal projects trust the installed runtime at `~/.catpaw/`. Source, installed
runtime, and project state are separate surfaces; editing this source repository
does not install, activate, or migrate anything. `catpaw` abbreviates
`~/.catpaw/bin/catpaw.mjs` when installed and `src/runtime/bin/catpaw.mjs` in a
source checkout. CatPaw does not modify `PATH`.

## Work Routing

For each request, the primary agent determines:

1. the user outcome, constraints, non-goals, and Approval already granted;
2. whether a project board or active Work exists and whether migration is needed;
3. whether the Work stays conversational, needs durable continuity, or is high risk;
4. what must be understood, executed, checked, and reported;
5. whether Agent help adds useful independent facts or isolated execution;
6. the Proof needed for a credible completion claim;
7. the current action and `Next`.

Public progress is:

```text
Understand -> Execute -> Check -> Finish
```

The runtime maps this to schema 2 lifecycle and risk metadata internally. Small,
local, reversible Work stays lightweight. Durable Work creates a Work record and
Plan. Security, release, migration, external, destructive, data-integrity, or
high-impact contract Work is high risk and requires independent Proof. Details
are owned by [Work Handling](guidance/workflow.md).

## Project Memory

Global runtime, local project memory:

- runtime: `~/.catpaw/`;
- board: `<project>/.catpaw/`;
- Work is stored as schema 2 Work Item plus its internal Plan;
- Proof facts are stored as typed schema 2 Evidence;
- Milestone optionally groups several Work items around a phase outcome;
- Approval is a user authority boundary, not a board artifact;
- migration may preserve a graph-external `legacy/schema-1/` archive.

The machine contract remains [board-v2.json](schemas/board-v2.json). The CLI owns
path safety, graph validation, dry-run patches, staged writes, and doctor checks.
Preferred public commands use `proof add` and `work start --high-risk`; existing
`evidence add` and `--mode` inputs remain compatible storage vocabulary.

## Agent Collaboration

CatPaw exposes three bounded task intents: `explore`, `build`, and `check`. The
primary agent chooses Agents, models, transports, intent composition, count,
order or parallelism, fallback, accountable writers, and final candidate
acceptance. CatPaw does not generate a mandatory team graph.

Every substantive delegation binds the outcome, known facts, exact read/write
surface, constraints, expected output, verification, dependencies, stop
conditions, and allowed actions. These fields are an internal execution
contract, not a user concept and never a source of new Approval.

Different Agents must not concurrently write one mutable surface. Each mutable
surface has one accountable writer at a time. Agents may produce competing
candidates for the same logical scope only on isolated worktrees or equivalent
state surfaces. See [Agent Collaboration](guidance/agent-dispatch.md).

CatPaw-managed reciprocal external transports are `cc` and `cx`; they are
read-only second-opinion surfaces, not the primary agent's complete roster. See
[Agent Transports](providers/README.md).

## Proof

Proof is an inspectable fact, not a file count or confidence claim. It must
distinguish checks that passed, failed, were not run, or were blocked, and name
remaining gaps. Agent output, code reading, process start, exit zero, stable
session output, or “looks good” is not completion Proof by itself.

High-risk Work requires review or verification by an actor different from the
actor that built the checked scope. If required Proof is unavailable, the Work
can close only after the user explicitly approves the exact listed gaps. Proof
cannot grant Git, external, destructive, or permission-expanding authority. See
[Independent Proof](guidance/independent-checks.md).

## Progress And Completion

After each meaningful unit of multi-step Work:

- update durable Work, Plan, Milestone, and Proof facts when they add continuity;
- tell the user what completed, what Proof exists, what is current, and `Next`;
- continue within existing Approval instead of repeatedly asking permission;
- stop only for a material product decision, new authority, external effect,
  accepted Proof gap, or real blocker.

A completion report distinguishes run, unrun, failed, and environment-limited
checks. Candidate output becomes accepted only after the primary agent reviews
its provenance, diff or findings, verification, conflicts, and remaining gaps.

## Scoped Git And Approval

Within an authorized change/build task, the primary agent may inspect Git,
create or switch to a non-protected local task branch, create an isolated
worktree, stage only exact task-owned changes, and create bounded local commits
after exact diff review, relevant verification, and credential scanning. These
actions are optional; answer-only, review, or diagnosis does not imply a commit.

A delegated `build` Agent may write only an assigned isolated surface. Local
commits require an explicit grant bound to the absolute exclusive worktree,
dedicated non-protected branch/base, clean baseline, exact scope, allowed Git
actions,
verification, diff review, credential scan, and stop conditions. Without that
grant it must not stage or commit.

After the primary agent accepts an exact candidate, an accountable writer may
introduce only the named commits into an assigned non-protected integration
surface under an explicit target/base/commit/operation grant. Conflict, base
drift, unexpected changes, reconciliation edits, or failed verification stops
the operation. A reconciliation edit requires a new bounded build grant.

`explore` and `check` Agents, non-opted-in Agents, and current `cc`/`cx` profiles
must not stage or commit. No Agent output, intent, Proof, CLI result, hook, or
method can expand Approval.

The following always require explicit user Approval: push, PR, deploy/publish;
any protected/base branch update including direct commit, merge, cherry-pick,
or fast-forward; amend, rebase or other history rewrite; force, reset/clean,
unsafe branch/worktree deletion, secret access, scope or permission expansion,
and other external, irreversible, or data-loss-prone actions. Project rules may
further narrow this authority.

## Authority Map

| Need | Canonical owner |
|---|---|
| Work handling, risk, verification, progress | [Work Handling](guidance/workflow.md) |
| Agent intents, delegation, concurrency, candidate acceptance | [Agent Collaboration](guidance/agent-dispatch.md) |
| debugging and RED/GREEN | [Engineering Methods](guidance/engineering-methods.md) |
| independent Proof, fallback, read-only checks | [Independent Proof](guidance/independent-checks.md) |
| multi-Work phase orchestration | [Milestones](guidance/milestones.md) |
| runtime, adapter, registry, migration maintenance | [Maintenance](guidance/maintenance.md) |
| internal professional checklists | [Lenses](lenses/README.md) |
| cc/cx operation | [Agent Transports](providers/README.md) |
| board metadata | [Schema 2](schemas/board-v2.json) |
| install/upgrade boundary | [AI Install](AI-INSTALL.md) |
