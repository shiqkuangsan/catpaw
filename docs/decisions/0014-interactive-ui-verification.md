# ADR-0014: Interactive UI Verification Surfaces

Status: Superseded by ADR-0019
Date: 2026-05-25

## Context

CatPaw already required agents to verify work before claiming completion, but
frontend tasks often depended on generic Playwright or browser QA wording.
Modern providers can expose richer interactive surfaces, including in-app
Browser / browser-use, Chrome DevTools, and Computer Use for real local
application windows.

The problem is not that CatPaw needs one mandatory UI tool. The problem is that
agents should not hand ordinary UI verification back to the user when the
current provider can inspect and exercise the UI itself.

## Decision

Treat interactive UI tools as provider-dependent verification surfaces. For
frontend or UI-facing work, agents should use the strongest available surface
before user handoff:

1. repo-native automated tests;
2. Browser / browser-use / in-app browser;
3. Playwright or Chrome DevTools;
4. Computer Use for real local app/browser-window flows or OS-level UI;
5. manual reasoning only when interactive tools are unavailable or blocked.

The verification report should name the URL/app/window, flow, viewport/device
when relevant, observed behavior, and remaining gap.

## Consequences

- Frontend work has a clearer self-verification gate.
- Browser / browser-use and Computer Use are supported without making CatPaw
  depend on a specific provider.
- Agents should escalate only when credentials, private app state, permissions,
  blocked environment, physical device access, or product judgment requires the
  user.
- Interactive tools do not bypass safety gates. External submissions,
  destructive UI actions, permission changes, commits, pushes, PRs, deploys, and
  other visible side effects still require explicit user confirmation.
- No project artifact migration is required.

## References

- `src/runtime/runtime-policy.md`
- `src/runtime/specs/06-subsystems.md`
- `src/runtime/specs/08-operating-rules.md`
- `src/runtime/roles/qa-strategist.md`
- `src/runtime/roles/design-reviewer.md`
- `src/runtime/templates/plan.md`
- `src/runtime/templates/test-matrix.md`
