# ADR-0036: Captured Checks, Board Lock And Format Integrity

Status: Accepted

Date: 2026-11-02

## Context

ADR-0035 removed CatPaw 4's command capture, drift refusal and board doctor
together with the concepts around them. A review of what was lost found three
gaps in the ledger's own integrity, not in Agent guidance:

- Every Check was self-reported. The ledger recorded whatever result an Agent
  claimed, so it could not catch a skipped, misread or unrecorded failing run.
  CatPaw 4's `evidence run` covered this but was used about 6 times: it
  previewed by default and kept only digests, not output.
- Ten concurrent `gap add` calls on one Work left 10 LOG entries but 1 Gap in
  `WORK.md`. Read-modify-write had no lock, so a lost Gap could let `finish`
  pass Work with unverified scope. Parallel `start` could reuse an id.
- `WORK.md` is hand-editable, and a Gaps line that did not match the format was
  silently skipped by the parser. A malformed `LOG.md` marker became body text.

## Decision

Keep the four concepts and five rules. Add three mechanisms:

- **Captured check**: `catpaw check <id> <summary> -- <command>` runs the
  command without a shell, decides `passed`/`failed`/`blocked` from the exit
  code, timeout or start failure, stores raw output in `.catpaw/runs/` (which
  ignores itself in Git) and records a `run` field. The result binds to the
  snapshot before the run; a different snapshot afterwards is recorded as
  `drift`. Self-reported checks remain for work a command cannot express.
- **Board lock**: every write runs under `.catpaw/.lock` (exclusive create,
  holder pid, takeover when the holder is gone or the lock is older than 60
  seconds). Captured commands run outside the lock.
- **Format integrity**: `finish` and `gate` treat unreadable content as a rule
  violation instead of skipping it.

## Consequences

A captured Check proves that this command ran on this snapshot with this exit
code. It does not prove the command covers acceptance; the recorded command
makes that reviewable. LOG.md remains editable by hand: the model assumes
mistaken Agents, not adversarial ones.

Hand-written placeholders such as `none` in Gaps now block completion until
removed. An audit of 13 converted boards (487 Work) found no existing violations.

## References

- [ADR-0035](0035-catpaw-5-delivery-ledger-and-minimal-concepts.md)
