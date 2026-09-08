# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw is a local-first runtime for reliable coding-agent work. It keeps agents
moving within the authority you have given, requires inspectable support for
completion claims, and stops only when a decision or risk genuinely belongs to
you.

```text
Work -> goal, acceptance, progress and Next
        Evidence supports acceptance; permission boundaries bound actions
```

Work is the primary entry. Evidence is the preferred name for durable Proof;
Approval remains compatible terminology for a user permission boundary. Product
decisions, granted actions and risk acceptance are distinct. A granted scope
continues across steps without repeated approval ceremonies.

Source runtime version: `4.0.1`. Project boards use **schema 2**, with explicit
contract 4 metadata on new Work. Existing records remain readable; older runtime
versions may reject new records. No fleet migration is required.

## The User Model

### Work

Work carries one outcome from understanding through a clean handoff. Small,
local tasks may stay in the conversation. Work that needs continuity is recorded
in the repository so another session can recover the goal, progress, and `Next`.

Several related Work items may optionally share a Milestone. Users do not need
to manage internal risk modes, lifecycle stages, or Agent topology.

Durable Work is one record with inline planning. A separate Plan is optional.
`work continue` preserves a terminal closure and starts a new evidence cycle.

### Evidence (Proof compatibility)

Proof is inspectable support for a claim: executed checks, reproducible findings,
independent review, and explicit remaining gaps. Process start, exit zero,
session stability, code reading, or an Agent saying “done” is not completion
Proof by itself.

New high-risk Work requires passing test and independent review/provider results
bound to the current candidate, acceptance and cycle. Later failures supersede
older passes. `evidence run` captures execution facts; an exit code does not prove
test adequacy and asserted actor names do not authenticate identity.

### Permission boundaries (Approval compatibility)

CatPaw follows the authority already supplied by the user, project, host, and
tools. It pauses only when an action needs a new or wider boundary: external or
irreversible effects, protected/base updates, destructive or history-changing
Git, secret access, or permission expansion.

Approval is not a workflow stage or a board artifact. Work with an existing
granted scope continues without asking for every internal step. Proof can never
create permission. Record product choices and explicit risk acceptance
separately from the action boundary; risk acceptance cannot turn a failed check
into a passing result.

## Visible Flow

```text
Understand -> Execute -> Check -> Finish
```

CatPaw chooses lightweight, durable, or high-risk handling internally. It keeps
the detailed lifecycle and board metadata for continuity without making the user
operate them.

Every Work gets a lightweight Understand readiness pass. Clear Work stays brief
and proceeds. When ambiguity could materially change outcome, scope, acceptance,
data or permission boundaries, or an external or irreversible choice, CatPaw
shows a compact readback and asks only the decisions that unblock the first
slice. Structurally complex Work may also separate a shallow scope tree,
material dependency edges, and local `Confirmed | Proposed | Open` notes. This
adds no stage, artifact, mandatory headings, or user concept; durable output
reuses Work or its optional Plan.

## Agent Collaboration

CatPaw exposes three bounded task intents:

| Intent | Outcome |
|---|---|
| `explore` | Establish facts, boundaries, options, and designs |
| `build` | Implement or integrate an exact isolated scope |
| `check` | Review for defects or verify acceptance |

The primary agent decides which Agents, models, and transports to use, whether
to work serially or in parallel, and which candidate to accept. CatPaw provides
constraints and collaboration options, not an automatic team scheduler.

Different Agents never concurrently write the same mutable surface. Competing
candidates may touch the same logical files only in isolated worktrees or
equivalent state. Independent Proof always requires a different actor, not the
same Agent under another label.

CatPaw-managed reciprocal read-only transports are `cc` (Claude Code) and `cx`
(Codex). They are second-opinion surfaces, not the primary agent's complete
roster.

## Project Memory

The repository-local `.catpaw/` board stores durable project facts:

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
```

`Work` maps to one schema 2 Work Item with an optional Plan. `Proof` facts map to typed
Evidence. `Approval` remains a user authority boundary and is not a new artifact.
Schema 1 migration may additionally retain a checksummed
`legacy/schema-1/` archive; original material is preserved.

## CLI

Preferred commands:

```text
catpaw status
catpaw board init|status|doctor|migrate
catpaw work start|show|update|finish|cancel|continue
catpaw milestone start|show|add|finish|cancel
catpaw evidence add|list|show|run
catpaw proof add|list|show
catpaw runtime inspect|plan|apply|recover
catpaw adapter inspect|plan|apply|recover
catpaw intent list|show
catpaw transport check|open|send|status|read|close
```

Run `catpaw --help`, `catpaw <command> --help`, or `catpaw --version` for
discovery. `status` is the ordinary Work view; `board` is the storage and
maintenance surface. Mutations are dry-run by default and write only with
explicit `--apply`. `proof add` stores typed schema 2 Evidence while accepting
inline, file, or stdin bodies. Existing `board status`, `work close`,
`milestone close`, `evidence add`, `agent ...`, and
`work start --mode tracked|gated` calls remain compatible.

Human output uses Work, Proof, visible Phase, Action, and Next. JSON retains
schema-shaped compatibility fields. Transport session status reports observable
process/output facts and never infers completion.

In a source checkout, use `src/runtime/bin/catpaw.mjs`; after installation, use
`~/.catpaw/bin/catpaw.mjs`. CatPaw does not add itself to `PATH`.

## Safety

- Agent output, Proof, and CLI success do not grant Approval.
- A delegated writer receives one exact isolated mutable surface.
- Bounded local commits require an explicit scoped grant, clean baseline, exact
  diff review, relevant verification, and a credential scan.
- A candidate is not accepted merely because it was delivered or committed.
- Push, PR, deploy/publish, protected/base updates, history rewriting, force,
  destructive cleanup, secret access, permission expansion, and other external
  or irreversible effects require explicit user Approval.

## Build And Activation

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Activation is machine-local. Source, generated `dist`, installed runtime, host
adapter, and each project board are separate surfaces:

```text
source -> dist -> installed -> project board
```

Building does not automatically install, apply, activate, or migrate CatPaw.
After explicit authorization, begin with [AI-INSTALL.md](AI-INSTALL.md).

## Repository

```text
catpaw/
├── src/runtime/   # versioned runtime source
├── scripts/       # build and verification
├── tests/         # executable contracts
├── docs/          # maintainer rationale and ADRs
└── dist/runtime/  # generated, Git-ignored package
```

Runtime behavior is owned by
[runtime-policy.md](src/runtime/runtime-policy.md). Maintainers start with
[docs/README.md](docs/README.md).

CatPaw is not affiliated with any model vendor or similarly named product. See
[NOTICE.md](NOTICE.md). MIT licensed; see [LICENSE](LICENSE).
