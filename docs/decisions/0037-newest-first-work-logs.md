# ADR-0037: Newest First Work Logs

Status: Accepted

Date: 2026-11-05

## Context

Readers open `LOG.md` to find what just happened. With oldest entries first,
they have to scroll past the history. Changing write order alone would let
older runtimes treat an earlier pass as the latest Check and miss a failure.
Timestamps cannot resolve this because multiple records can share a second,
and the clock is not the order in which the board accepted the records.

## Decision

Schema 4 keeps the entry syntax but places the latest recorded entry first.
Writers add an entry atomically under the existing board lock. Readers and
completion rules work newest first; the runtime reverses schema 3 logs in
memory for reads and still writes them in their original order. The schema
marker prevents an older runtime from applying its completion rules to a
schema 4 board.

The existing `convert` command previews schema 3 conversion and changes files
only with `--apply`. Conversion reverses whole record blocks in a staged copy
and archives the original board. It preserves record text, including damaged
markers that should still block completion. Captured output keeps its path.
Schema 2 conversion now writes schema 4 directly.
