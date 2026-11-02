# Contributing

CatPaw is a delivery ledger: Work, Check, Gap and Note, plus five rules
([ADR-0035](docs/decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md)).
Contributions should make "done" more checkable or work easier to resume
without adding concepts.

Before adding a command, field, file or term, show the concrete failure it
prevents and why an existing mechanism cannot. Prefer deleting guidance that
does not change an action.

## Workflow

1. Change `src/runtime/` and add tests under `tests/`.
2. Update `VERSION`, `package.json` and `CHANGELOG.md` for behavior or format changes.
3. Record significant design changes as `docs/decisions/NNNN-short-title.md`.
4. Run `npm test` and `git diff --check`.

Tests must not touch `~/.catpaw/` or real project boards. Do not commit secrets
or private project records.
