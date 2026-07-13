import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../src/runtime/lib/frontmatter.mjs";
import { parseMilestoneScope } from "../src/runtime/lib/milestone-scope.mjs";
import { analyzeV1ToV2Migration } from "../src/runtime/lib/migrate-v1-v2.mjs";
import {
  createPatchPlan,
  snapshotTree,
} from "../src/runtime/lib/patch-plan.mjs";
import { validateMetadata } from "../src/runtime/lib/schema.mjs";

const DATE = "2026-07-11";
const CLI = fileURLToPath(
  new URL("../src/runtime/bin/catpaw.mjs", import.meta.url),
);

async function writeTree(root, files, directories = []) {
  for (const directory of directories) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function fixture(t, files, directories = []) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-migration-v2-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeTree(root, files, directories);
  return root;
}

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({
      code,
      signal,
      stdout,
      stderr,
    }));
  });
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function frontmatter(fields, body) {
  return [
    "---",
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    "---",
    "",
    body,
  ].join("\n");
}

function readyBoard() {
  return {
    ".catpaw/index.md": frontmatter(
      { runtime: "2.1.7" },
      [
        "# CatPaw Board",
        "",
        "Narrative stays here.",
        "",
        "[Active requirement](reqs/FR-101-alpha.md)",
      ].join("\n"),
    ),
    ".catpaw/reqs/FR-101-alpha.md": frontmatter(
      {
        id: "FR-101",
        type: "feature",
        status: "active",
        level: "L2",
        priority: "high",
        stage: "build",
        created: DATE,
        updated: DATE,
        closed: "null",
      },
      [
        "# FR-101: Alpha",
        "",
        "Plan: [Alpha plan](../plans/active/FR-101-alpha.md)",
        "Notes: [preserved note](../notes/keep.md#detail)",
        "Literal: `../plans/active/FR-101-alpha.md`",
        "Double literal: ``[Alpha plan](../plans/active/FR-101-alpha.md)``",
        "````markdown",
        "```",
        "[Fenced plan](../plans/active/FR-101-alpha.md)",
        "````",
        "````text",
        "````not-a-close",
        "[Still fenced](../plans/active/FR-101-alpha.md)",
        "````",
        "Balanced: [Design](../notes/design(v2).md#part)",
      ].join("\n"),
    ),
    ".catpaw/reqs/BUG-202-fix.md": frontmatter(
      {
        id: "BUG-202",
        type: "bug",
        status: "done",
        level: "L3",
        priority: "null",
        stage: "reflect",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# BUG-202: Fix\n\nTerminal behavior is preserved.",
    ),
    ".catpaw/plans/active/FR-101-alpha.md": frontmatter(
      { req: "FR-101", updated: DATE },
      "# Plan: FR-101 Alpha\n\nWork: [FR-101](../../reqs/FR-101-alpha.md)",
    ),
    ".catpaw/plans/archive/BUG-202-fix.md": frontmatter(
      { req: "BUG-202", updated: DATE, status: "done" },
      "# Plan: BUG-202 Fix\n\nWork: [BUG-202](../../reqs/BUG-202-fix.md)",
    ),
    ".catpaw/milestones/MS-001-alpha.md": frontmatter(
      {
        id: "MS-001",
        status: "active",
        created: DATE,
        updated: DATE,
        closed: "null",
        target: "2026 Q3",
      },
      [
        "# MS-001: Alpha Phase",
        "",
        "## Outcome",
        "",
        "Ship Alpha.",
        "",
        "## Scope",
        "",
        "| Req | Title | Status | Notes |",
        "|---|---|---|---|",
        "| FR-101 | Alpha | active | Keep \\| owner note |",
        "| BUG-202 | Fix | done | Closed safely |",
        "",
        "## Exit Criteria",
        "",
        "- [ ] Verified",
      ].join("\n"),
    ),
    ".catpaw/tests/matrices/FR-101-alpha.md": frontmatter(
      {
        id: "T-101",
        req: "FR-101",
        plan: "FR-101-alpha",
        status: "done",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# Test Matrix: Alpha Tests\n\nReq: [FR-101](../../reqs/FR-101-alpha.md)",
    ),
    ".catpaw/tests/matrices/BUG-202-fix.md": frontmatter(
      {
        id: "T-202",
        req: "BUG-202",
        plan: "BUG-202-fix",
        status: "done",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# Test Matrix: BUG-202 Fix\n\nRegression verification passed for BUG-202.",
    ),
    ".catpaw/reviews/FR-101-alpha/summary.md": frontmatter(
      {
        req: "FR-101",
        plan: "FR-101-alpha",
        status: "done",
        mode: "formal",
        created: DATE,
        updated: DATE,
        closed: DATE,
        independent: "true",
        agent: "Claude",
        lens: "system-contracts",
      },
      "# Review: FR-101 Alpha Review\n\nPlan: [Alpha](../../plans/active/FR-101-alpha.md)",
    ),
    ".catpaw/reviews/BUG-202-fix/summary.md": frontmatter(
      {
        req: "BUG-202",
        plan: "BUG-202-fix",
        status: "done",
        mode: "formal",
        created: DATE,
        updated: DATE,
        closed: DATE,
        independent: "true",
        agent: "Claude",
        lens: "system-contracts",
      },
      "# Review: BUG-202 Fix\n\nIndependent review found no blocking issue.",
    ),
    ".catpaw/research/FR-101-alpha/design.md": frontmatter(
      { req: "FR-101", created: DATE, updated: DATE },
      "# Alpha Research\n\nReq: [FR-101](../../reqs/FR-101-alpha.md)",
    ),
    ".catpaw/research/provider/provider-dialogue.md": frontmatter(
      {
        topic: "provider-check",
        mode: "discuss",
        status: "done",
        created: DATE,
        updated: DATE,
      },
      "# Provider Dialogue: Provider Check\n\nNo provider identity is inferred.",
    ),
    ".catpaw/notes/keep.md": "# Keep\n\nUnknown board note.\n",
    ".catpaw/notes/design(v2).md": "# Design v2\n\n## part\n",
    ".catpaw/assets/blob.bin": Buffer.from([0, 1, 2, 255]),
  };
}

function blockedBoard() {
  return {
    ".catpaw/index.md": frontmatter(
      { runtime: "2.1.7" },
      "# CatPaw Board\n\n[Broken](missing/local.md)",
    ),
    ".catpaw/reqs/FR-101-missing-stage.md": frontmatter(
      {
        id: "FR-101",
        type: "feature",
        status: "active",
        level: "L2",
        created: DATE,
        updated: DATE,
        closed: "null",
      },
      "# FR-101: Missing Stage",
    ),
    ".catpaw/reqs/FR-102-direct.md": frontmatter(
      {
        id: "FR-102",
        type: "feature",
        status: "active",
        level: "L1",
        stage: "build",
        created: DATE,
        updated: DATE,
        closed: "null",
      },
      "# FR-102: Direct",
    ),
    ".catpaw/reqs/FR-103-draft.md": frontmatter(
      {
        id: "FR-103",
        type: "feature",
        status: "draft",
        level: "L2",
        stage: "think",
        created: DATE,
        updated: DATE,
        closed: "null",
      },
      "# FR-103: Draft",
    ),
    ".catpaw/plans/active/FR-101-plan.md": frontmatter(
      { req: "FR-101", updated: DATE },
      "# Plan: FR-101 Active",
    ),
    ".catpaw/plans/archive/FR-101-plan.md": frontmatter(
      { req: "FR-101", updated: DATE },
      "# Plan: FR-101 Archive",
    ),
    ".catpaw/tests/matrices/incomplete.md": frontmatter(
      { req: "FR-101", updated: DATE },
      "No H1 title here.",
    ),
    ".catpaw/reviews/orphan/summary.md": frontmatter(
      { created: DATE, updated: DATE },
      "# Review: Orphan",
    ),
    ".catpaw/lessons.md": "# Lessons\n\n- Never guess migration facts.\n",
  };
}

function historicalProseBoard() {
  return {
    ".catpaw/index.md": frontmatter(
      { runtime: "2.1.7" },
      "# CatPaw Index\n\n## Active Work\n\n_No active work._\n",
    ),
    ".catpaw/reqs/FR-301-old-note.md": [
      "# FR-301: Old Note",
      "",
      "Historical prose without machine metadata.",
    ].join("\n"),
    ".catpaw/plans/archive/FR-301-old-note.md": [
      "# Plan: FR-301 Old Note",
      "",
      "Archived prose without a canonical binding.",
    ].join("\n"),
    ".catpaw/milestones/M1-old-phase.md": [
      "# M1 Old Phase",
      "",
      "Body-only historical milestone.",
    ].join("\n"),
    ".catpaw/research/misc/old-research.md": [
      "# Old Research",
      "",
      "Unbound historical research.",
    ].join("\n"),
    ".catpaw/lessons.md": "# Lessons\n\nReusable corrections and workflow lessons only.\n",
  };
}

function historicalGatedBoard() {
  return {
    ".catpaw/index.md": frontmatter(
      { runtime: "2.1.7" },
      "# CatPaw Index\n\n## Active Work\n\n_No active work._\n",
    ),
    ".catpaw/reqs/BUG-202-historical.md": frontmatter(
      {
        id: "BUG-202",
        type: "bug",
        status: "completed",
        level: "L3",
        stage: "reflect",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# BUG-202: Historical Fix\n\nCompleted before completion Evidence was required.",
    ),
    ".catpaw/reqs/BUG-203-cancelled.md": frontmatter(
      {
        id: "BUG-203",
        type: "bug",
        status: "cancelled",
        level: "L3",
        stage: "reflect",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# BUG-203: Cancelled Fix\n\nCancelled without a completion claim.",
    ),
    ".catpaw/plans/archive/BUG-202-historical.md": frontmatter(
      { req: "BUG-202", updated: DATE, status: "done" },
      "# Plan: BUG-202 Historical Fix\n\nArchived implementation plan.",
    ),
    ".catpaw/milestones/MS-001-history.md": frontmatter(
      {
        id: "MS-001",
        status: "done",
        created: DATE,
        updated: DATE,
        closed: DATE,
        target: "2026 Q2",
      },
      [
        "# MS-001: Historical Phase",
        "",
        "## Scope",
        "",
        "| Req | Title | Status | Notes |",
        "|---|---|---|---|",
        "| BUG-202 | Historical Fix | done | Closed under schema 1 |",
      ].join("\n"),
    ),
    ".catpaw/tests/matrices/BUG-202-historical.md": frontmatter(
      {
        id: "T-202",
        req: "BUG-202",
        status: "done",
        created: DATE,
        updated: DATE,
        closed: DATE,
      },
      "# Test Matrix: BUG-202 Historical Fix\n\nLegacy regression passed.",
    ),
  };
}

function operation(report, type, relativePath) {
  return report.operations.find(
    (item) => item.type === type &&
      (item.path ?? item.to) === relativePath,
  );
}

test("planner infers metadata for historical prose artifacts without user input", async (t) => {
  const root = await fixture(t, historicalProseBoard());
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath,
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  assert.deepEqual(report.blockers, []);
  assert.equal((await snapshotTree(boardPath)).digest, before);
  assert.ok(report.mappings.some((item) =>
    item.from === "reqs/FR-301-old-note.md" &&
    item.to === "work/FR-301-old-note.md"
  ));
  assert.ok(report.mappings.some((item) =>
    item.from === "plans/archive/FR-301-old-note.md" &&
    item.to === "plans/FR-301-old-note.md"
  ));
  assert.ok(report.mappings.some((item) =>
    item.from === "milestones/M1-old-phase.md" &&
    item.to === "milestones/M1-old-phase.md"
  ));
  assert.ok(report.mappings.some((item) =>
    item.from === "research/misc/old-research.md" &&
    item.to.startsWith("evidence/topics/")
  ));
  for (const source of [
    "index.md",
    "lessons.md",
    "reqs/FR-301-old-note.md",
    "plans/archive/FR-301-old-note.md",
    "milestones/M1-old-phase.md",
    "research/misc/old-research.md",
  ]) {
    const entry = report.preservedLegacy.find((item) => item.from === source);
    assert.ok(entry, source);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.equal(entry.to, `legacy/schema-1/${source}`);
    assert.ok(
      operation(report, "move-file", entry.to) ??
        operation(report, "write-file", entry.to),
      source,
    );
  }
  assert.equal(
    report.preservedLegacy.find((item) => item.from === "index.md").disposition,
    "converted",
  );
  assert.equal(
    report.preservedLegacy.find((item) => item.from === "lessons.md").disposition,
    "preserved",
  );
  for (const source of [
    "reqs/FR-301-old-note.md",
    "plans/archive/FR-301-old-note.md",
    "milestones/M1-old-phase.md",
    "research/misc/old-research.md",
  ]) {
    assert.equal(
      report.preservedLegacy.find((item) => item.from === source).disposition,
      "converted",
      source,
    );
  }
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-metadata" &&
    item.path === "reqs/FR-301-old-note.md"
  ));
  const manifestWrite = operation(
    report,
    "write-file",
    "legacy/schema-1/manifest.json",
  );
  const manifest = JSON.parse(manifestWrite.content);
  assert.equal(manifest.schema, 1);
  assert.deepEqual(manifest.entries, report.preservedLegacy);
  const indexWrite = operation(report, "write-file", "index.md");
  assert.match(indexWrite.content, /# CatPaw Index/);
  assert.match(indexWrite.content, /legacy\/schema-1\/manifest\.json/);
  assert.match(indexWrite.content, /<!-- catpaw:active-work:start -->/);
  const patch = await createPatchPlan({ root: boardPath, operations: report.operations });
  assert.equal(patch.status, "ready", JSON.stringify(patch.blockers));
});

test("planner binds body-only nested Evidence from a canonical path segment", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/reviews/FR-301-old-note/summary.md"] = [
    "# Historical Review",
    "",
    "Review evidence without frontmatter or an ID in the basename.",
  ].join("\n");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  const mapping = report.mappings.find((item) =>
    item.from === "reviews/FR-301-old-note/summary.md"
  );
  assert.equal(mapping.id, "FR-301");
  assert.match(mapping.to, /^evidence\/FR-301\//);
  const write = operation(report, "write-file", mapping.to);
  assert.equal(parseFrontmatter(write.content).data.work, "FR-301");
});

test("planner shares one scoped status across compact grouped Work IDs", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": frontmatter(
      { runtime: "2.1.7" },
      [
        "# CatPaw Index",
        "",
        "## Historical Status",
        "",
        "- FR-401/402/403 已完成。",
      ].join("\n"),
    ),
    ".catpaw/reqs/FR-401-first.md": "# FR-401 First\n",
    ".catpaw/reqs/FR-402-second.md": "# FR-402 Second\n",
    ".catpaw/reqs/FR-403-third.md": "# FR-403 Third\n",
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  for (const [id, filename] of [
    ["FR-401", "FR-401-first.md"],
    ["FR-402", "FR-402-second.md"],
    ["FR-403", "FR-403-third.md"],
  ]) {
    const write = operation(report, "write-file", `work/${filename}`);
    const metadata = parseFrontmatter(write.content).data;
    assert.equal(metadata.id, id);
    assert.equal(metadata.status, "done");
    assert.equal(metadata.stage, "reflect");
  }
});

test("planner never turns negated terminal language into completion", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/reqs/FR-410-negated.md": [
      "# FR-410 Negated",
      "",
      "## 状态",
      "",
      "尚未完成，也未取消。",
    ].join("\n"),
    ".catpaw/reqs/FR-411-not-done.md": [
      "# FR-411 Not Done",
      "",
      "## Status",
      "",
      "Not done and not cancelled.",
    ].join("\n"),
    ".catpaw/reqs/FR-412-partial.md": [
      "# FR-412 Partial",
      "",
      "## 状态",
      "",
      "尚未完成，已实现部分功能。",
    ].join("\n"),
    ".catpaw/reqs/FR-413-active-partial.md": [
      "# FR-413 Active Partial",
      "",
      "## 状态",
      "",
      "- 进行中，已实现部分功能。",
    ].join("\n"),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  for (const [filename, status] of [
    ["FR-410-negated.md", "blocked"],
    ["FR-411-not-done.md", "blocked"],
    ["FR-412-partial.md", "blocked"],
    ["FR-413-active-partial.md", "active"],
  ]) {
    const metadata = parseFrontmatter(
      operation(report, "write-file", `work/${filename}`).content,
    ).data;
    assert.equal(metadata.status, status);
    assert.equal(metadata.closed, null);
  }
});

test("planner keeps an explicit completed table cell terminal despite follow-up wording", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/reqs/FR-414-complete.md": "# FR-414 Complete\n",
    ".catpaw/milestones/M1-complete.md": [
      "# M1 Complete",
      "",
      "## Scope",
      "",
      "| FR | Title | Result |",
      "|---|---|---|",
      "| FR-414 | Complete | 已完成：主链路交付；后续优化另行立项 |",
    ].join("\n"),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  const metadata = parseFrontmatter(
    operation(report, "write-file", "work/FR-414-complete.md").content,
  ).data;
  assert.equal(metadata.status, "done");
});

test("planner uses real bindings for stage without treating draft artifacts as done", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/reqs/FR-420-draft.md": "# FR-420 Draft\n",
    ".catpaw/plans/archive/draft-plan.md": frontmatter(
      { req: "FR-420" },
      "# Draft Plan\n",
    ),
    ".catpaw/tests/matrices/draft-matrix.md": frontmatter(
      { req: "FR-420" },
      "# Draft Matrix\n\nPending execution.\n",
    ),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  const metadata = parseFrontmatter(
    operation(report, "write-file", "work/FR-420-draft.md").content,
  ).data;
  assert.equal(metadata.status, "blocked");
  assert.equal(metadata.stage, "test");
});

test("planner excludes Out of Scope and keeps the positive Milestone Scope", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/reqs/FR-430-excluded.md": "# FR-430 Excluded\n",
    ".catpaw/reqs/FR-431-included.md": "# FR-431 Included\n",
    ".catpaw/milestones/M1-scope.md": [
      "# M1 Scope",
      "",
      "## Out of Scope",
      "",
      "- FR-430",
      "",
      "## Scope",
      "",
      "- FR-431",
    ].join("\n"),
    ".catpaw/milestones/M2-only-exclusions.md": [
      "# M2 Only Exclusions",
      "",
      "## Out of Scope",
      "",
      "- FR-430",
    ].join("\n"),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  const milestone = parseFrontmatter(
    operation(report, "write-file", "milestones/M1-scope.md").content,
  );
  assert.deepEqual(
    parseMilestoneScope(milestone.body).rows.map((row) => row.id),
    ["FR-431"],
  );
  const exclusions = parseFrontmatter(
    operation(report, "write-file", "milestones/M2-only-exclusions.md").content,
  );
  assert.deepEqual(parseMilestoneScope(exclusions.body).rows, []);
});

test("planner blocks malformed managed Milestone Scope markers", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/milestones/M1-broken.md": [
      "# M1 Broken",
      "",
      "<!-- catpaw:milestone-scope:start -->",
    ].join("\n"),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((item) =>
    item.code === "malformed-milestone-scope" &&
    item.path === "milestones/M1-broken.md"
  ));
  assert.deepEqual(report.operations, []);
});

test("planner merges conflicting Milestone statuses conservatively", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": "# CatPaw Index\n",
    ".catpaw/reqs/FR-440-shared.md": "# FR-440 Shared\n",
    ".catpaw/milestones/M1-done.md": frontmatter(
      { id: "M1", status: "done" },
      "# M1 Done\n\n## Scope\n\n| FR-440 | Shared | done | |\n",
    ),
    ".catpaw/milestones/M2-active.md": frontmatter(
      { id: "M2", status: "active" },
      "# M2 Active\n\n## Scope\n\n| FR-440 | Shared | active | |\n",
    ),
  });

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    migrationDate: DATE,
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  const metadata = parseFrontmatter(
    operation(report, "write-file", "work/FR-440-shared.md").content,
  ).data;
  assert.equal(metadata.status, "active");
  assert.ok(report.warnings.some((item) =>
    item.code === "conflicting-milestone-status" &&
    item.path === "reqs/FR-440-shared.md"
  ));
});

test("migration apply keeps legacy bytes and exposes inferred artifacts in schema 2", async (t) => {
  const files = historicalProseBoard();
  const originalIndex = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(files[".catpaw/index.md"]),
  ]);
  files[".catpaw/index.md"] = originalIndex;
  const root = await fixture(t, files);
  const boardPath = path.join(root, ".catpaw");
  const catpawHome = path.join(root, "runtime-home");
  const original = files[".catpaw/reqs/FR-301-old-note.md"];

  const applied = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], { cwd: root, env: { CATPAW_HOME: catpawHome } });

  assert.equal(applied.code, 0, applied.stderr || applied.stdout);
  const archivedIndex = await readFile(
    path.join(boardPath, "legacy/schema-1/index.md"),
  );
  assert.deepEqual(archivedIndex, originalIndex);
  const legacyManifest = JSON.parse(
    await readFile(
      path.join(boardPath, "legacy/schema-1/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(
    legacyManifest.entries.find((item) => item.from === "index.md").sha256,
    createHash("sha256").update(originalIndex).digest("hex"),
  );
  assert.equal(
    await readFile(
      path.join(boardPath, "legacy/schema-1/reqs/FR-301-old-note.md"),
      "utf8",
    ),
    original,
  );
  assert.equal(await exists(path.join(boardPath, "reqs")), false);
  const status = await runCli([
    "board",
    "status",
    "--project",
    root,
    "--json",
  ], { cwd: root });
  assert.equal(status.code, 0, status.stderr || status.stdout);
  const statusReport = JSON.parse(status.stdout);
  assert.equal(statusReport.schema, 2);
  assert.deepEqual(statusReport.counts.active, {
    milestones: 1,
    work: 1,
    plans: 1,
  });
  const migratedWork = parseFrontmatter(
    await readFile(path.join(boardPath, "work/FR-301-old-note.md"), "utf8"),
  );
  assert.equal(migratedWork.data.status, "blocked");
  assert.equal(statusReport.findings.length, 0);
});

test("migration converts historical Gated Work and records a completion gap", async (t) => {
  const files = historicalGatedBoard();
  const root = await fixture(t, files);
  const boardPath = path.join(root, ".catpaw");
  const catpawHome = path.join(root, "runtime-home");
  const historicalSources = [
    "milestones/MS-001-history.md",
    "reqs/BUG-202-historical.md",
    "plans/archive/BUG-202-historical.md",
    "tests/matrices/BUG-202-historical.md",
  ];

  const report = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });

  assert.equal(report.status, "ready");
  assert.deepEqual(report.blockers, []);
  assert.equal(
    historicalSources.every((source) => report.mappings.some((item) => item.from === source)),
    true,
  );
  assert.ok(report.mappings.some((item) =>
    item.from === "reqs/BUG-203-cancelled.md" &&
    item.to === "work/BUG-203-cancelled.md"
  ));
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-completion-gap" &&
    item.path === "reqs/BUG-202-historical.md" &&
    item.message.includes("independent-review-or-provider")
  ));
  for (const source of historicalSources) {
    const archived = report.preservedLegacy.find((item) => item.from === source);
    assert.equal(archived.disposition, "converted", source);
    assert.ok(
      operation(report, "move-file", archived.to) ??
        operation(report, "write-file", archived.to),
      source,
    );
  }
  assert.ok(operation(
    report,
    "write-file",
    `evidence/BUG-202/${DATE}-reflection-accepted-gap.md`,
  ));

  const applied = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], { cwd: root, env: { CATPAW_HOME: catpawHome } });

  assert.equal(applied.code, 0, applied.stderr || applied.stdout);
  for (const source of historicalSources) {
    assert.equal(
      await exists(path.join(boardPath, source)),
      source.startsWith("milestones/"),
      source,
    );
    assert.equal(
      await readFile(path.join(boardPath, "legacy/schema-1", source), "utf8"),
      files[`.catpaw/${source}`],
      source,
    );
  }
  assert.equal(
    await exists(path.join(
      boardPath,
      `evidence/BUG-202/${DATE}-reflection-accepted-gap.md`,
    )),
    true,
  );
  const cancelled = parseFrontmatter(
    await readFile(path.join(boardPath, "work/BUG-203-cancelled.md"), "utf8"),
  );
  assert.equal(cancelled.data.status, "cancelled");
  const status = await runCli([
    "board",
    "status",
    "--project",
    root,
    "--json",
  ], { cwd: root });
  assert.equal(status.code, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).findings.length, 0);
});

test("planner infers a missing stage for active Work without blocking", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/index.md"] = frontmatter(
    { runtime: "2.1.7" },
    [
      "# CatPaw Index",
      "",
      "## Active Work",
      "",
      "| ID | Title | Status | Links |",
      "|---|---|---|---|",
      "| FR-101 | Active Work | active | [Req](reqs/FR-101-active.md) |",
    ].join("\n"),
  );
  files[".catpaw/reqs/FR-101-active.md"] = frontmatter(
    {
      id: "FR-101",
      type: "feature",
      status: "active",
      level: "L2",
      created: DATE,
      updated: DATE,
      closed: "null",
    },
    "# FR-101: Active Work",
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  assert.deepEqual(report.blockers, []);
  const work = parseFrontmatter(
    operation(report, "write-file", "work/FR-101-active.md").content,
  );
  assert.equal(work.data.stage, "think");
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-metadata" &&
    item.path === "reqs/FR-101-active.md" &&
    item.message.includes("stage")
  ));
});

test("planner blocks active Work identity conflicts even when frontmatter is terminal", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/index.md"] = frontmatter(
    { runtime: "2.1.7" },
    "# CatPaw Index\n\n## Active Work\n\n- FR-101\n",
  );
  files[".catpaw/reqs/FR-101-active.md"] = frontmatter(
    {
      id: "BUG-202",
      type: "bug",
      status: "done",
      level: "L2",
      stage: "reflect",
      created: DATE,
      updated: DATE,
      closed: DATE,
    },
    "# BUG-202: Conflicting Identity",
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((item) =>
    item.code === "work-identity-conflict" &&
    item.path === "reqs/FR-101-active.md"
  ));
});

test("planner reconciles stale Milestone routing but blocks identity conflicts", async (t) => {
  const terminalFiles = readyBoard();
  terminalFiles[".catpaw/index.md"] += "\n## Active Milestones\n\n- MS-001\n";
  terminalFiles[".catpaw/milestones/MS-001-alpha.md"] = terminalFiles[
    ".catpaw/milestones/MS-001-alpha.md"
  ]
    .replace("status: active", "status: done")
    .replace("closed: null", "closed: " + DATE);
  const terminalRoot = await fixture(t, terminalFiles);

  const terminal = await analyzeV1ToV2Migration({
    projectRoot: terminalRoot,
    boardPath: path.join(terminalRoot, ".catpaw"),
  });

  assert.equal(terminal.status, "ready", JSON.stringify(terminal.blockers));
  assert.ok(terminal.warnings.some((item) =>
    item.code === "stale-active-routing" &&
    item.path === "milestones/MS-001-alpha.md"
  ));

  const identityFiles = readyBoard();
  identityFiles[".catpaw/index.md"] += "\n## Active Milestones\n\n- MS-001\n";
  identityFiles[".catpaw/milestones/MS-001-alpha.md"] = identityFiles[
    ".catpaw/milestones/MS-001-alpha.md"
  ].replace("id: MS-001", "id: MS-002");
  const identityRoot = await fixture(t, identityFiles);

  const identity = await analyzeV1ToV2Migration({
    projectRoot: identityRoot,
    boardPath: path.join(identityRoot, ".catpaw"),
  });

  assert.equal(identity.status, "blocked");
  assert.ok(identity.blockers.some((item) =>
    item.code === "milestone-identity-conflict"
  ));
});

test("active Milestone scope reaches Work while metadata is inferred", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/index.md"] = frontmatter(
    { runtime: "2.1.7" },
    "# CatPaw Index\n\n## Active Milestones\n\n- MS-002\n",
  );
  files[".catpaw/reqs/FR-101-active.md"] = frontmatter(
    {
      id: "FR-101",
      type: "feature",
      status: "active",
      level: "L2",
      created: DATE,
      updated: DATE,
      closed: "null",
    },
    "# FR-101: Active Through Milestone",
  );
  files[".catpaw/plans/active/FR-101-active.md"] = frontmatter(
    { req: "FR-101", updated: DATE },
    "# Plan: FR-101 Active Through Milestone",
  );
  files[".catpaw/milestones/MS-002-active.md"] = frontmatter(
    {
      id: "MS-002",
      status: "active",
      created: DATE,
      updated: DATE,
      closed: "null",
      target: "Migration safety",
    },
    [
      "# MS-002: Active Migration",
      "",
      "## Scope",
      "",
      "| Req | Title | Status | Notes |",
      "|---|---|---|---|",
      "| FR-101 | Active Through Milestone | active | Root blocker only |",
    ].join("\n"),
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  assert.deepEqual(report.blockers, []);
  const work = parseFrontmatter(
    operation(report, "write-file", "work/FR-101-active.md").content,
  );
  assert.equal(work.data.stage, "plan");
  const milestone = operation(report, "write-file", "milestones/MS-002-active.md");
  assert.match(milestone.content, /<!-- catpaw:milestone-scope:start -->/);
  assert.match(milestone.content, /\| FR-101 \| Active Through Milestone \| active \|/);
});

test("planner falls back to a canonical Work ID in the H1", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/index.md"] = frontmatter(
    { runtime: "2.1.7" },
    "# CatPaw Index\n\n## Active Work\n\n- FR-999\n",
  );
  files[".catpaw/reqs/garbage-FR-999-copy.md"] = frontmatter(
    {
      type: "feature",
      status: "active",
      level: "L2",
      stage: "build",
      created: DATE,
      updated: DATE,
      closed: "null",
    },
    "# FR-999 Misleading Filename",
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  assert.equal(
    report.mappings.some((item) => item.id === "FR-999"),
    true,
  );
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-metadata" &&
    item.path === "reqs/garbage-FR-999-copy.md" &&
    item.message.includes("id")
  ));
  assert.match(
    operation(report, "write-file", "index.md").content,
    /\| FR-999 \| Misleading Filename \|/,
  );
});

test("planner blocks malformed frontmatter instead of treating it as missing", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/reqs/FR-301-old-note.md"] = [
    "---",
    "id: [broken",
    "---",
    "# FR-301: Old Note",
  ].join("\n");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) =>
    item.code === "invalid-frontmatter" &&
    item.path === "reqs/FR-301-old-note.md"
  ));
});

test("planner canonically normalizes terminal Work and path bindings", async (t) => {
  const files = historicalProseBoard();
  files[".catpaw/reqs/FR-101-completed.md"] = frontmatter(
    {
      type: "FR",
      status: "completed",
      level: "L2",
      created: DATE,
      updated: DATE,
      closed: DATE,
    },
    "# FR-101: Completed Work",
  );
  files[".catpaw/plans/archive/FR-101-completed.md"] = frontmatter(
    { req: "../../reqs/FR-101-completed.md", updated: DATE },
    "# Plan: FR-101 Completed Work",
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  const workWrite = operation(report, "write-file", "work/FR-101-completed.md");
  const work = parseFrontmatter(workWrite.content);
  assert.deepEqual(work.data, {
    id: "FR-101",
    type: "feature",
    mode: "tracked",
    status: "done",
    stage: "reflect",
    created: DATE,
    updated: DATE,
    closed: DATE,
  });
  const planWrite = operation(report, "write-file", "plans/FR-101-completed.md");
  assert.equal(parseFrontmatter(planWrite.content).data.work, "FR-101");
  for (const code of [
    "normalized-work-type",
    "normalized-work-status",
    "normalized-plan-binding",
  ]) {
    assert.ok(report.warnings.some((item) => item.code === code), code);
  }
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-metadata" &&
    item.path === "reqs/FR-101-completed.md" &&
    item.message.includes("id") &&
    item.message.includes("stage")
  ));
});

test("planner maps a fully explicit schema 1 board without writing", async (t) => {
  const root = await fixture(
    t,
    readyBoard(),
    [".catpaw/scratch/empty", ".catpaw/evidence/topics"],
  );
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const report = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });

  assert.equal(report.status, "ready");
  assert.equal(report.fromSchema, 1);
  assert.equal(report.toSchema, 2);
  assert.deepEqual(report.blockers, []);
  assert.ok(report.operations.length > 0);
  assert.deepEqual(await analyzeV1ToV2Migration({ projectRoot: root, boardPath }), report);
  assert.equal((await snapshotTree(boardPath)).digest, before);
  assert.deepEqual(
    report.preservedUnknown,
    [
      "assets/blob.bin",
      "notes/design(v2).md",
      "notes/keep.md",
      "scratch/empty/",
    ],
  );
  assert.ok(report.warnings.some((item) => item.code === "dropped-field"));
  assert.ok(report.mappings.some((item) =>
    item.from === "reqs/FR-101-alpha.md" && item.to === "work/FR-101-alpha.md"
  ));
  assert.ok(report.mappings.some((item) =>
    item.from === "research/provider/provider-dialogue.md" &&
    item.to.startsWith("evidence/topics/2026-07-11-provider-")
  ));
  assert.ok(report.linkRewrites.some((item) =>
    item.from === "reqs/FR-101-alpha.md" &&
    item.oldTarget === "../plans/active/FR-101-alpha.md" &&
    item.newTarget === "../plans/FR-101-alpha.md"
  ));

  const workWrite = operation(report, "write-file", "work/FR-101-alpha.md");
  const work = parseFrontmatter(workWrite.content);
  assert.deepEqual(validateMetadata("workItem", work.data), []);
  assert.equal(work.data.mode, "tracked");
  assert.equal(work.data.stage, "build");
  assert.match(work.body, /\[Alpha plan]\(\.\.\/plans\/FR-101-alpha\.md\)/);
  assert.match(work.body, /`\.\.\/plans\/active\/FR-101-alpha\.md`/);
  assert.match(
    work.body,
    /``\[Alpha plan]\(\.\.\/plans\/active\/FR-101-alpha\.md\)``/,
  );
  assert.match(
    work.body,
    /````markdown\n```\n\[Fenced plan]\(\.\.\/plans\/active\/FR-101-alpha\.md\)\n````/,
  );
  assert.match(
    work.body,
    /````text\n````not-a-close\n\[Still fenced]\(\.\.\/plans\/active\/FR-101-alpha\.md\)\n````/,
  );
  assert.match(work.body, /\[Design]\(\.\.\/notes\/design\(v2\)\.md#part\)/);
  assert.match(work.body, /\[preserved note]\(\.\.\/notes\/keep\.md#detail\)/);

  const milestoneWrite = operation(
    report,
    "write-file",
    "milestones/MS-001-alpha.md",
  );
  assert.equal(milestoneWrite.mode, "replace");
  assert.match(milestoneWrite.content, /<!-- catpaw:milestone-scope:start -->/);
  assert.match(milestoneWrite.content, /\| FR-101 \| Alpha \| active \| Keep \\\| owner note \|/);
  assert.match(milestoneWrite.content, /\| BUG-202 \| Fix \| done \| Closed safely \|/);

  const reviewMapping = report.mappings.find(
    (item) => item.kind === "review" && item.from.includes("FR-101-alpha"),
  );
  const reviewWrite = operation(report, "write-file", reviewMapping.to);
  const review = parseFrontmatter(reviewWrite.content);
  assert.deepEqual(validateMetadata("evidence", review.data), []);
  assert.equal(review.data.work, "FR-101");
  assert.equal(review.data.independent, true);
  assert.equal(review.data.agent, "Claude");

  const indexWrite = operation(report, "write-file", "index.md");
  const index = parseFrontmatter(indexWrite.content);
  assert.deepEqual(index.data, { schema: 2 });
  assert.match(index.body, /legacy\/schema-1\/manifest\.json/);
  assert.match(index.body, /<!-- catpaw:active-work:start -->/);
  const legacyIndex = operation(report, "write-file", "legacy/schema-1/index.md");
  assert.match(legacyIndex.content, /Narrative stays here\./);
  assert.match(legacyIndex.content, /\[Active requirement]\(reqs\/FR-101-alpha\.md\)/);
  assert.equal(report.operations.some((item) => item.type === "move-file"), true);

  const patch = await createPatchPlan({ root: boardPath, operations: report.operations });
  assert.equal(patch.status, "ready");
  assert.deepEqual(patch.blockers, []);
});

test("planner blocks duplicate Milestone IDs", async (t) => {
  const files = readyBoard();
  files[".catpaw/milestones/MS-001-duplicate.md"] = frontmatter(
    {
      id: "MS-001",
      status: "active",
      created: DATE,
      updated: DATE,
      closed: "null",
      target: "2026 Q4",
    },
    [
      "# MS-001: Duplicate Phase",
      "",
      "## Scope",
      "",
      "| Req | Title | Status | Notes |",
      "|---|---|---|---|",
      "| FR-101 | Alpha | active | Duplicate owner |",
    ].join("\n"),
  );
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) => item.code === "duplicate-milestone-id"));
});

test("planner converts draft Plan and Evidence without treating status as metadata", async (t) => {
  const files = readyBoard();
  files[".catpaw/plans/active/FR-101-alpha.md"] = files[
    ".catpaw/plans/active/FR-101-alpha.md"
  ].replace(`updated: ${DATE}`, `status: draft\nupdated: ${DATE}`);
  files[".catpaw/reviews/FR-101-alpha/summary.md"] = files[
    ".catpaw/reviews/FR-101-alpha/summary.md"
  ].replace("status: done", "status: draft");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready", JSON.stringify(report.blockers));
  assert.deepEqual(report.blockers, []);
  assert.ok(report.mappings.some((item) =>
    item.from === "plans/active/FR-101-alpha.md"
  ));
  assert.ok(report.mappings.some((item) =>
    item.from === "reviews/FR-101-alpha/summary.md"
  ));
  assert.equal(
    report.preservedLegacy.find(
      (item) => item.from === "reviews/FR-101-alpha/summary.md",
    ).disposition,
    "converted",
  );
  assert.ok(report.warnings.some((item) =>
    item.code === "dropped-field" &&
    item.path === "reviews/FR-101-alpha/summary.md"
  ));
});

test("planner isolates preserved empty directories under legacy roots", async (t) => {
  const root = await fixture(t, readyBoard(), [".catpaw/research/empty"]);
  await chmod(path.join(root, ".catpaw/research/empty"), 0o710);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  assert.equal(
    operation(report, "ensure-dir", "legacy/schema-1/research/empty").dirMode,
    0o710,
  );
  assert.ok(operation(report, "remove-dir", "research/empty"));
});

test("planner blocks conflicting Plan and Evidence bindings", async (t) => {
  const files = readyBoard();
  files[".catpaw/plans/active/FR-101-alpha.md"] = files[
    ".catpaw/plans/active/FR-101-alpha.md"
  ].replace("req: FR-101", "work: BUG-202\nreq: FR-101");
  files[".catpaw/reviews/FR-101-alpha/summary.md"] = files[
    ".catpaw/reviews/FR-101-alpha/summary.md"
  ].replace("req: FR-101", "work: BUG-202\nreq: FR-101");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) => item.code === "conflicting-plan-work"));
  assert.equal(report.blockers.some((item) => item.code === "conflicting-evidence-work"), true);
  assert.equal(
    report.preservedLegacy.find(
      (item) => item.from === "reviews/FR-101-alpha/summary.md",
    ).disposition,
    "preserved",
  );
});

test("planner rewrites links in preserved unknown Markdown", async (t) => {
  const files = readyBoard();
  files[".catpaw/notes/keep.md"] = [
    "# Keep",
    "",
    "Unknown note for [Alpha](../reqs/FR-101-alpha.md).",
  ].join("\n");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  const rewrite = operation(report, "write-file", "notes/keep.md");
  assert.equal(rewrite.mode, "replace");
  assert.match(rewrite.content, /\[Alpha]\(\.\.\/work\/FR-101-alpha\.md\)/);
  assert.ok(report.linkRewrites.some((item) =>
    item.from === "notes/keep.md" &&
    item.oldTarget === "../reqs/FR-101-alpha.md" &&
    item.newTarget === "../work/FR-101-alpha.md"
  ));
});

test("planner preserves project-local links outside the board and blocks project escapes", async (t) => {
  const files = readyBoard();
  files["docs/guide.md"] = "# Guide\n";
  files[".catpaw/reqs/FR-101-alpha.md"] +=
    "\nProject guide: [Guide](../../docs/guide.md)\n";
  files[".catpaw/plans/active/FR-101-alpha.md"] +=
    "\nProject guide: [Guide](../../../docs/guide.md)\n";
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  assert.match(
    operation(report, "write-file", "work/FR-101-alpha.md").content,
    /\[Guide]\(\.\.\/\.\.\/docs\/guide\.md\)/,
  );
  assert.match(
    operation(report, "write-file", "plans/FR-101-alpha.md").content,
    /\[Guide]\(\.\.\/\.\.\/docs\/guide\.md\)/,
  );
  assert.ok(report.linkRewrites.some((item) =>
    item.from === "plans/active/FR-101-alpha.md" &&
    item.oldTarget === "../../../docs/guide.md" &&
    item.newTarget === "../../docs/guide.md"
  ));

  const escaping = readyBoard();
  escaping[".catpaw/reqs/FR-101-alpha.md"] +=
    "\nOutside: [Outside](../../../outside.md)\n";
  const escapingRoot = await fixture(t, escaping);
  const blocked = await analyzeV1ToV2Migration({
    projectRoot: escapingRoot,
    boardPath: path.join(escapingRoot, ".catpaw"),
  });
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.blockers.some((item) => item.code === "link-escapes-project"));

  const missing = readyBoard();
  missing[".catpaw/reqs/FR-101-alpha.md"] +=
    "\nMissing: [Missing](../../docs/missing.md)\n";
  const missingRoot = await fixture(t, missing);
  const missingReport = await analyzeV1ToV2Migration({
    projectRoot: missingRoot,
    boardPath: path.join(missingRoot, ".catpaw"),
  });
  assert.equal(missingReport.status, "blocked");
  assert.ok(missingReport.blockers.some((item) =>
    item.code === "broken-project-link"
  ));

  const symlinkFiles = readyBoard();
  symlinkFiles[".catpaw/reqs/FR-101-alpha.md"] +=
    "\nSymlink escape: [Outside](../../docs/outside.md)\n";
  const symlinkRoot = await fixture(t, symlinkFiles);
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "catpaw-outside-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideFile = path.join(outsideRoot, "outside.md");
  await writeFile(outsideFile, "# Outside\n");
  await mkdir(path.join(symlinkRoot, "docs"), { recursive: true });
  await symlink(outsideFile, path.join(symlinkRoot, "docs/outside.md"));
  const symlinkReport = await analyzeV1ToV2Migration({
    projectRoot: symlinkRoot,
    boardPath: path.join(symlinkRoot, ".catpaw"),
  });
  assert.equal(symlinkReport.status, "blocked");
  assert.ok(symlinkReport.blockers.some((item) =>
    item.code === "link-escapes-project"
  ));
});

test("planner blocks an occupied dynamic Evidence directory", async (t) => {
  const files = readyBoard();
  files[".catpaw/evidence/FR-101"] = "occupied by a file\n";
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) =>
    item.code === "migration-target-occupied" && item.path === "evidence/FR-101"
  ));
});

test("planner blocks non-UTF-8 unknown Markdown rather than corrupting it", async (t) => {
  const files = readyBoard();
  files[".catpaw/notes/blob.md"] = Buffer.concat([
    Buffer.from("# Blob\n\n[Alpha](../reqs/FR-101-alpha.md)\n"),
    Buffer.from([0xff, 0xfe]),
  ]);
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) =>
    item.code === "non-utf8-unknown-markdown" && item.path === "notes/blob.md"
  ));
});

test("planner fatally decodes every known schema 1 Markdown class", async (t) => {
  const cases = [
    ".catpaw/index.md",
    ".catpaw/reqs/FR-101-alpha.md",
    ".catpaw/plans/active/FR-101-alpha.md",
    ".catpaw/milestones/MS-001-alpha.md",
    ".catpaw/tests/matrices/FR-101-alpha.md",
    ".catpaw/reviews/FR-101-alpha/summary.md",
    ".catpaw/research/FR-101-alpha/design.md",
    ".catpaw/lessons.md",
  ];

  for (const relativePath of cases) {
    const files = readyBoard();
    files[relativePath] = Buffer.concat([
      Buffer.from(files[relativePath] ?? "# Lessons\n"),
      Buffer.from([0xff]),
    ]);
    const root = await fixture(t, files);
    const boardPath = path.join(root, ".catpaw");
    const boardRelativePath = relativePath.slice(".catpaw/".length);
    const before = (await snapshotTree(boardPath)).digest;

    const report = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });

    assert.equal(report.status, "blocked", relativePath);
    assert.deepEqual(report.operations, [], relativePath);
    assert.ok(
      report.blockers.some((item) =>
        item.code === "non-utf8-known-markdown" &&
        item.path === boardRelativePath
      ),
      `${relativePath}: ${JSON.stringify(report.blockers)}`,
    );
    assert.equal((await snapshotTree(boardPath)).digest, before, relativePath);
    assert.deepEqual(
      await analyzeV1ToV2Migration({ projectRoot: root, boardPath }),
      report,
      relativePath,
    );
  }
});

test("planner normalizes a non-boolean independent fact without dropping Evidence", async (t) => {
  const files = readyBoard();
  files[".catpaw/reviews/FR-101-alpha/summary.md"] = files[
    ".catpaw/reviews/FR-101-alpha/summary.md"
  ].replace("independent: true", "independent: yes");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  assert.equal(
    report.mappings.some((item) => item.from === "reviews/FR-101-alpha/summary.md"),
    true,
  );
  assert.equal(
    report.preservedLegacy.find(
      (item) => item.from === "reviews/FR-101-alpha/summary.md",
    ).disposition,
    "converted",
  );
  const review = report.operations.find((item) =>
    item.type === "write-file" &&
    item.path.startsWith("evidence/FR-101/") &&
    item.path.includes("-review-")
  );
  assert.equal(parseFrontmatter(review.content).data.independent, false);
  assert.ok(report.warnings.some((item) =>
    item.code === "inferred-metadata" &&
    item.path === "reviews/FR-101-alpha/summary.md" &&
    item.message.includes("independent")
  ));
});

test("planner returns sorted blockers and no operations when facts are ambiguous", async (t) => {
  const root = await fixture(t, blockedBoard());
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const report = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });

  assert.equal(report.status, "blocked");
  assert.equal(report.fromSchema, 1);
  assert.deepEqual(report.operations, []);
  assert.equal((await snapshotTree(boardPath)).digest, before);
  const codes = new Set(report.blockers.map((item) => item.code));
  assert.equal(codes.has("broken-local-link"), true);
  assert.equal(codes.has("active-work-incomplete"), false);
  assert.equal(
    report.blockers.some((item) =>
      /generated-frontmatter|missing-evidence|substantive-lessons/.test(item.code)
    ),
    false,
  );
  assert.deepEqual(
    report.blockers,
    [...report.blockers].sort((left, right) =>
      `${left.path}\0${left.code}\0${left.message}`.localeCompare(
        `${right.path}\0${right.code}\0${right.message}`,
        "en",
      )
    ),
  );
});

test("planner returns an exact no-op for a schema 2 board", async (t) => {
  const root = await fixture(
    t,
    {
      ".catpaw/index.md": "---\nschema: 2\n---\n\n# CatPaw Board\n",
    },
    [
      ".catpaw/milestones",
      ".catpaw/work",
      ".catpaw/plans",
      ".catpaw/evidence/topics",
    ],
  );
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const report = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });

  assert.deepEqual(report, {
    status: "noop",
    fromSchema: 2,
    toSchema: 2,
    operations: [],
    mappings: [],
    blockers: [],
    warnings: [],
    preservedLegacy: [],
    preservedUnknown: [],
    linkRewrites: [],
  });
  assert.equal((await snapshotTree(boardPath)).digest, before);
});

test("board migrate refuses an invalid schema 2 board instead of claiming no-op", async (t) => {
  const root = await fixture(t, {});
  const initialized = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ], { cwd: root });
  assert.equal(initialized.code, 0, initialized.stderr || initialized.stdout);
  const boardPath = path.join(root, ".catpaw");
  await writeFile(
    path.join(boardPath, "work/FR-101-invalid.md"),
    frontmatter(
      {
        id: "FR-101",
        type: "feature",
        mode: "tracked",
        status: "invalid",
        stage: "build",
        created: DATE,
        updated: DATE,
        closed: "null",
      },
      "# Invalid Work",
    ),
  );
  const before = (await snapshotTree(boardPath)).digest;

  const result = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--json",
  ], { cwd: root });

  assert.equal(result.code, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "blocked");
  assert.equal(report.patch, null);
  assert.equal(report.backupPath, null);
  assert.match(report.nextAction, /board doctor/i);
  assert.ok(report.blockers.some((item) => item.path.includes("FR-101-invalid.md")));
  assert.equal((await snapshotTree(boardPath)).digest, before);
});

test("board migrate defaults to a read-only deterministic preview", async (t) => {
  const root = await fixture(t, readyBoard());
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const result = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "board migrate");
  assert.equal(report.mode, "dry-run");
  assert.equal(report.status, "preview");
  assert.equal(report.fromSchema, 1);
  assert.equal(report.toSchema, 2);
  assert.equal(report.patch.status, "ready");
  assert.ok(report.patch.operationCount > 0);
  assert.equal(report.backupPath, null);
  assert.equal(report.nextAction, "Run board migrate --apply to migrate the board.");
  assert.equal((await snapshotTree(boardPath)).digest, before);
  assert.equal(await exists(path.join(catpawHome, "backups")), false);

  const repeated = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });
  assert.deepEqual(JSON.parse(repeated.stdout), report);

  const human = await runCli([
    "board",
    "migrate",
    "--project",
    root,
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });
  assert.equal(human.code, 0, human.stderr || human.stdout);
  assert.equal(human.stderr, "");
  assert.match(human.stdout, /^Board migrate\nMode: dry-run\nStatus: preview\n/);
  assert.match(human.stdout, /Schema: 1 -> 2\n/);
  assert.match(human.stdout, /Patch:\nREADY\n/);
  assert.match(
    human.stdout,
    /Next: Run board migrate --apply to migrate the board\.\n$/,
  );
});

test("board migrate --apply validates, backs up, and becomes an exact no-op", async (t) => {
  const root = await fixture(t, readyBoard());
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const applied = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });

  assert.equal(applied.code, 0, applied.stderr || applied.stdout);
  assert.equal(applied.stderr, "");
  const report = JSON.parse(applied.stdout);
  assert.equal(report.status, "applied");
  assert.equal(report.mode, "apply");
  assert.equal(report.fromSchema, 1);
  assert.equal(report.toSchema, 2);
  assert.ok(report.backupPath.startsWith(path.join(catpawHome, "backups")));
  assert.equal((await snapshotTree(report.backupPath)).digest, before);
  assert.deepEqual(
    parseFrontmatter(await readFile(path.join(boardPath, "index.md"), "utf8")).data,
    { schema: 2 },
  );

  const backupParent = path.dirname(report.backupPath);
  const backupsBeforeNoop = (await readdir(backupParent)).sort();
  const migratedDigest = (await snapshotTree(boardPath)).digest;
  const noop = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });

  assert.equal(noop.code, 0, noop.stderr || noop.stdout);
  const noopReport = JSON.parse(noop.stdout);
  assert.equal(noopReport.status, "noop");
  assert.equal(noopReport.fromSchema, 2);
  assert.equal(noopReport.toSchema, 2);
  assert.equal(noopReport.backupPath, null);
  assert.equal(noopReport.patch, null);
  assert.equal((await snapshotTree(boardPath)).digest, migratedDigest);
  assert.deepEqual((await readdir(backupParent)).sort(), backupsBeforeNoop);
});

test("migration planning and staged apply preserve mapped and replacement file modes", async (t) => {
  const root = await fixture(t, readyBoard());
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const sourcePath = path.join(boardPath, "reqs/FR-101-alpha.md");
  const indexPath = path.join(boardPath, "index.md");
  await chmod(sourcePath, 0o600);
  await chmod(indexPath, 0o640);

  const analysis = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });
  assert.equal(analysis.status, "ready");
  assert.equal(
    operation(analysis, "write-file", "work/FR-101-alpha.md").fileMode,
    0o600,
  );
  assert.equal(operation(analysis, "write-file", "index.md").fileMode, 0o640);

  const patch = await createPatchPlan({ root: boardPath, operations: analysis.operations });
  assert.equal(patch.status, "ready");
  assert.equal(
    operation(patch, "write-file", "work/FR-101-alpha.md").fileMode,
    0o600,
  );
  assert.equal(operation(patch, "write-file", "index.md").fileMode, 0o640);

  const applied = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });
  assert.equal(applied.code, 0, applied.stderr || applied.stdout);
  assert.equal(
    (await lstat(path.join(boardPath, "work/FR-101-alpha.md"))).mode & 0o7777,
    0o600,
  );
  assert.equal((await lstat(indexPath)).mode & 0o7777, 0o640);
  await assert.rejects(access(sourcePath), { code: "ENOENT" });

  const migratedDigest = (await snapshotTree(boardPath)).digest;
  const noop = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });
  assert.equal(noop.code, 0, noop.stderr || noop.stdout);
  assert.equal(JSON.parse(noop.stdout).status, "noop");
  assert.equal((await snapshotTree(boardPath)).digest, migratedDigest);
});

test("blocked board migrate never writes or creates a backup", async (t) => {
  const root = await fixture(t, blockedBoard());
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  for (const apply of [false, true]) {
    const result = await runCli([
      "board",
      "migrate",
      "--project",
      root,
      ...(apply ? ["--apply"] : []),
      "--json",
    ], {
      cwd: root,
      env: { CATPAW_HOME: catpawHome },
    });

    assert.equal(result.code, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "blocked");
    assert.equal(report.mode, apply ? "apply" : "dry-run");
    assert.equal(report.patch, null);
    assert.equal(report.backupPath, null);
    assert.ok(report.blockers.length > 0);
    assert.equal((await snapshotTree(boardPath)).digest, before);
    assert.equal(await exists(path.join(catpawHome, "backups")), false);
  }
});

test("migration records an accepted historical gap for missing completion Evidence", async (t) => {
  const files = readyBoard();
  delete files[".catpaw/tests/matrices/BUG-202-fix.md"];
  delete files[".catpaw/reviews/BUG-202-fix/summary.md"];
  const root = await fixture(t, files);
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

  const analyzed = await analyzeV1ToV2Migration({ projectRoot: root, boardPath });
  assert.equal(analyzed.status, "ready", JSON.stringify(analyzed.blockers));
  assert.deepEqual(analyzed.blockers, []);
  assert.ok(analyzed.warnings.some((item) =>
    item.code === "inferred-completion-gap" &&
    item.path === "reqs/BUG-202-fix.md" &&
    item.message.includes("test, independent-review-or-provider")
  ));
  assert.ok(operation(
    analyzed,
    "write-file",
    `evidence/BUG-202/${DATE}-reflection-accepted-gap.md`,
  ));
  assert.equal((await snapshotTree(boardPath)).digest, before);

  const result = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--apply",
    "--json",
  ], {
    cwd: root,
    env: { CATPAW_HOME: catpawHome },
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "applied");
  assert.ok(report.backupPath.startsWith(path.join(catpawHome, "backups")));
  assert.equal(
    await exists(path.join(
      boardPath,
      `evidence/BUG-202/${DATE}-reflection-accepted-gap.md`,
    )),
    true,
  );
  const status = await runCli([
    "board",
    "doctor",
    "--project",
    root,
    "--json",
  ], { cwd: root });
  assert.equal(status.code, 0, status.stderr || status.stdout);
});

test("board migrate rejects doctor-only flags", async (t) => {
  const root = await fixture(t, readyBoard());
  const result = await runCli([
    "board",
    "migrate",
    "--project",
    root,
    "--fix",
  ], { cwd: root });

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--fix is only valid for board doctor/);
});
