# Security Policy

CatPaw is a local workflow runtime for AI-assisted software work. It should not
collect, transmit, or require secrets.

## Reporting A Vulnerability

Please report security issues through GitHub Security Advisories when available,
or by opening a minimal public issue that avoids exposing sensitive details.

Do not include live credentials, private keys, customer data, or proprietary
source code in public issues.

## Scope

Security-sensitive areas include:

- runtime install and upgrade behavior;
- project artifact migration;
- external Agent invocation and session routing;
- registry handling under `~/.catpaw/state/`;
- instructions that could authorize destructive actions, commits, pushes, PRs,
  deploys, or secret access.

## Expected Invariants

- CatPaw commands do not automatically commit, push, create PRs, deploy, or run
  destructive cleanup.
- Runtime files are installed under `~/.catpaw/`, not provider config
  directories.
- Project `.catpaw/` boards contain project artifacts only, not the full runtime
  package.
- Local registry state is not copied into the runtime package or source repo.
