# CatPaw Runtime

CatPaw is a local-first runtime for reliable coding-agent Work:

```text
Work      outcome, progress, and Next
Proof     checked facts and remaining gaps
Approval  exact user authority or accepted risk
```

The visible flow is `Understand -> Execute -> Check -> Finish`. Internal schema
2 modes, stages, typed Evidence, checklists, delegation fields, and scoped Git
rules preserve precision without becoming user prerequisites.

## Runtime Composition

| Surface | Responsibility |
|---|---|
| [runtime-policy.md](runtime-policy.md) | always-on Work / Proof / Approval routing and safety |
| [catalog/](catalog/) | machine-readable `explore`, `build`, and `check` intent contracts |
| [guidance/](guidance/) | internal Work handling, Agent collaboration, methods, independent Proof, Milestone, and maintenance |
| [lenses/](lenses/) | internal professional checklists |
| [providers/](providers/) | reciprocal cc/cx recipes and observable sessions |
| [bin/](bin/), [lib/](lib/) | deterministic CLI, graph, patch, migration, catalog, and session logic |
| [schemas/](schemas/), [templates/](templates/) | schema 2 storage contract and artifact skeletons |

## Project Memory

Project-local `.catpaw/` is durable memory, not a runtime copy:

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
    └── topics/
```

User-facing Work maps to Work Item and Plan storage. Proof facts map to typed
Evidence (`research | review | test | provider | reflection`). Approval remains
a user boundary, not an artifact. A schema 1 migration may preserve an isolated
`legacy/schema-1/` checksum archive without changing the native graph.

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

Mutations default to dry-run and write only with `--apply`. `proof add` and the
compatible `evidence add` share identical schema 2 storage logic. `--high-risk`
maps to internal `mode: gated`; existing `--mode tracked|gated` remains accepted.

Agent intent discovery is read-only. The primary agent chooses actors, models,
transports, composition, topology, fallback, accountable writers, and final
candidate acceptance. Observable session status never infers completion.

`catpaw` abbreviates `src/runtime/bin/catpaw.mjs` in a source checkout and
`~/.catpaw/bin/catpaw.mjs` after installation. CatPaw does not modify `PATH`.

## Install And Activation

Installed runtime lives at `~/.catpaw/`. Source/dist readiness does not activate
it. Runtime installation, host adapter refresh, and each project board migration
remain separate explicit actions. See [AI Install](AI-INSTALL.md) and
[Maintenance](guidance/maintenance.md).
