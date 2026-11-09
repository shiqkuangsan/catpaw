# ADR-0038: Forward And Record Check Stdin

Status: Accepted

Date: 2026-11-09

## Context

The CatPaw 5 field trial (2026-11-02 to 2026-11-08, ergouzi-space and
lowcode-all, 34 Work) showed captured checks working as intended: 247 of 403
checks were captured and 72 failures were retained. Two Work were reopened after
`done` for the same reason: `catpaw check ... -- python3 -` with a heredoc ran
with stdin ignored, read empty input, exited 0 and was recorded as passed.

The same trial showed two done Work stating unverified scope only in Next
("provider flows were not exercised", "not tested and are not claimed") with no
Gap, so `finish` could not see it.

## Decision

- Captured checks forward non-TTY stdin to the command, as if it ran directly,
  and save the input as `runs/<ID>/<run>.stdin`. The entry records
  `run.stdin` with `bytes`, `sha256` and `file`. Forwarding stops when the
  command exits, so an open pipe does not keep catpaw waiting. TTY stdin is not
  forwarded, because it could not be recorded.
- Policy: any unverified statement in `WORK.md`, Next or the delivery report
  must map to a Gap. Scope the user agreed to skip is still recorded as a Gap
  and accepted by the user, quoting them.

Rejected:

- An Acceptance "excluded" list: it would let an Agent narrow scope
  unilaterally, bypassing rule 3, which reserves Gap acceptance for the user.
- Requiring `--actor` with `--independent`: an Agent can supply any name, so it
  would not prevent mislabeled independent checks. Checker identity stays out of
  scope per ADR-0035.

## Consequences

Heredoc and piped checks now run their input and remain reviewable. A check
still proves only that its recorded command and input ran with that exit code.
Prose-only gaps remain a policy rule, not a mechanical check.

## References

- [ADR-0035](0035-catpaw-5-delivery-ledger-and-minimal-concepts.md)
- [ADR-0036](0036-captured-checks-board-lock-and-format-integrity.md)
