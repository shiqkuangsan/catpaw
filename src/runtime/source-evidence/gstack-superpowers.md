# gstack / Superpowers Source Evidence

> Status: draft · Last updated: 2026-05-22

This file records public design inspiration that informed CatPaw's role and
methodology model. It exists so maintainers do not need to re-scan upstream
repositories to understand why particular roles exist.

## Attribution and License Note

Public sources:

- gstack: https://github.com/garrytan/gstack
- Superpowers: https://github.com/obra/superpowers

At the time this note was written, both upstream projects presented themselves
as MIT-licensed public repositories. CatPaw does not vendor their code,
commands, or skills. CatPaw records high-level role vocabulary and methodology
inspiration, then normalizes that into its own runtime protocol.

## 1. gstack Source Snapshot

gstack is treated as specialist vocabulary and staged-review inspiration. It
does not become a CatPaw runtime dependency.

### 1.1 Positioning

gstack positions a coding agent as a virtual engineering team with distinct
product, architecture, design, review, QA, security, release, SRE, performance,
documentation, and second-opinion perspectives. The useful idea for CatPaw is
not any single command; it is stage-specific gear shifting between expert
perspectives.

### 1.2 Original Skill Catalog Summary

| Skill | Original specialist / role | CatPaw disposition |
|---|---|---|
| `/office-hours` | YC Office Hours | Product Strategy Advisor inspiration |
| `/plan-ceo-review` | CEO / Founder | Product Strategy Advisor inspiration |
| `/plan-eng-review` | Eng Manager | Architecture / Performance Reviewer inspiration |
| `/plan-design-review` | Senior Designer | Design Reviewer inspiration |
| `/plan-devex-review` | Developer Experience Lead | Developer Experience Reviewer inspiration |
| `/design-consultation` | Design Partner | Folded into Design Reviewer |
| `/review` | Staff Engineer | Engineering Reviewer inspiration |
| `/investigate` | Debugger | Debugging Advisor inspiration |
| `/design-review` | Designer Who Codes | Design Reviewer / visual QA inspiration |
| `/devex-review` | DX Tester | Developer Experience Reviewer inspiration |
| `/design-shotgun` | Design Explorer | Design exploration mode, folded into Design Reviewer |
| `/design-html` | Design Engineer | Design implementation perspective; automation not adopted |
| `/qa` | QA Lead | QA Strategist inspiration; automatic fix/commit not adopted |
| `/qa-only` | QA Reporter | Report-only QA mode for QA Strategist |
| `/browse` | QA Engineer | QA evidence tooling perspective |
| `/pair-agent` | Multi-Agent Coordinator | Not selected; CatPaw itself is orchestration layer |
| `/cso` | Chief Security Officer | Security Reviewer inspiration |
| `/ship` | Release Engineer | Release Strategist inspiration; shipping automation not adopted |
| `/land-and-deploy` | Release Engineer | Deploy / production verification perspective only |
| `/canary` | SRE | Release / Performance post-deploy verification inspiration |
| `/benchmark` | Performance Engineer | Performance Reviewer inspiration |
| `/document-release` | Technical Writer | Release documentation checklist perspective |
| `/retro` | Eng Manager | Retrospective Advisor inspiration |
| `/autoplan` | Review Pipeline | Pipeline inspiration, not a role |
| `/codex` | Second Opinion | Provider / second-opinion capability |
| `/learn` | Memory | Lessons / Retrospective support |
| setup / guard / health utilities | Operational utilities | Selective guard or evidence ideas only; no direct dependency |

## 2. CatPaw-selected Roles

CatPaw roles are stable expert perspectives, not command translations.

| CatPaw Role | Selected from | Why selected |
|---|---|---|
| Product Strategy Advisor | YC Office Hours, CEO / Founder | Early demand, scope, and value judgment |
| Architecture Reviewer | Eng Manager, Staff Engineer | Architecture, data flow, boundaries, long-term constraints |
| Engineering Reviewer | Staff Engineer, Eng Manager, Second Opinion | Implementation quality and production bug risk |
| Design Reviewer | Senior Designer, Designer Who Codes, Design Explorer, Design Partner | UI/UX, visual quality, interaction, exploration |
| Developer Experience Reviewer | Developer Experience Lead, DX Tester | API / CLI / SDK / docs / onboarding friction |
| QA Strategist | QA Lead, QA Reporter, QA Engineer | Test matrix, acceptance paths, evidence standard |
| Security Reviewer | Chief Security Officer | Auth, permissions, secrets, supply chain, CI/CD, LLM trust boundary |
| Release Strategist | Release Engineer, SRE, Technical Writer | Release, deploy, PR, changelog, docs, production verification |
| Performance Reviewer | Performance Engineer, Eng Manager, SRE | Baselines, regressions, Core Web Vitals, resource size |
| Debugging Advisor | Debugger | Root-cause-first diagnosis |
| Retrospective Advisor | Eng Manager, Memory | Process trends, lessons, promotable rules |

## 3. Not Selected As CatPaw Roles

| Upstream concept | Decision | Reason |
|---|---|---|
| Multi-Agent Coordinator | Not selected | CatPaw is already the orchestration layer |
| Session Manager | Not selected | Browser/cookie session operation, not expert judgment |
| Review Pipeline | Not selected | Pipeline composition, not a role |
| Memory | Not selected | Supports Lessons / Retrospective, not a standalone Council role |
| Design Partner / Design Engineer | Merged | Folded into Design Reviewer; automatic implementation not adopted |
| QA Engineer | Merged | Folded into QA Strategist |
| Technical Writer | Merged for now | Folded into Release Strategist; may become Documentation Reviewer later |
| Deployment Configurator | Not selected | Writes deployment config; setup/automation surface |
| Safety / Edit-scope guards | Not selected as roles | Guard ideas are rules, not Expert Council roles |

## 4. Automation Surface Explicitly Rejected

CatPaw does not adopt upstream automation that would authorize:

- automatic commit;
- automatic push;
- automatic PR creation;
- automatic merge or deploy;
- automatic version bump;
- automatic CHANGELOG / TODO / docs rewrites;
- automatic provider adapter setup;
- telemetry / analytics / session files;
- QA test-fix-commit loops;
- full shipping or deploy chains.

CatPaw may reuse the checklist ideas, but all external actions remain controlled
by CatPaw gates and explicit user confirmation.

## 5. Superpowers Source Snapshot

Superpowers is treated as execution methodology, not a role catalog.

| superpowers skill / agent | CatPaw usage |
|---|---|
| `brainstorming` | Requirements clarification and design method; CatPaw decides whether to trigger it |
| `writing-plans` | L2/L3 planning method; CatPaw owns artifact paths |
| `test-driven-development` | Test-first method; mandatory only when task/user rules require it |
| `systematic-debugging` | Debugging Advisor execution method |
| `verification-before-completion` | CatPaw verification gate method |
| `requesting-code-review` | Light review / subagent review discipline |
| `receiving-code-review` | Feedback handling discipline |
| `subagent-driven-development` | Optional execution mode; does not change role/provider boundaries |
| `executing-plans` | Optional execution mode for written plans |
| `finishing-a-development-branch` | Closeout checks only; git actions remain CatPaw-gated |
| `code-reviewer` agent | Possible provider for Engineering / Architecture review |

## 6. Normalization Rule

```text
gstack = specialist vocabulary + gear-shift inspiration
superpowers = execution methodology
CatPaw Expert Council = normalized advisory roles
Providers = actual agents/models/tools that perform a role
```

CatPaw adopts expert perspectives without upstream automation chains. It adopts
execution methodology without adopting upstream file paths, commit requirements,
or lifecycle rules.
