# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw is a local-first runtime for reliable coding-agent work. It keeps agents
moving within the authority you have given, requires inspectable support for
completion claims, and stops only when a decision or risk genuinely belongs to
you.

```text
Work      what outcome is being delivered, what is current, and what is next
Proof     what was checked, what the facts show, and what remains uncertain
Approval  the exact decision needed for new authority or accepted risk
```

These are parallel concerns. Most Work needs no new Approval after you authorize
the task.

Source runtime version: `3.4.0`. Project boards use **schema 2**.

## The User Model

### Work

Work carries one outcome from understanding through a clean handoff. Small,
local tasks may stay in the conversation. Work that needs continuity is recorded
in the repository so another session can recover the goal, progress, and `Next`.

Several related Work items may optionally share a Milestone. Users do not need
to manage internal risk modes, lifecycle stages, or Agent topology.

### Proof

Proof is inspectable support for a claim: executed checks, reproducible findings,
independent review, and explicit remaining gaps. Process start, exit zero,
session stability, code reading, or an Agent saying “done” is not completion
Proof by itself.

High-risk Work requires Proof from an actor different from the actor that built
the checked scope. Durable Proof is stored as typed schema 2 `Evidence`; this is
a storage term, not a second user concept.

### Approval

Approval is required only when the user must supply new authority or consciously
accept risk: material outcome changes, missing required Proof, external or
irreversible effects, protected/base updates, destructive or history-changing
Git, secret access, or permission expansion.

Approval is not a workflow stage. Already-authorized Work continues without
asking for every internal step. Proof can never manufacture Approval.

## Visible Flow

```text
Understand -> Execute -> Check -> Finish
```

CatPaw chooses lightweight, durable, or high-risk handling internally. It keeps
the detailed lifecycle and board metadata for continuity without making the user
operate them.

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

`Work` maps to schema 2 Work Item/Plan records. `Proof` facts map to typed
Evidence. `Approval` remains a user authority boundary and is not a new artifact.
Schema 1 migration may additionally retain a checksummed
`legacy/schema-1/` archive; original material is preserved.

## CLI

Preferred commands:

```text
catpaw board init|status|doctor|migrate
catpaw work start [--high-risk]|close
catpaw milestone start|add|close
catpaw proof add
catpaw agent intents|intent
catpaw agent check|open|send|status|read|close
```

Board mutations are dry-run by default and write only with explicit `--apply`.
`proof add` stores typed schema 2 Evidence. Existing `evidence add` and
`work start --mode tracked|gated` inputs remain compatible for older callers.
Agent session status reports observable process/output facts and never infers
completion.

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
