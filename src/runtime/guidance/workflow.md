# Work Handling

Users need one visible flow:

```text
Understand -> Execute -> Check -> Finish
```

The primary agent may move backward when facts change. It must not hide risk,
failed Proof, unresolved questions, or missing Approval to preserve a linear
story.

## Internal Risk Handling

Schema 2 retains three internal modes. They are routing metadata, not concepts a
user must select or learn.

### Direct

Narrow, local, reversible, low-risk Work normally stays in the conversation.
The primary agent still understands, executes, checks, and reports the result.

### Tracked

Multi-step Work, shared behavior, or cross-session continuity creates a Work
Item and Plan. Useful research, review, test, or reflection facts are stored as
typed Evidence that supplies durable Proof.

### Gated

Security, release, migration, external, destructive, data-integrity, permission,
or high-impact contract Work creates a Work Item and Plan and requires
independent Proof. Missing required Proof can close only with the user's explicit
Approval of every current gap.

Start with the lightest safe handling and upgrade immediately when scope, blast
radius, irreversibility, or uncertainty grows. Internal mode never grants an
external action or bypasses Approval.

## Internal Lifecycle Mapping

Schema 2's stable stage values remain compatible:

| Visible flow | Internal stages |
|---|---|
| Understand | `think`, `plan` |
| Execute | `build` |
| Check | `review`, `test` |
| Finish | `ship`, `reflect` |

Stages may be brief. They exist for durable continuity and precise method
selection, not to make users manage a seven-step ceremony.

## Optional Execution Methods

Select a specific method only when its trigger changes the next action or Proof:
design exploration, root-cause debugging, RED/GREEN, parallel investigation,
adversarial review, interactive verification, or completion checks. CatPaw-owned
debugging and RED/GREEN contracts are in [Engineering Methods](engineering-methods.md).

- Do not reload a method for an unchanged context.
- A method cannot choose board storage, grant Approval, accept a candidate, or
  change Git authority.
- Persist method output only when it changes Work, Proof, a finding, or a reusable
  lesson; do not create duplicate ledgers or plans.
- Judge method value by usable output and verified effect, not invocation count,
  review rounds, or token use.

## Understand

- Establish the user outcome, constraints, non-goals, and Approval already given.
- Inspect the real source of truth; bugs and anomalies require a demonstrated
  root cause before repair.
- Choose internal risk handling and the Proof needed for completion.
- Use `explore` Agents when independent facts or alternatives add information;
  avoid delegation whose handoff cost exceeds its value.
- Durable Work records its acceptance, verification entrypoints, dependencies,
  and failure handling in its internal Plan.

### Structure Complex Work When Needed

Use a structured pass only when Work spans multiple concerns or systems, has
unclear containment or cross-branch dependencies, or the user wants to clarify
the shape before execution. Simple Work does not need this method.

- Start from the user outcome and build one shallow scope tree, normally two or
  three levels. The tree expresses containment only; it is not a task hierarchy.
- Record dependency edges separately and only when they change sequencing,
  ownership, safe parallelism, or risk. A tree must not pretend to represent a
  dependency graph.
- Annotate material local statements or decision points as `Confirmed`,
  `Proposed`, or `Open`.
  `Confirmed` requires an explicit user decision or verified fact; these labels
  are local discussion notes, not Work status, Proof, Approval, or schema fields.
- Select the first thin end-to-end delivery slice and give it acceptance plus
  required Proof. Prefer a user-visible path through the necessary layers over
  completing every infrastructure layer first.

Execution is ready when outcome and non-goals are clear, material dependencies
are visible, every blocking dependency of the first slice is satisfied or has
an authorized executable resolution with an accountable owner, the slice has no
blocking `Open`, acceptance and Proof are defined, and future Approval boundaries
are named. Otherwise stay in Understand. Non-blocking `Open` items may be
explicitly deferred; Understand does not require total certainty.

Direct Work keeps this structure in the conversation. Durable Work persists
only the useful parts in the existing Plan, normally under Approach, Contracts,
Steps, Verification, Risks, or Notes. Do not create a Tree/Map artifact or a
second plan. A tree leaf becomes separate Work only when it has an independently
verifiable outcome; several such Work items may use an optional Milestone.

## Execute

- Work along existing ownership boundaries and keep changes bounded.
- A delegated writer receives one exact isolated mutable surface; different
  Agents never concurrently write the same surface.
- Behavior-sensitive Work uses RED/GREEN when the trigger applies.
- After a meaningful unit, update durable Work and Proof facts and report current
  progress plus `Next`.
- If an assumption fails, return to Understand instead of pretending execution
  remains on plan.

## Check

- Review the facts, contracts, boundaries, failure paths, and likely regressions.
- Run the smallest relevant verification first, then expand with blast radius.
- Distinguish pass, fail, not-run, blocked, and environment-limited outcomes.
- High-risk Work uses a `check` actor different from the actor that built the
  checked scope. Review finds defects; verification reproduces acceptance. They
  are methods of one intent, not interchangeable claims.
- Proof stored through `proof add` remains typed schema 2 Evidence. Applied Proof
  requires a substantive body; code reading and process status are not tests.
- A Gated `done` Work requires usable test plus independent review/provider
  Evidence, or explicit user Approval covering every current missing gate.

## Finish

- Review the exact diff or deliverable, Proof, remaining gaps, and recovery path.
- The primary agent decides whether a candidate is accepted, rejected, or
  superseded; candidate authors cannot accept their own output.
- Local Git follows the scoped rules in the runtime policy. Push, PR,
  deploy/publish, protected/base updates, history changes, destructive cleanup,
  secrets, permission expansion, and external effects still require explicit
  user Approval.
- Reflect only on reusable lessons that change later judgment or execution.
- Report completed Work, Proof, remaining risk, and a concrete `Next`.

## Continuous Progress

Authorized multi-step Work continues without asking the user for each internal
step. Pause only for a material product choice, new authority, external or
irreversible effect, user acceptance of a required Proof gap, or a real blocker.
Neither an Agent output nor a successful tool result supplies Approval.
