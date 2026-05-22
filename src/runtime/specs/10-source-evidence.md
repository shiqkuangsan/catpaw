# 10. Source Evidence

> Status: draft · Last updated: 2026-05-22

This spec mirrors the runtime-facing source-evidence summary. The detailed
attribution note lives in `source-evidence/gstack-superpowers.md`.

## 1. Public Inspiration

CatPaw records high-level design inspiration from public AI workflow systems:

- gstack: specialist vocabulary and stage-specific expert perspectives.
- Superpowers: execution methodology such as brainstorming, planning, TDD,
  systematic debugging, verification before completion, and review discipline.

CatPaw does not vendor those projects, require them at runtime, or adopt their
automation chains.

## 2. gstack Summary

gstack is treated as a source for:

- product strategy pressure;
- architecture and engineering review;
- design and developer-experience review;
- QA and browser-based evidence standards;
- security and release perspectives;
- performance and post-deploy verification;
- second-opinion provider patterns.

CatPaw maps these ideas to normalized Expert Council roles rather than command
names.

## 3. Superpowers Summary

Superpowers is treated as execution methodology. CatPaw may use the method
behind skills such as:

- brainstorming;
- writing plans;
- test-driven development;
- systematic debugging;
- verification before completion;
- requesting and receiving code review;
- subagent-driven development;
- executing plans;
- finishing a development branch.

CatPaw still owns workflow level classification, artifact paths, safety gates,
and closeout rules.

## 4. Normalized CatPaw Roles

| CatPaw Role | Inspiration | Primary use |
|---|---|---|
| Product Strategy Advisor | product/founder review | Need, scope, value, priority |
| Architecture Reviewer | engineering manager / senior reviewer | Boundaries, data flow, API, persistence, long-term constraints |
| Engineering Reviewer | staff engineering review | Implementation quality, maintainability, production bug risk |
| Design Reviewer | design review and exploration | UI/UX, visual quality, interaction |
| Developer Experience Reviewer | DX audit | API / CLI / SDK / docs onboarding |
| QA Strategist | QA lead / QA reporter | Test matrix, acceptance path, evidence standard |
| Security Reviewer | security officer | Auth, permissions, secrets, supply chain, trust boundary |
| Release Strategist | release/SRE/docs roles | Release risk, rollback, PR, docs, production verification |
| Performance Reviewer | benchmark/performance review | Baselines, regressions, latency, Core Web Vitals, resource size |
| Debugging Advisor | systematic debugging | Root-cause-first diagnosis |
| Retrospective Advisor | retrospective / memory | Lessons, process improvements, promotable rules |

## 5. Explicit Non-adoptions

CatPaw does not adopt:

- automatic commit / push / PR / merge / deploy;
- automatic version bumps;
- automatic TODO / CHANGELOG / docs rewrites;
- upstream runtime file paths;
- upstream telemetry, session, cookie, deploy setup, or routing config;
- full upstream shipping or QA automation chains.

## 6. Final Rule

```text
gstack = specialist vocabulary + gear-shift inspiration
superpowers = execution methodology
CatPaw Expert Council = normalized advisory roles
Providers = actual agents/models/tools that perform a role
```
