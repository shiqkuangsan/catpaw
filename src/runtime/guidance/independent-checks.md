# Independent Proof

Independent Proof answers one question: when must a completion or risk judgment
come from an actor other than the actor that built the checked scope?

## Internal Checklists

Use only the professional questions relevant to the risk: value and scope,
system and contracts, experience, security, or performance. These checklists
guide what to inspect; they are not Agent identities or public user concepts.

## Actor

The primary agent chooses a current-tool actor, reciprocal cc/cx, or another
available actor based on independence, context, cost, transport, and enforcement.
CatPaw fixes no provider priority. A required independent check uses the `check`
intent and an actor different from the actor that built the checked scope.

## Proof And Storage

Proof is an inspectable fact: a reproducible finding, executed test, independent
review, provider result, or clear remaining gap. Durable Proof is stored as
schema 2 typed Evidence (`research`, `review`, `test`, `provider`, or
`reflection`). Only usable output and executed verification count; process
start, exit zero, stable output, or “looks good” does not.

For each material Agent call, retain only the minimum useful result:

```text
output: usable | partial | empty | failed
candidate: accepted | rejected | superseded | review pending
verification: <command, Proof path, or remaining gap>
```

The primary agent reads the final output, reproduces material findings, and
decides the candidate state. Partial, empty, or failed output enters a selected
fallback and cannot satisfy a required independent check.

## Trigger

Independent Proof is required for:

- internal Gated/high-risk Work;
- security, release, migration, external, destructive, permission, or
  data-integrity risk;
- high-impact contracts or repeated failures;
- a critical completion claim the primary actor cannot independently prove.

It is recommended when durable Work enters an unfamiliar ownership boundary,
crosses shared files or policy/spec/template surfaces, has weak tests, or makes a
non-trivial UI, protocol, or migration change. Small Work may still use several
Agents when that produces useful information.

## Fallback And Gaps

- If a recommended check is not worth its cost, record why it was skipped.
- If a call returns no usable result, say so and select another actor/transport,
  narrow the question, handle it inline with an explicit gap, or stop.
- Required independence cannot be replaced with primary self-review. If no
  independent actor is usable, record the exact gap. Gated Work closes only when
  the user explicitly approves every current missing Proof gate.
- Multi-round checks may reuse an observable session, but every round receives
  the updated bounded delegation facts and next question. Stable output is not
  completion.

## Read-only Enforcement

Prompt-only “read-only” is not a permission boundary. Enforced read-only calls
must prevent write/delete/rename at the tool boundary and limit access to the
exact protected scope. Use a filesystem sandbox, read-only mount or URI, minimal
tool allowlist, immutable snapshot, or task-scoped export.

If the environment cannot prevent writes, mark the call
`no-write requested + audited`; it cannot satisfy an enforced read-only gate.
Do not delegate sensitive user state, configuration, credentials, or production
data without a suitable boundary. Record the protected scope and audit relevant
side effects after the call. Unexpected mutation makes the output failed even
when its content looks useful.

## Approval Boundary

Independent Proof never supplies Approval. Local Git authority comes only from
the authorized Work, runtime policy, exact primary-agent grant, and tool
enforcement. A `check` actor must not stage or commit the checked implementation.
Push, PR, deploy, protected/base updates, history changes, destructive actions,
external effects, secrets, and permission expansion still require explicit user
Approval.
