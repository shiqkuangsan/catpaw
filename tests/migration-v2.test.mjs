import assert from "node:assert/strict";
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
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../src/runtime/lib/frontmatter.mjs";
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

function operation(report, type, relativePath) {
  return report.operations.find(
    (item) => item.type === type && (item.path ?? item.to) === relativePath,
  );
}

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
  assert.match(index.body, /Narrative stays here\./);
  assert.match(index.body, /\[Active requirement]\(work\/FR-101-alpha\.md\)/);
  assert.match(index.body, /<!-- catpaw:active-work:start -->/);
  assert.equal(report.operations.some((item) => item.type === "move-file"), false);

  const patch = await createPatchPlan({ root: boardPath, operations: report.operations });
  assert.equal(patch.status, "ready");
  assert.deepEqual(patch.blockers, []);
});

test("planner blocks duplicate Milestone IDs", async (t) => {
  const files = readyBoard();
  files[".catpaw/milestones/MS-002-duplicate.md"] = frontmatter(
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

test("planner blocks draft Plan and Evidence artifacts instead of promoting them", async (t) => {
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

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) => item.code === "draft-plan"));
  assert.ok(report.blockers.some((item) => item.code === "draft-evidence"));
});

test("planner reports preserved empty directories under legacy roots", async (t) => {
  const root = await fixture(t, readyBoard(), [".catpaw/research/empty"]);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "ready");
  assert.ok(report.preservedUnknown.includes("research/empty/"));
});

test("planner blocks conflicting legacy work and req bindings", async (t) => {
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
  assert.ok(report.blockers.some((item) => item.code === "conflicting-evidence-work"));
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

test("planner blocks an explicit non-boolean independent Evidence fact", async (t) => {
  const files = readyBoard();
  files[".catpaw/reviews/FR-101-alpha/summary.md"] = files[
    ".catpaw/reviews/FR-101-alpha/summary.md"
  ].replace("independent: true", "independent: yes");
  const root = await fixture(t, files);

  const report = await analyzeV1ToV2Migration({
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.operations, []);
  assert.ok(report.blockers.some((item) =>
    item.code === "invalid-evidence-metadata" &&
    item.path === ".catpaw/reviews/FR-101-alpha/summary.md".replace(".catpaw/", "") &&
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
  for (const code of [
    "missing-work-stage",
    "unsupported-work-level",
    "draft-work",
    "plan-target-collision",
    "missing-evidence-created",
    "missing-evidence-title",
    "missing-evidence-work",
    "substantive-lessons",
    "broken-local-link",
  ]) {
    assert.equal(codes.has(code), true, code);
  }
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
    preservedUnknown: [],
    linkRewrites: [],
  });
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

test("failed staged validation leaves the live board and backup area untouched", async (t) => {
  const files = readyBoard();
  files[".catpaw/work/unmanaged.md"] = "# Not a schema 2 Work Item\n";
  const root = await fixture(t, files);
  const catpawHome = path.join(root, "runtime-home");
  const boardPath = path.join(root, ".catpaw");
  const before = (await snapshotTree(boardPath)).digest;

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

  assert.equal(result.code, 1, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: "ERR_BOARD_MIGRATION_STAGED_VALIDATION",
      message: "Staged migration failed schema 2 graph validation.",
    },
  });
  assert.equal((await snapshotTree(boardPath)).digest, before);
  assert.equal(await exists(path.join(catpawHome, "backups")), false);
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
