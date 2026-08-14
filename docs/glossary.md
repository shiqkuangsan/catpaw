# CatPaw 3 Vocabulary

Current behavior is defined by
[`runtime-policy.md`](../src/runtime/runtime-policy.md), its linked guidance,
the board schema, and the CLI. Ordinary users need only three concepts.

## Work

The outcome being pursued, its visible state, and the accountable owner. Small
Work may stay conversational; multi-step, shared, or high-risk Work is recorded
under the project-local `.catpaw/` board.

Several related Work items may optionally share a Milestone. This grouping does
not change each Work item's ownership, Proof, or Approval boundary.

## Proof

Inspectable facts supporting a claim: research, review findings, test results,
provider output, or reflection. Proof must name its checked scope and result;
high-risk completion needs independent Proof from an actor other than the actor
that built the checked scope.

Schema 2 stores durable Proof as typed `Evidence`. `Evidence` is the storage
name, not a separate user concept. Proof can support a decision but cannot grant
permission.

## Approval

The user's authority for an action or explicit acceptance of a named risk/gap.
Approval is not a board artifact or a lifecycle stage. Protected/base, remote,
history-changing, destructive, secret, permission-expanding, and external
actions require the applicable explicit Approval regardless of available Proof.

## Visible flow

```text
Understand -> Execute -> Check -> Finish
```

This is how progress is explained. The runtime may revisit a phase when new
facts invalidate an earlier assumption.

## Agent task intents

Agents receive one or more bounded intents:

- `explore` investigates facts, boundaries, options, or designs;
- `build` changes or integrates an exact isolated scope;
- `check` reviews for defects or verifies acceptance.

Intents are not personas, identities, models, providers, or permission grants.
Review and verification are different `check` methods. The primary agent owns
contextual team formation, fallback, candidate acceptance, and final adoption.

## Internal compatibility vocabulary

These terms may appear in raw schema 2 state, migration material, or maintainer
guidance. They are implementation detail rather than prerequisites for using
CatPaw:

| Internal term | Meaning |
|---|---|
| `Direct / Tracked / Gated` | risk and durability routing; `--high-risk` maps to `gated` |
| `Think / Plan / Build / Review / Test / Ship / Reflect` | stored stage values behind the four visible phases |
| `Plan` | Work-bound execution and verification detail |
| `Evidence` | typed durable storage used by Proof |
| `Lens` | optional internal checklist for a professional concern |
| delegation fields | exact outcome, facts, scope, constraints, deliverable, verification, dependencies, stop conditions, and allowed actions |
| integration owner | the one accountable writer for an isolated mutable surface |

## Runtime and storage surfaces

| Surface | Meaning |
|---|---|
| `src/runtime/` | versioned runtime source |
| `dist/runtime/` | generated package; not installed |
| `~/.catpaw/` | explicitly activated installed runtime |
| project `.catpaw/` | schema 2 Work/Proof storage; never a runtime copy |

[`runtime-manifest.json`](../src/runtime/runtime-manifest.json) defines the
installable package. A source build does not activate the runtime, rewrite a
project board, refresh adapters, or perform an external action.
