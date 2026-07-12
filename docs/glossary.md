# CatPaw 3 Glossary

Current runtime behavior is defined by
[`runtime-policy.md`](../src/runtime/runtime-policy.md), its linked guidance,
the board schema, and the CLI. This glossary explains the shared vocabulary.

## activation

An explicit transition from a built package to the installed runtime, or from
an installed runtime reference to a host/project setup. A source build alone is
not activation.

## Agent

The actor that performs work or supplies judgment: the primary coding agent, a
current-tool subagent, or a callable external Agent. CatPaw directly manages
only `cc` and `cx` external invocation.

## artifact

One durable node in a schema 2 project board: Index, Milestone, Work Item, Plan,
or typed Evidence.

## board / Work Board

The project-local `.catpaw/` artifact directory. It contains `index.md`,
`milestones/`, `work/`, `plans/`, and `evidence/`; it never contains a copied
runtime package.

## board schema 2

The metadata and graph contract in
[`board-v2.json`](../src/runtime/schemas/board-v2.json). It is independent from
the runtime package version.

## Direct / Tracked / Gated

The three workflow modes. Direct is lightweight and normally non-durable;
Tracked records multi-step or shared work; Gated adds required independent
judgment and evidence for high-risk work.

## dist

The generated runtime package at `dist/runtime/`. It is built from source and
can be compared with an installation, but is not itself installed.

## dry-run

A deterministic preview of findings and proposed mutations. Board mutation
commands default to dry-run; `--apply` is a separate explicit action.

## Evidence

A typed, checkable record. Schema 2 types are `research`, `review`, `test`,
`provider`, and `reflection`. Evidence may bind to a Work Item; topic research
may remain unbound.

## Hybrid Runtime

The architecture in which agents make contextual decisions, executable tools
record and verify deterministic state, and users retain authorization over
writes and external effects.

## Independent Check

A non-primary judgment used when risk, uncertainty, or completion claims need
separation from the primary Agent. It may be recommended or required; an
unavailable required check creates a gap rather than a fabricated pass.

## Index

The board's `index.md`: a compact dashboard and schema marker. It is not a
substitute for durable Work, Plan, Milestone, or Evidence detail.

## installed runtime

The active runtime package under `~/.catpaw/`. It remains authoritative for
ordinary projects until an explicit, verified activation replaces it.

## Lens

A focused professional perspective, independent of which Agent supplies it.
CatPaw has five Lens cards: Value & Scope, System & Contracts, Experience,
Security, and Performance.

## lifecycle

The stable development flow:

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Stages may be short or revisited, but risk and failed evidence cannot be hidden
by skipping labels.

## manifest / canonical files

[`runtime-manifest.json`](../src/runtime/runtime-manifest.json) and its
`canonicalFiles` list define the exact generated and installable package
surface.

## Milestone

An optional phase artifact that groups multiple Work Items around one outcome,
scope, and exit criteria. It reduces fragmented stop-and-ask cycles but does
not replace Work Items.

## Plan

A Work-bound artifact that records contracts, execution units, acceptance,
verification, and relevant failure handling.

## project registry

Per-machine advisory state at `~/.catpaw/state/projects.json`. It indexes known
board paths and observations; it does not own or mutate project artifacts.

## source

The versioned runtime authoring tree under `src/runtime/`. Editing source does
not alter dist, the installed runtime, or a project board.

## thin adapter

A small managed instruction block in a host rule file that points to CatPaw.
It does not embed the runtime and requires explicit merge authorization.

## Work Item

The smallest durable, independently verifiable unit of work. Its metadata
records type, mode, status, lifecycle stage, and dates.
