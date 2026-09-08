# ADR-0033: Keep permission boundaries below the public Work model

Status: Accepted

Date: 2026-09-08

## Current Interpretation

Permission boundaries remain operational safety constraints. `Authorization` is
not a public CatPaw concept, artifact, state machine, or workflow stage;
`Approval` remains a compatibility term for a user boundary that must be
supplied or widened. This refines ADR-0032 without weakening its gates.

## Context

The runtime previously described permission constraints as a separate
`Authorization` concept even though authority comes from the user, project,
host, and tools rather than from a CatPaw registry.

## Decision

CatPaw keeps user, project, host, and tool permissions as an execution boundary,
but does not expose `Authorization` as a separate user concept, artifact, state
machine, or workflow stage. `Approval` remains a compatibility term for a user
boundary that must be supplied or widened.

Work owns outcome and acceptance. Evidence supports claims. Permission checks
pause execution only when the next action exceeds the currently granted scope.
An existing scope persists across internal steps; Evidence, Agent output, and
CLI success never create permission.

## Rationale

The runtime has no independent authority registry. Treating Authorization as a
first-class CatPaw concept would duplicate the actual sources of authority and
invite stale records to look like capabilities. Keeping the boundary explicit
in operational rules preserves safety without adding another public ledger.

This is a terminology and routing refinement. It does not weaken Git, runtime
activation, adapter, registry, migration, secret, or external-action gates.
