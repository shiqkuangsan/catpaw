# Three Runtime Surfaces

CatPaw 3 divides runtime behavior into three surfaces. The split keeps the
always-loaded contract small while preserving detailed judgment and executable
consistency where they add value.

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
- initial Direct/Tracked/Gated dispatch;
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
| Lifecycle and mode behavior | [`workflow.md`](../../src/runtime/guidance/workflow.md) |
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
- dry-run patch planning and atomic apply;
- Work, Milestone, and Evidence mutations;
- schema migration staging and validation;
- observable external Agent session operations.

The machine metadata contract lives in
[`board-v2.json`](../../src/runtime/schemas/board-v2.json). Executable tools do
not decide product intent, accept risk, or grant permission; they make selected
operations repeatable and inspectable.

## Why Hybrid

A prose-only runtime leaves consistency to agent memory. A fully rigid engine
cannot reliably choose scope, tradeoffs, useful Lens combinations, or when
evidence changes the plan. CatPaw therefore assigns:

```text
Agent -> contextual judgment
CLI   -> deterministic record and verification
User  -> authorization and accepted risk
```

The separate storage and activation chain is described in
[Sync and References](sync-and-references.md). The accepted decision is
[ADR-0019](../decisions/0019-catpaw-3-hybrid-runtime.md).

## Invariants

- One behavior has one canonical owner.
- Guidance may call tools, but cannot weaken tool safety.
- Tools may report gaps, but cannot invent acceptance.
- Lens or Agent output is evidence, not authority.
- Loading CatPaw does not imply installation, migration, or external action.
