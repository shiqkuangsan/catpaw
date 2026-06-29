import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeProject, renderStatus } from "../scripts/catpaw-project.mjs";

async function withFixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-project-"));
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await writeFile(target, content);
}

async function mkdirp(root, relativePath) {
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(path.join(root, relativePath), { recursive: true }),
  );
}

async function writeActiveBoard(root) {
  await mkdirp(root, ".catpaw/reqs");
  await mkdirp(root, ".catpaw/plans/active");
  await mkdirp(root, ".catpaw/tests/matrices");
  await mkdirp(root, ".catpaw/reviews/FR-001-demo");

  await write(
    root,
    "AGENTS.md",
    `# AGENTS.md

# CatPaw Protocol

- This project follows the global CatPaw runtime at \`~/.catpaw/\`.
- When working with project workflow artifacts, read \`~/.catpaw/runtime-policy.md\` first.
- Project CatPaw artifacts live in this repository's \`.catpaw/\` directory.
`,
  );
  await write(
    root,
    ".catpaw/index.md",
    `---
runtime: 2.0.6
---

# CatPaw Index

## Active Work
- [FR-001 demo](reqs/FR-001-demo.md)
`,
  );
  await write(
    root,
    ".catpaw/reqs/FR-001-demo.md",
    `---
id: FR-001
type: feature
status: active
level: L2
priority: P1
created: 2026-05-27
updated: 2026-05-27
closed: null
---

# FR-001 Demo
`,
  );
  await write(
    root,
    ".catpaw/plans/active/FR-001-demo.md",
    `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Verification
- [ ] UI / interactive check:
`,
  );
  await write(
    root,
    ".catpaw/tests/matrices/FR-001-demo.md",
    `---
id: T-001
req: FR-001
plan: FR-001-demo
status: active
updated: 2026-05-27
closed: null
---

# Test Matrix

Req: ../../reqs/FR-001-demo.md
Plan: ../../plans/active/FR-001-demo.md

| Area | Scenario | Result |
|---|---|---|
| Happy path | Demo works | pending |
`,
  );
  await write(
    root,
    ".catpaw/reviews/FR-001-demo/summary.md",
    `---
req: FR-001
plan: FR-001-demo
status: active
mode: light
updated: 2026-05-27
closed: null
---

# Review

Plan: ../../plans/active/FR-001-demo.md
`,
  );
}

test("status summarizes active CatPaw work without findings for a healthy active board", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);

    const result = await analyzeProject({ projectRoot: root });

    assert.equal(result.ok, true);
    assert.equal(result.status.activeMilestones.length, 0);
    assert.equal(result.status.activeReqs.length, 1);
    assert.equal(result.status.activeReqs[0].id, "FR-001");
    assert.equal(result.status.activeReqs[0].title, "Demo");
    assert.equal(result.status.activePlans.length, 1);
    assert.equal(result.status.nextRecommendedAction, "continue active work");
    assert.deepEqual(result.findings, []);

    const rendered = renderStatus(result);
    assert.match(rendered, /\| ID \| Title \| Status \| Target \| Links \|/);
    assert.match(rendered, /\| ID \| Title \| Status \| Links \|/);
    assert.match(rendered, /\| FR-001 \| Demo \| active \|/);
    assert.match(rendered, /\[Req\]\(.catpaw\/reqs\/FR-001-demo.md\)/);
    assert.match(rendered, /\[Plan\]\(.catpaw\/plans\/active\/FR-001-demo.md\)/);
    assert.match(rendered, /\[Tests\]\(.catpaw\/tests\/matrices\/FR-001-demo.md\)/);
    assert.match(rendered, /\[Review\]\(.catpaw\/reviews\/FR-001-demo\/summary.md\)/);
  });
});

test("status summarizes active milestones", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await mkdirp(root, ".catpaw/milestones");
    await write(
      root,
      ".catpaw/index.md",
      `---
runtime: 2.1.5
---

# CatPaw Index

## Active Milestones

| ID | Title | Status | Target | Links |
|---|---|---|---|---|
| MS-001 | Demo Phase | active | beta usable | [Milestone](milestones/MS-001-demo-phase.md) · [FR-001](reqs/FR-001-demo.md) |

## Active Work
- [FR-001 demo](reqs/FR-001-demo.md)
`,
    );
    await write(
      root,
      ".catpaw/milestones/MS-001-demo-phase.md",
      `---
id: MS-001
status: active
created: 2026-05-27
updated: 2026-05-27
closed: null
target: beta usable
---

# MS-001 Demo Phase

## Scope

| Req | Title | Status | Notes |
|---|---|---|---|
| FR-001 | Demo | active | current slice |
`,
    );

    const result = await analyzeProject({ projectRoot: root });

    assert.equal(result.ok, true);
    assert.equal(result.status.activeMilestones.length, 1);
    assert.equal(result.status.activeMilestones[0].id, "MS-001");
    assert.equal(result.status.activeMilestones[0].title, "Demo Phase");
    assert.equal(result.status.nextRecommendedAction, "continue active milestone");
    assert.deepEqual(result.findings, []);

    const rendered = renderStatus(result);
    assert.match(rendered, /Active Milestones:/);
    assert.match(rendered, /\| MS-001 \| Demo Phase \| active \| beta usable \|/);
    assert.match(rendered, /\[Milestone\]\(.catpaw\/milestones\/MS-001-demo-phase.md\)/);
    assert.match(rendered, /\[FR-001\]\(.catpaw\/reqs\/FR-001-demo.md\)/);
  });
});

test("doctor reports milestone and req state drift", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await mkdirp(root, ".catpaw/milestones");
    await write(
      root,
      ".catpaw/index.md",
      `---
runtime: 2.1.5
---

# CatPaw Index

## Active Milestones

| ID | Title | Status | Target | Links |
|---|---|---|---|---|
| MS-001 | Demo Phase | done | beta usable | [Milestone](milestones/MS-001-demo-phase.md) |
`,
    );
    await write(
      root,
      ".catpaw/milestones/MS-001-demo-phase.md",
      `---
id: MS-001
status: done
created: 2026-05-27
updated: 2026-05-27
closed: 2026-05-27
target: beta usable
---

# MS-001 Demo Phase

## Scope

| Req | Title | Status | Notes |
|---|---|---|---|
| FR-001 | Demo | active | current slice |
| FR-999 | Missing | active | stale |
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const codes = result.findings.map((finding) => finding.code);

    assert.equal(result.ok, false);
    assert.ok(codes.includes("index-lists-terminal-milestone"));
    assert.ok(codes.includes("milestone-missing-req"));
    assert.ok(codes.includes("done-milestone-has-active-req"));
  });
});

test("doctor reports closeout drift when terminal reqs still look active", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const reqPath = path.join(root, ".catpaw/reqs/FR-001-demo.md");
    const req = await readFile(reqPath, "utf8");
    await writeFile(
      reqPath,
      req
        .replace("status: active", "status: done")
        .replace("closed: null", "closed: 2026-05-27"),
    );

    const result = await analyzeProject({ projectRoot: root });
    const messages = result.findings.map((finding) => finding.message);

    assert.equal(result.ok, false);
    assert.equal(result.status.nextRecommendedAction, "run catpaw:doctor");
    assert.equal(result.status.needsUserDecision, true);
    assert.match(messages.join("\n"), /Index lists terminal req/);
    assert.match(messages.join("\n"), /still has active plan/);
    assert.match(messages.join("\n"), /has pending test matrix rows/);
    assert.match(messages.join("\n"), /Review still points to active plan/);
  });
});

test("doctor does not report pending tests when terminal matrix rows are resolved", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const reqPath = path.join(root, ".catpaw/reqs/FR-001-demo.md");
    const matrixPath = path.join(root, ".catpaw/tests/matrices/FR-001-demo.md");
    const req = await readFile(reqPath, "utf8");
    const matrix = await readFile(matrixPath, "utf8");
    await writeFile(
      reqPath,
      req
        .replace("status: active", "status: done")
        .replace("closed: null", "closed: 2026-05-27"),
    );
    await writeFile(matrixPath, matrix.replace("pending", "passed"));

    const result = await analyzeProject({ projectRoot: root });
    const pending = result.findings.find(
      (finding) => finding.code === "terminal-req-pending-tests",
    );

    assert.equal(pending, undefined);
  });
});

test("doctor reports registry and board runtime stamp mismatch", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const registryPath = path.join(root, "projects.json");
    await writeFile(
      registryPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          projects: [
            {
              boardPath: path.join(root, ".catpaw"),
              projectRoot: root,
              stamp: "2.0.5",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const result = await analyzeProject({ projectRoot: root, registryPath });
    const mismatch = result.findings.find(
      (finding) => finding.code === "registry-stamp-mismatch",
    );

    assert.equal(result.ok, false);
    assert.equal(mismatch?.severity, "error");
    assert.match(mismatch?.message ?? "", /registry 2.0.5/);
    assert.match(mismatch?.message ?? "", /board 2.0.6/);
  });
});

test("doctor reports formal review without non-primary provider evidence", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      ".catpaw/reviews/FR-001-demo/summary.md",
      `---
req: FR-001
plan: FR-001-demo
status: done
mode: formal
updated: 2026-05-27
closed: 2026-05-27
---

# Review

## Participants
- Engineering Reviewer via current coding agent

## Provider gaps
- None

## Decision
proceed
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const gate = result.findings.find(
      (finding) => finding.code === "formal-review-missing-non-primary-provider",
    );

    assert.equal(result.ok, false);
    assert.equal(gate?.severity, "error");
    assert.match(gate?.message ?? "", /formal review/i);
  });
});

test("doctor accepts formal review with explicit accepted provider gap", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      ".catpaw/reviews/FR-001-demo/summary.md",
      `---
req: FR-001
plan: FR-001-demo
status: done
mode: formal
updated: 2026-05-27
closed: 2026-05-27
---

# Review

## Participants
- Engineering Reviewer via current coding agent

## Provider gaps
- accepted by user: Laoer unavailable; user accepted the provider gap.

## Decision
proceed
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const gate = result.findings.find(
      (finding) => finding.code === "formal-review-missing-non-primary-provider",
    );

    assert.equal(gate, undefined);
  });
});

test("doctor reports L3 plan without provider gate evidence", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const reqPath = path.join(root, ".catpaw/reqs/FR-001-demo.md");
    const req = await readFile(reqPath, "utf8");
    await writeFile(reqPath, req.replace("level: L2", "level: L3"));
    await write(
      root,
      ".catpaw/plans/active/FR-001-demo.md",
      `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Council
- Required roles: Engineering Reviewer
- Providers:
- Summary:
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const gate = result.findings.find(
      (finding) => finding.code === "l3-plan-missing-provider-gate",
    );

    assert.equal(result.ok, false);
    assert.equal(gate?.severity, "error");
    assert.match(gate?.message ?? "", /L3 plan/i);
  });
});

test("doctor reports invalid provider stance values", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      ".catpaw/plans/active/FR-001-demo.md",
      `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Notes
- Provider stance: skipped
- Subagent skipped: inline was enough
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const stance = result.findings.find(
      (finding) => finding.code === "invalid-provider-stance",
    );

    assert.equal(result.ok, false);
    assert.equal(stance?.severity, "error");
    assert.match(stance?.message ?? "", /skipped/);
  });
});

test("doctor warns when preferred subagent stance lacks outcome evidence", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      ".catpaw/plans/active/FR-001-demo.md",
      `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Notes
- Provider stance: preferred
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const warning = result.findings.find(
      (finding) => finding.code === "preferred-subagent-missing-outcome",
    );

    assert.equal(result.ok, true);
    assert.equal(warning?.severity, "warning");
    assert.match(warning?.message ?? "", /preferred/i);
  });
});

test("doctor accepts preferred subagent stance with evidence or skip reason", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      ".catpaw/plans/active/FR-001-demo.md",
      `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Notes
- Provider stance: preferred
- Provider outcome: used
- Engineering Reviewer via current-tool subagent
`,
    );

    let result = await analyzeProject({ projectRoot: root });
    assert.equal(
      result.findings.find((finding) => finding.code === "preferred-subagent-missing-outcome"),
      undefined,
    );

    await write(
      root,
      ".catpaw/plans/active/FR-001-demo.md",
      `---
id: PLAN-001
req: FR-001
status: active
updated: 2026-05-27
closed: null
---

# Plan

## Notes
- Provider stance: preferred
- Provider outcome: skipped
- Subagent skipped: inline handling is sufficient for this narrow fixture.
`,
    );

    result = await analyzeProject({ projectRoot: root });
    assert.equal(
      result.findings.find((finding) => finding.code === "preferred-subagent-missing-outcome"),
      undefined,
    );
  });
});

test("doctor reports L3 req without test matrix", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const reqPath = path.join(root, ".catpaw/reqs/FR-001-demo.md");
    const matrixPath = path.join(root, ".catpaw/tests/matrices/FR-001-demo.md");
    const req = await readFile(reqPath, "utf8");
    await writeFile(reqPath, req.replace("level: L2", "level: L3"));
    await rm(matrixPath);

    const result = await analyzeProject({ projectRoot: root });
    const missing = result.findings.find(
      (finding) => finding.code === "l3-req-missing-test-matrix",
    );

    assert.equal(result.ok, false);
    assert.equal(missing?.severity, "error");
    assert.match(missing?.message ?? "", /test matrix/i);
  });
});

test("doctor reports plan directory and status drift", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    const activePlanPath = path.join(root, ".catpaw/plans/active/FR-001-demo.md");
    const activePlan = await readFile(activePlanPath, "utf8");
    await writeFile(activePlanPath, activePlan.replace("status: active", "status: done"));

    await mkdirp(root, ".catpaw/plans/archive");
    await write(
      root,
      ".catpaw/plans/archive/FR-002-archived-active.md",
      `---
id: PLAN-002
req: FR-002
status: active
updated: 2026-05-27
closed: null
---

# Archived Active Plan
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const activeDone = result.findings.find(
      (finding) => finding.code === "active-plan-terminal-status",
    );
    const archiveActive = result.findings.find(
      (finding) => finding.code === "archived-plan-active-status",
    );

    assert.equal(result.ok, false);
    assert.equal(activeDone?.severity, "error");
    assert.equal(archiveActive?.severity, "error");
  });
});

test("doctor reports missing project adapter for CatPaw board", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await rm(path.join(root, "AGENTS.md"));

    const result = await analyzeProject({ projectRoot: root });
    const adapter = result.findings.find(
      (finding) => finding.code === "project-adapter-missing",
    );

    assert.equal(result.ok, true);
    assert.equal(adapter?.severity, "warning");
    assert.match(adapter?.message ?? "", /adapter/i);
    assert.equal(result.status.needsUserDecision, true);
  });
});

test("doctor reports stale project adapter without CatPaw activation", async () => {
  await withFixture(async (root) => {
    await writeActiveBoard(root);
    await write(
      root,
      "AGENTS.md",
      `# AGENTS.md

General project instructions only.
`,
    );

    const result = await analyzeProject({ projectRoot: root });
    const adapter = result.findings.find(
      (finding) => finding.code === "project-adapter-stale",
    );

    assert.equal(result.ok, true);
    assert.equal(adapter?.severity, "warning");
    assert.match(adapter?.message ?? "", /CatPaw/);
  });
});
