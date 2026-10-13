# ADR-0034: Refine Product Capabilities Around Agent-owned Judgment

Status: Accepted

Date: 2026-10-13

## Context

The user reaffirmed that CatPaw is not intended to replace the primary agent's
judgment. Recent delivery work demonstrated useful continuity, candidate-bound
evidence, independent review, and continued execution within existing authority.
It also exposed stale Work scope after later authorization and the risk of
reading passing local checks as complete real-service acceptance.

Existing authorities already assign judgment and adoption to the primary agent.
Public entrypoints obscure that division with duplicated mechanics, compatibility
details, stale version prose, and wording that makes CatPaw itself the decider.
The full product also includes engineering methods, bounded collaboration and
maintenance tools; describing it only as memory or a completion gate omits much
of its value. Executable checks exposed inconsistent status coverage and lost
same-title rerun results despite successful Work inspection.

## Decision

- Describe the full product through four capability areas: engineering methods,
  Work/Evidence continuity, Agent collaboration, and reliable local maintenance.
  The primary agent owns judgment, orchestration, and final acceptance. Methods
  guide its actions; tools enforce only their declared mechanical contracts.
- Lead public entrypoints with practical value: continuity, evidence tied to
  claims, bounded collaboration, and progress within existing permission.
  Route operating detail to its canonical owner and CLI help.
- Keep evidence coverage explicit in existing record bodies. Local tests,
  real-service acceptance, and production activation support different claims.
  The primary agent checks coverage; CLI gates check record conditions.
- Reconcile current Work scope and acceptance when user decisions change.
  Business scope, permitted actions, and candidate file scope remain distinct.
- Judge additions by the action, boundary, or evidence they improve. Prefer an
  existing mechanism and delete duplication before adding concepts or machinery.
- Use current-candidate Evidence in status and report unavailable inspection
  explicitly. Append contract 4 rerun observations without losing earlier results.
  Expose the existing Evidence options through complete subcommand help.
- Distinguish ordinary self-check from required independence, and structural
  Milestone closure from achieved exit criteria. Already-authorized external
  actions continue once prerequisites pass. Delegated builders cannot adopt
  on behalf of the primary agent; primary implementation is compatible with
  final responsibility but does not satisfy an independent check.
- Keep useful methods, five lenses, compatibility aliases and migration/recovery
  mechanisms. Consolidate repeated rules under their canonical authority.
  Leave contract-field edits in the existing Work record; defer new update
  options and registry writes until usage justifies expanding the CLI.
- Keep impact-based verification selection in Work guidance and completion
  semantics in Evidence guidance. Projects own runnable acceptance entrypoints,
  environments and assertions. A development-only scope can finish after its
  required checks; a production-delivery scope continues through authorized
  deployment and production verification. File extensions and command names do
  not determine behavior impact or real-path coverage.

## Consequences

This refines ADR-0032/0033 without changing schema, command inventory, completion
requirements or permission scope. Status adds proofCheck and uses missingProof
null for unavailable inspection. Contract 4 same-title writes append; callers
must inspect an uncertain write before retrying. Legacy/topic behavior remains.
There is no new scheduler, scenario ledger, approval stage, or mandatory Plan.
Private local records do not automatically become shared team memory.

Text checks and independent scenario review can establish source consistency and
expose unclear guidance. They cannot prove general Agent compliance, automatic
coverage enforcement, or productivity gains. Source changes require a separately
authorized activation before they affect the installed runtime.

## References

- [Work-centered runtime](0032-work-centered-runtime-and-verifiable-operations.md)
- [Permission boundaries](0033-permission-boundaries-without-a-public-authorization-concept.md)
- [Runtime surfaces](../architecture/three-layer-model.md)
- [Evidence Contract](../../src/runtime/guidance/evidence.md)
- [Product Capabilities](../product-capabilities.md)
