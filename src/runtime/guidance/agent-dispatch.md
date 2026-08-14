# Agent Collaboration

CatPaw publishes three task intents, collaboration options, and non-negotiable
safety bounds. The primary agent chooses Agents, models, transports, intent
composition, count, order or parallelism, fallback, accountable writers, and
final candidate acceptance for the current Work.

CatPaw does not generate a mandatory execution graph. The primary agent may
adapt or reject scheduling advice but cannot expand user/project Approval or
weaken the constraints in this file.

## Ownership Boundary

| Layer | Owner | Responsibility |
|---|---|---|
| Required runtime constraints | CatPaw | authority ceilings, isolation, required independence, Proof semantics, and candidate boundaries |
| Collaboration advice | CatPaw | intents, patterns, cost/risk signals, hazards, and fallback options |
| Contextual decisions | Primary agent | actors, models, transports, composition, topology, fallback, accountable writers, and candidate acceptance |

Each mutable surface has one accountable writer at a time. The primary agent is
responsible for final reconciliation, conflict handling, verification, and clean
handoff, whether it writes the integration surface itself or delegates it.

## Separation

- **Intent** states what bounded outcome an Agent is responsible for. It is not
  an identity, persona, model, provider, or permission.
- **Agent** is an actor carrying one or more intents for one bounded task.
- **Internal checklist** supplies relevant value, contract, experience,
  security, or performance questions without becoming a public role system.
- **Transport** controls invocation and observation; it does not decide intent,
  completion, acceptance, or authority.
- **Proof** is inspectable support for a claim. Typed Evidence is its schema 2
  storage form and never grants Approval.

Effective authority is the intersection of:

```text
user/project Approval
∩ intent authority ceiling
∩ primary agent's exact grant
∩ transport/tool enforcement
```

Missing permission cannot be invented by an intent name, prompt, output, Proof,
or available tool.

## Intent Catalog

The machine-readable contract is [`catalog/intents.json`](../catalog/intents.json).
Discover it with `catpaw agent intents` or
`catpaw agent intent --intent <id>`.

| Intent | Responsibility |
|---|---|
| `explore` | Establish facts, boundaries, options, and designs |
| `build` | Implement or integrate an exact isolated scope |
| `check` | Review for defects or verify acceptance |

One Agent may carry several intents and several Agents may carry the same intent.
Review and verification remain distinct `check` methods. Required independent
Proof must come from an actor different from the actor that built the checked
scope; changing intent on the same actor does not create independence.

## Bounded Delegation

Every substantive delegation carries the minimum complete execution contract:

```text
outcome: <one verifiable result>
intents: <explore, build, check, or a useful composition>
facts: <source-backed context and current claims>
read scope: <exact paths or surfaces>
write scope: none | <exact isolated surface>
constraints: <project rules, forbidden actions, acceptance focus>
output: <required structure and Proof>
verification: <commands, checks, or reproduction expected>
dependencies: <inputs, ordering, and concurrency boundary>
budget: <time, calls, or context bound when useful>
stop conditions: <done, blocked, conflict, or uncertainty threshold>
allowed actions: <explicit mutations and scoped Git grant when applicable>
```

This contract is transient execution state, not a board artifact or source of
Approval. Follow-up work includes the previous claim, primary-agent critique,
accepted facts, and the narrowed next question; do not depend on global Agent
memory or provider customization for critical constraints.

## Scheduling Signals And Patterns

Possible responses, never mandatory call counts:

| Signal | Possible response |
|---|---|
| material unknown or unfamiliar boundary | one or more `explore` actors on independent fact sources |
| high-impact design choice | competing `explore` proposals or reciprocal critique |
| exact isolated implementation | one or more `build` actors |
| contract or blast-radius risk | adversarial `check` review |
| critical completion claim | non-primary `check` verification |
| several reviewed isolated candidates | bounded `build` integration followed by primary acceptance |
| low information gain or high handoff cost | work inline or reuse current context |

Useful patterns include parallel reconnaissance, competing proposals, isolated
build slices, competing implementations, build-to-check handoff, reciprocal
critique, isolated fan-in, and primary-selected fallback. Cost, latency, context
copy, integration overhead, and expected information gain are scheduling inputs.
Available capacity alone is not a reason to add Agents.

## Concurrency And Isolation

Different Agents must not concurrently write one mutable surface. A mutable
surface includes a worktree, Git index, database, runtime state, external system,
or any state where writes can overwrite or race.

- Competing candidates may change the same logical files only on isolated
  worktrees or equivalent state surfaces.
- One accountable writer owns a shared or integration surface at a time. Stop
  the previous writer and record provenance before handoff.
- Read-only actors may share facts. If tools cannot prevent writes, label the
  call `no-write requested + audited`; do not call it enforced read-only.
- Carry adopted upstream facts into dependent work. Independent work may remain
  parallel.
- Stop related concurrency on side-effect collision, drift, ambiguous scope,
  unexpected files, or conflict.

## Scoped Local Git

A current-tool `build` actor may create bounded local commits only for an
authorized change/build Work and only when the primary agent explicitly binds:

- absolute exclusive worktree and dedicated non-protected branch/base;
- clean baseline and exact write scope;
- allowed Git actions and `local commits: allowed`;
- relevant verification, exact diff review, credential scan, and stop conditions.

It stages only exact task-owned paths and returns base/head, commit list,
committed paths, verification, scan result, and worktree status. It must not
push, modify PRs, update protected/base state, adopt a candidate, amend, rebase,
rewrite history, reset/clean, force, fetch/pull, stash, tag, access secrets,
delete branches/worktrees, or perform undeclared Git actions. Drift, conflict,
unexpected changes, scope expansion, or verification failure stops the work.

After the primary agent accepts exact commits, an accountable writer may perform
only a named clean fast-forward or cherry-pick into an assigned non-protected
surface under an exact target/base/commit/verification grant. It cannot select a
candidate, enlarge the commit list, update protected/base or remote state,
resolve conflicts, or make reconciliation edits. Any such need stops and
requires a new bounded build decision and grant.

`explore`, `check`, non-opted-in actors, and current cc/cx profiles must not stage
or commit.

## Output And Candidate Acceptance

Each call returns a bounded output, run verification, and remaining gaps. The
primary agent classifies output usability as `usable | partial | empty | failed`
and a candidate decision as `accepted | rejected | superseded` after reading and
checking it. Until then, mark it review pending.

ACK, process start, exit zero, session stability, or an Agent's completion claim
is not acceptance. The primary agent verifies material findings and checks
candidate provenance, diff, Proof, credential scan, clean status, and conflicts.
No Agent, catalog entry, session, checklist, Proof, or CLI result can accept its
own output or supply user Approval.

CatPaw-managed cc/cx are read-only transport adapters, not the primary agent's
complete roster. See [Agent Transports](../providers/README.md).
