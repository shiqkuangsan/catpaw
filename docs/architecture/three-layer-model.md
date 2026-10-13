# Three Runtime Surfaces

CatPaw provides a lightweight work protocol and local project memory for the
primary agent. Three surfaces keep the entry compact, make detailed methods
available on demand, and give repeatable operations executable checks.

```text
Always-on Rules
      |
      v
On-demand Guidance
      |
      v
Executable Tools
```

These are responsibility surfaces, not release stages. A task may use all
three, but each kind of rule has one primary owner.

## Always-on Rules

[`runtime-policy.md`](../../src/runtime/runtime-policy.md) is the compact entry
card loaded when CatPaw applies. It owns:

- activation and instruction priority;
- Work, evidence, permission boundaries, and internal risk routing;
- Work Board boundary;
- progress and completion expectations;
- safety and authorization invariants;
- links to the more specific authority.

It should remain short enough to load routinely. Detailed recipes and repeated
examples do not belong here.

## On-demand Guidance

Guidance is read when a task reaches the corresponding decision:

| Need | Owner |
|---|---|
| Work handling and internal risk behavior | [`workflow.md`](../../src/runtime/guidance/workflow.md) |
| Evidence coverage, candidate freshness, and decisions | [`evidence.md`](../../src/runtime/guidance/evidence.md) |
| Agent intents, bounded delegation, scheduling, and concurrency | [`agent-dispatch.md`](../../src/runtime/guidance/agent-dispatch.md) |
| Machine-readable Agent intent contracts | [`intents.json`](../../src/runtime/catalog/intents.json) |
| Root-cause debugging and RED/GREEN | [`engineering-methods.md`](../../src/runtime/guidance/engineering-methods.md) |
| Independent triggers and fallback | [`independent-checks.md`](../../src/runtime/guidance/independent-checks.md) |
| Multi-Work phase progress | [`milestones.md`](../../src/runtime/guidance/milestones.md) |
| Runtime, adapter, registry, and import maintenance | [`maintenance.md`](../../src/runtime/guidance/maintenance.md) |
| Professional perspectives | [`lenses/`](../../src/runtime/lenses/) |
| `cc`/`cx` invocation and observation | [`providers/`](../../src/runtime/providers/) |

On-demand material guides contextual judgment. It should not duplicate machine
validation or silently expand user authorization.

## Executable Tools

[`catpaw.mjs`](../../src/runtime/bin/catpaw.mjs) and its supporting libraries own
mechanical behavior:

- schema validation and artifact graph construction;
- deterministic status and doctor findings;
- dry-run patch planning and staged, preimage-checked publication;
- Work, Milestone, and Proof/Evidence mutations;
- read-only Agent intent discovery;
- schema migration staging and validation;
- observable external Agent session operations.

The machine metadata contract lives in
[`board-v2.json`](../../src/runtime/schemas/board-v2.json). Executable tools do
not decide product intent, accept risk, or grant permission; they make selected
operations repeatable and inspectable.

## Why Hybrid

A prose-only runtime leaves consistency to agent memory. A fully rigid engine
cannot reliably choose scope, tradeoffs, useful checks, or when facts change
the plan. CatPaw therefore assigns:

```text
Primary agent -> contextual orchestration and final adoption
CLI           -> deterministic record, candidate, and operation checks
User          -> consequential choices, permissions, and accepted risk
```

CLI completion gates check stored assertions; they do not establish that all
acceptance scenarios were tested or that an actor label is authentic. The
primary agent connects raw results to acceptance and decides completion. This
division is deliberate: the protocol supports judgment with continuity and
inspectable facts rather than delegating it to record shape.

Evaluate improvements by whether another session can resume accurately, a
completion claim can be checked, and authorized work proceeds with fewer
unnecessary interruptions. File counts, review rounds, and a green board are
not measures of delivery quality. A shorter entry is an attention saving, not
evidence of model compliance or measured productivity.

The separate storage and activation chain is described in
[Sync and References](sync-and-references.md). The accepted decision is
[ADR-0019](../decisions/0019-catpaw-3-hybrid-runtime.md).

## Invariants

- One behavior has one canonical owner.
- Guidance may call tools, but cannot weaken tool safety.
- Tools may report gaps, but cannot invent acceptance.
- Agent output and Proof never create authority.
- Intent catalog and scheduling guidance are advisory; the primary agent owns topology.
- Concurrent Agents do not write one shared mutable surface.
- Loading CatPaw does not imply installation, migration, or external action.
