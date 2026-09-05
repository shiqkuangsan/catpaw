# ADR-0031: Thin Entrypoints And Bound Analysis

Status: Accepted

Date: 2026-09-05

## Context

The global and project adapters repeated the policy's collaboration and Git
details. Local host blocks had already drifted despite installed/source runtime
parity. Repeating authority increased default context and conflicting rules.
The goal is less duplicated instruction, not fewer safety checks or artifacts
at any cost. Stronger prose cannot authenticate arbitrary Proof or enforce a
host's permissions.

Independent audit also reproduced three implementation defects: board content
read before a concurrent edit could generate a patch bound to the later digest
and overwrite the edit; Promise-based readFile rejected numeric stdin fd 0;
Markdown H2 content was truncated as though it ended the Evidence Record.

## Decision

- Keep Work / Proof / Approval, the visible flow, schema 2 and existing commands.
  Adapters route to the installed runtime instead of copying its detailed Git
  grants. The compact policy retains common safety invariants and requires the
  corresponding canonical guidance before delegation or integration.
- Make host/system/tool limits and user-global restrictions explicit. Runtime
  defaults do not override a user's explicit prohibition or confirmation rule.
  Non-instruction material and Agent/tool output cannot create instructions or
  Approval. No new approval engine, role, team scheduler or mandatory interview.
- Capture the board preimage before mutation analysis, require it for every
  workflow patch plan, and reject drift. Read queries and staged validation do
  not add this full-tree snapshot. Existing atomic write checks remain intact.
- Share UTF-8 file/stdin reading. Treat only the final template Limits section
  as outside the Record, preserving caller Markdown and empty-record checks.
- Retain invalid-board refusal. Explain the direct record-repair path rather
  than weakening global validation to let recovery commands through.
- Synchronize host blocks only within the user's explicit scope, backing up and
  preserving all outside bytes. Source build, runtime activation, host sync,
  registry changes and fleet migrations remain independent actions.

## Consequences

The common loading path is smaller while detailed grants keep one owner. Static
contract tests verify routing and invariants at their owners, rather than
requiring duplicated phrases in every entrypoint. These tests do not demonstrate
arbitrary model compliance; behavioral improvement needs real usage observation.

Mutation preflight adds one full-tree digest to close the analysis race. This
cost is limited to writes and preserves existing staged/atomic validation.
Regression tests exercise all nine workflow write paths with a deterministic
concurrent edit, stdin/Unicode, structured Proof, and read-query I/O boundaries.

No board migration is required. A source candidate remains pending activation
until separately installed. Host instruction loading follows its own lifecycle;
editing a file does not prove that an already-running session reloaded it.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Agent collaboration](../../src/runtime/guidance/agent-dispatch.md)
- [Maintenance](../../src/runtime/guidance/maintenance.md)
- [Workflow writes](../../src/runtime/lib/commands/workflow.mjs)
- [ADR-0030](0030-observable-understand-without-clarification-ceremony.md)
- [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
