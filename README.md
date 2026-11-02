# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw is a delivery ledger for coding agents. It keeps local files next to the
project so that an agent's "done" can be checked and the work can be resumed by
the next session or agent.

It is not a task tracker, a method library, an agent orchestrator, or a
permission system. The primary agent owns judgment; CatPaw records what was
verified, what was not, and refuses a completion that the records do not support.

## Four Concepts

| Concept | Meaning |
|---|---|
| Work | One delivery: goal, acceptance, repositories in scope, decisions, Next; `open`, `blocked`, `done` or `dropped`; optionally `risk: high` |
| Check | A dated result (`passed`, `failed`, `blocked`, `not-run`), by `self` or `independent`, bound to the current snapshot of every repository in scope |
| Gap | Something acceptance needs that is not verified: `open`, or `accepted` by the user with a reason |
| Note | Any other dated record: decision, finding, handoff |

## Five Rules

1. Records and tool output never grant permission.
2. Checks and Notes are append-only; a later failure is never hidden by an earlier pass, and a pass counts only on the current snapshot.
3. `done` requires no open Gap; an accepted Gap stays visible and never becomes a pass.
4. `risk: high` additionally needs passed `self` and `independent` Checks on the current snapshot.
5. One writer per mutable scope; an independent checker is not the implementer.

`catpaw finish` and `catpaw gate` enforce rules 2–4 mechanically. The full agent
policy is [src/runtime/policy.md](src/runtime/policy.md).

## Usage

```bash
npm install -g /path/to/catpaw
catpaw init
catpaw start "Restrict Jira transitions" --risk high --repos .,../jira
catpaw check W-001 passed "unit and contract tests" --output .local/acceptance/run.json
catpaw check W-001 passed "security review" --independent --actor reviewer
catpaw gap W-001 add "production DingTalk path not verified"
catpaw finish W-001
```

Hooks inject active Work at session start (Claude Code) and block pushes of
inconsistent records (Git pre-push). See [src/runtime/README.md](src/runtime/README.md)
for host integration, board format and schema 2 conversion.

## Development

```bash
npm test
```

Design rationale lives in [docs/](docs/README.md); the current design is
[ADR-0035](docs/decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md).
CatPaw is not affiliated with any model vendor or similarly named product; see
[NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).
