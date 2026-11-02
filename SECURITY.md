# Security Policy

CatPaw is a local CLI that reads and writes `.catpaw/` inside a project and runs
read-only `git` commands to compute snapshots. It does not use the network,
collect secrets or invoke other agents.

## Reporting A Vulnerability

Report security issues through GitHub Security Advisories when available, or by
opening a minimal public issue that avoids sensitive details. Do not include
credentials, private keys, customer data or proprietary source code.

## Expected Invariants

- CatPaw never commits, pushes, deploys or deletes project files. `convert`
  moves the old board into `.catpaw/archive/schema-2/` and refuses to replace it
  if it changed during conversion.
- Records, checks and command output never grant permission.
- Snapshot computation reads repository state only and excludes the board.
- Check records point to raw output; they should not contain secrets.
