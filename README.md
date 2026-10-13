# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw gives coding agents a lightweight work protocol, engineering methods,
project memory, and local tools.
It helps the primary agent carry work through to completion and leave evidence
that others can inspect.

The primary agent owns judgment, orchestration, and final acceptance. CatPaw
supplies continuity, engineering guidance, and tools for keeping records
consistent. Users retain control of consequential choices and permissions.

## Why Use It

| When work gets difficult | What CatPaw contributes |
|---|---|
| A session ends or another agent takes over | One Work record preserves the outcome, decisions, progress, gaps, and Next. |
| Code passes locally but delivery is still unverified | Evidence states what was checked, against which candidate, and what remains open. |
| A risky change needs another pair of eyes | Independent checks challenge the implementation; the primary agent evaluates the findings. |
| Internal steps keep triggering permission questions | Existing authorization carries across steps; only a new boundary needs a new decision. |

These mechanisms work together: continuity keeps the goal intact, evidence makes
claims inspectable, and permission boundaries allow work to proceed without
quietly expanding its scope. Their value is fewer lost decisions, unsupported
completion claims, and unnecessary interruptions—not more process records.

## Daily Work

```text
Understand -> Execute -> Check -> Finish
```

The agent establishes the outcome, acts within the granted scope, checks the
result, and reports what was delivered. New findings may send it back to an
earlier step. Clear requests proceed without a clarification ceremony.

Small, local, reversible tasks can stay in the conversation. Work that needs
continuity uses one record under `.catpaw/`, with planning inline. Separate
Plans and Milestones are optional. Methods and collaboration are loaded when
they affect the next action or the evidence needed.

For example, a change may pass local tests while its real service integration
still needs verification. The agent keeps that gap visible, completes the
remaining authorized checks, and distinguishes implementation, validation, and
deployment in the handoff. A green record alone does not establish delivery.

## Capability Map

| Area | Capabilities |
|---|---|
| Engineering methods | Understanding and delivery slices, root-cause investigation, RED/GREEN, contract and engineering review, bounded prototypes, five check perspectives |
| Work and evidence | Work lifecycle, optional Plans/Milestones, Evidence records and command capture, candidate freshness, preserved continuation |
| Agent collaboration | explore/build/check, bounded delegation and handoff, independent checks, write isolation, cc/cx transports |
| Installation and maintenance | Board checks and migration, runtime/adapter preview and recovery, package verification, advisory project registry |

The [product capability map](docs/product-capabilities.md) (Chinese) links each
capability to its implementation, limits, and design choices. Agents execute
methods; CLI tools provide records, fingerprints, and maintenance operations.

## What Makes It Useful

- **Memory close to the work.** Repository-local files preserve decisions and
  evidence across sessions and hosts that can access them. Sharing still depends
  on how the project stores those files; an ignored local board is not team memory.
- **Evidence tied to a candidate.** High-risk completion requires passing tests
  and independent review for the current scope, acceptance, and cycle. Later
  failures supersede earlier passes. CLI checks validate records and freshness;
  the primary agent must still assess coverage, truth, and reviewer independence.
- **Agent-led collaboration.** The primary agent chooses actors, models,
  ordering, fallback, and final adoption. The `explore`, `build`, and `check`
  intents bound delegated work; each mutable surface has one writer. CatPaw's
  `cc`/`cx` transports provide read-only second opinions when useful.
- **Proportionate process.** Start with the lightest safe approach. Reuse valid
  evidence, read details on demand, and record only what changes later action.

## Start Here

In an installed runtime, run:

```bash
node ~/.catpaw/bin/catpaw.mjs status
node ~/.catpaw/bin/catpaw.mjs --help
```

CatPaw does not modify `PATH`. In a source checkout, use
`src/runtime/bin/catpaw.mjs`. Writes default to dry-run; `--apply` executes the
requested operation within existing authorization.

The [runtime guide](src/runtime/README.md) routes Work, evidence, collaboration,
and maintenance operations. [Runtime policy](src/runtime/runtime-policy.md)
owns operating rules. Evidence is the preferred name; Proof and Approval remain
compatibility terms for evidence and a user permission boundary. Neither records
nor tool success grant permission.

## Build And Installation

Source runtime: **4.0.2 (unreleased)**. Project boards use **schema 2**;
compatibility details live in the [runtime guide](src/runtime/README.md).

```bash
node --test
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Activation is machine-local. Building does not automatically install, apply, or
migrate anything. Source, generated `dist`, installed runtime, host adapters,
and project boards have separate boundaries. For an authorized installation or
upgrade, follow [AI-INSTALL.md](AI-INSTALL.md).

Maintainers start with [docs/README.md](docs/README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md). CatPaw is not affiliated with a model vendor
or similarly named product. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).
