import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SCHEMA_2_LAYOUT } from "../src/runtime/lib/board.mjs";
import { renderMutationReport } from "../src/runtime/lib/commands/workflow.mjs";
import { parseFrontmatter } from "../src/runtime/lib/frontmatter.mjs";
import { validateMetadata } from "../src/runtime/lib/schema.mjs";

const CLI = new URL("../src/runtime/bin/catpaw.mjs", import.meta.url);
const DATE = "2026-07-11";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-cli-workflow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function createSchema2Board(root) {
  const boardPath = path.join(root, ".catpaw");
  await Promise.all(
    SCHEMA_2_LAYOUT.requiredDirectories.map((directory) =>
      mkdir(path.join(boardPath, directory), { recursive: true })
    ),
  );
  await writeFiles(root, {
    ".catpaw/index.md": `---
schema: 2
---

# Team Board

Narrative before managed sections.

<!-- catpaw:active-milestones:start -->
## Active Milestones

_None._
<!-- catpaw:active-milestones:end -->

Between the managed sections.

<!-- catpaw:active-work:start -->
## Active Work

_None._
<!-- catpaw:active-work:end -->

Narrative after managed sections.
`,
  });
}

async function createSchema1Board(root) {
  await writeFiles(root, {
    ".catpaw/index.md": `---
runtime: 2.1.7
---

# Legacy CatPaw Board
`,
  });
}

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI.pathname, ...args], {
      cwd: options.cwd,
      env: { ...process.env, HOME: options.home ?? process.env.HOME },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
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

async function treeSnapshot(root) {
  if (!(await exists(root))) return ["absent"];
  const entries = [];

  async function visit(directory, relativeDirectory = "") {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      const target = path.join(directory, child.name);
      if (child.isDirectory()) {
        entries.push(`dir:${relativePath}`);
        await visit(target, relativePath);
      } else {
        const bytes = await readFile(target);
        const digest = createHash("sha256").update(bytes).digest("hex");
        entries.push(`file:${relativePath}:${bytes.length}:${digest}`);
      }
    }
  }

  await visit(root);
  return entries;
}

test("work start defaults to a byte-identical dry-run preview", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Deterministic Workflow",
    "--date",
    DATE,
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "work start");
  assert.equal(report.schema, 2);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.status, "preview");
  assert.equal(report.migrationRequired, false);
  assert.deepEqual(report.artifacts, [
    { kind: "workItem", path: "work/FR-101-deterministic-workflow.md" },
    { kind: "plan", path: "plans/FR-101-deterministic-workflow.md" },
  ]);
  assert.equal(report.patch.status, "ready");
  assert.equal(report.patch.operationCount, 3);
  assert.match(report.patch.text, /WRITE CREATE work\/FR-101-deterministic-workflow\.md/);
  assert.match(report.patch.text, /WRITE CREATE plans\/FR-101-deterministic-workflow\.md/);
  assert.match(report.patch.text, /WRITE REPLACE index\.md/);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board init creates canonical dashboard marker blocks", async (t) => {
  const root = await fixture(t);

  const result = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.match(index, /<!-- catpaw:active-milestones:start -->\n/);
  assert.match(index, /## Active Milestones\n\n_None\._\n/);
  assert.match(index, /<!-- catpaw:active-milestones:end -->\n/);
  assert.match(index, /<!-- catpaw:active-work:start -->\n/);
  assert.match(index, /## Active Work\n\n_None\._\n/);
  assert.match(index, /<!-- catpaw:active-work:end -->\n$/);
});

test("work start applies valid templates and is path-safe and idempotent", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const firstArgs = [
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Deterministic Workflow",
    "--date",
    DATE,
    "--apply",
    "--json",
  ];
  const secondArgs = [
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "登录修复",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ];

  const first = await runCli(firstArgs);
  const second = await runCli(secondArgs);

  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  for (const result of [first, second]) {
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, "apply");
    assert.equal(report.status, "applied");
    assert.deepEqual(report.warnings, []);
    assert.equal(report.backupPath, null);
  }

  const workPath = path.join(root, ".catpaw/work/FR-101-deterministic-workflow.md");
  const planPath = path.join(root, ".catpaw/plans/FR-101-deterministic-workflow.md");
  const bugPath = path.join(root, ".catpaw/work/BUG-202-item.md");
  const work = parseFrontmatter(await readFile(workPath, "utf8"));
  const plan = parseFrontmatter(await readFile(planPath, "utf8"));
  const bug = parseFrontmatter(await readFile(bugPath, "utf8"));
  assert.deepEqual(validateMetadata("workItem", work.data), []);
  assert.deepEqual(validateMetadata("plan", plan.data), []);
  assert.deepEqual(validateMetadata("workItem", bug.data), []);
  assert.equal(work.data.type, "feature");
  assert.equal(work.data.mode, "tracked");
  assert.equal(work.data.status, "active");
  assert.equal(work.data.stage, "plan");
  assert.equal(bug.data.type, "bug");
  assert.equal(bug.data.mode, "gated");
  assert.match(work.body, /^\n# FR-101: Deterministic Workflow\n/m);
  assert.match(work.body, /## Acceptance\n/);
  assert.match(plan.body, /Work Item: \[FR-101\]\(\.\.\/work\/FR-101-deterministic-workflow\.md\)/);

  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.match(index, /Narrative before managed sections\./);
  assert.match(index, /Between the managed sections\./);
  assert.match(index, /Narrative after managed sections\./);
  assert.match(index, /\[Work\]\(work\/FR-101-deterministic-workflow\.md\)/);
  assert.match(index, /\[Plan\]\(plans\/FR-101-deterministic-workflow\.md\)/);
  assert.match(index, /\| BUG-202 \| 登录修复 \| gated \| active \| plan \|/);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli(secondArgs);
  assert.equal(replay.code, 0, replay.stderr);
  const replayReport = JSON.parse(replay.stdout);
  assert.equal(replayReport.status, "noop");
  assert.equal(replayReport.patch.status, "noop");
  assert.equal(replayReport.patch.operationCount, 0);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("milestone start defaults to a byte-identical dry-run preview", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "milestone",
    "start",
    "--project",
    root,
    "--id",
    "MS-301",
    "--title",
    "Launch Phase",
    "--target",
    "2026 Q3",
    "--date",
    DATE,
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "milestone start");
  assert.equal(report.schema, 2);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.status, "preview");
  assert.deepEqual(report.artifacts, [
    { kind: "milestone", path: "milestones/MS-301-launch-phase.md" },
  ]);
  assert.equal(report.patch.status, "ready");
  assert.equal(report.patch.operationCount, 2);
  assert.match(report.patch.text, /WRITE CREATE milestones\/MS-301-launch-phase\.md/);
  assert.match(report.patch.text, /WRITE REPLACE index\.md/);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("evidence add previews a deterministic work-bound path and default stage", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Deterministic Workflow",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(started.code, 0, started.stderr);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--work",
    "FR-101",
    "--type",
    "test",
    "--title",
    "CLI Verification",
    "--body",
    "node --test tests/cli-workflow.test.mjs",
    "--date",
    DATE,
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "evidence add");
  assert.equal(report.mode, "dry-run");
  assert.equal(report.status, "preview");
  assert.deepEqual(report.artifacts, [{
    kind: "evidence",
    path: "evidence/FR-101/2026-07-11-test-cli-verification.md",
  }]);
  assert.equal(report.evidence.type, "test");
  assert.equal(report.evidence.work, "FR-101");
  assert.equal(report.evidence.stage, "test");
  assert.equal(report.evidence.independent, false);
  assert.equal(report.patch.status, "ready");
  assert.equal(report.patch.operationCount, 2);
  assert.match(report.patch.text, /ENSURE DIR evidence\/FR-101/);
  assert.match(
    report.patch.text,
    /WRITE CREATE evidence\/FR-101\/2026-07-11-test-cli-verification\.md/,
  );
  assert.deepEqual(await treeSnapshot(root), before);
});

test("evidence type defaults select canonical lifecycle stages", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const stages = {
    research: "think",
    review: "review",
    provider: "review",
    test: "test",
    reflection: "reflect",
  };

  for (const [type, stage] of Object.entries(stages)) {
    const result = await runCli([
      "evidence",
      "add",
      "--project",
      root,
      "--type",
      type,
      "--title",
      `${type} record`,
      "--date",
      DATE,
      "--json",
    ]);
    assert.equal(result.code, 0, `${type}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.evidence.stage, stage, type);
    assert.equal(report.evidence.work, null, type);
    assert.match(
      report.artifacts[0].path,
      new RegExp(`^evidence/topics/${DATE}-${type}-`),
      type,
    );
  }
});

test("evidence add applies topic metadata and replays exact content as a no-op", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const indexPath = path.join(root, ".catpaw/index.md");
  const indexBefore = await readFile(indexPath, "utf8");
  const args = [
    "evidence",
    "add",
    "--project",
    root,
    "--type",
    "review",
    "--title",
    "External Review",
    "--agent",
    "Codex",
    "--lens",
    "system-contracts",
    "--independent",
    "--body",
    "Observed {{RAW_OUTPUT}} without interpretation.",
    "--date",
    DATE,
    "--apply",
    "--json",
  ];

  const applied = await runCli(args);

  assert.equal(applied.code, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.status, "applied");
  assert.deepEqual(report.warnings, []);
  assert.equal(report.backupPath, null);
  const evidencePath = path.join(
    root,
    ".catpaw/evidence/topics/2026-07-11-review-external-review.md",
  );
  const evidence = parseFrontmatter(await readFile(evidencePath, "utf8"));
  assert.deepEqual(validateMetadata("evidence", evidence.data), []);
  assert.deepEqual(evidence.data, {
    type: "review",
    work: null,
    stage: "review",
    created: DATE,
    updated: DATE,
    independent: true,
    agent: "Codex",
    lens: "system-contracts",
  });
  assert.match(evidence.body, /Observed \{\{RAW_OUTPUT}} without interpretation\./);
  assert.equal(await readFile(indexPath, "utf8"), indexBefore);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli(args);
  assert.equal(replay.code, 0, replay.stderr);
  const replayReport = JSON.parse(replay.stdout);
  assert.equal(replayReport.status, "noop");
  assert.equal(replayReport.patch.status, "noop");
  assert.equal(replayReport.patch.operationCount, 0);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("template replacements keep user-supplied token text opaque", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "{{PLAN_PATH}}",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(started.code, 0, started.stderr);
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/FR-101-plan-path.md"),
    "utf8",
  ));
  const plan = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/plans/FR-101-plan-path.md"),
    "utf8",
  ));
  assert.match(work.body, /^# FR-101: \{\{PLAN_PATH}}$/m);
  assert.match(
    work.body,
    /- Plan: \[FR-101 Plan]\(\.\.\/plans\/FR-101-plan-path\.md\)/,
  );
  assert.match(plan.body, /^# Plan: FR-101 \{\{PLAN_PATH}}$/m);

  const recorded = await runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--type",
    "research",
    "--title",
    "{{BODY}}",
    "--body",
    "Keep {{TITLE}} literal.",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(recorded.code, 0, recorded.stderr);
  const evidence = parseFrontmatter(await readFile(
    path.join(root, `.catpaw/evidence/topics/${DATE}-research-body.md`),
    "utf8",
  ));
  assert.match(evidence.body, /^# \{\{BODY}}$/m);
  assert.match(evidence.body, /^Keep \{\{TITLE}} literal\.$/m);
});

test("milestone add updates only canonical Scope content and is idempotent", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const setupCommands = [
    [
      "milestone",
      "start",
      "--id",
      "MS-301",
      "--title",
      "Launch Phase",
      "--date",
      DATE,
    ],
    [
      "work",
      "start",
      "--id",
      "FR-101",
      "--title",
      "Deterministic Workflow",
      "--date",
      DATE,
    ],
    [
      "work",
      "start",
      "--id",
      "BUG-202",
      "--title",
      "Boundary Failure",
      "--date",
      DATE,
    ],
  ];
  for (const command of setupCommands) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const indexPath = path.join(root, ".catpaw/index.md");
  const indexBefore = await readFile(indexPath, "utf8");
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-launch-phase.md");
  const milestoneBefore = await readFile(milestonePath, "utf8");
  const beforePreview = await treeSnapshot(root);
  const args = [
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-101",
    "--date",
    DATE,
    "--json",
  ];

  const preview = await runCli(args);

  assert.equal(preview.code, 0, preview.stderr);
  const previewReport = JSON.parse(preview.stdout);
  assert.equal(previewReport.command, "milestone add");
  assert.equal(previewReport.mode, "dry-run");
  assert.equal(previewReport.status, "preview");
  assert.equal(previewReport.patch.operationCount, 1);
  assert.match(previewReport.patch.text, /WRITE REPLACE milestones\/MS-301-launch-phase\.md/);
  assert.doesNotMatch(previewReport.patch.text, /index\.md/);
  assert.deepEqual(await treeSnapshot(root), beforePreview);

  const applied = await runCli([...args, "--apply"]);
  assert.equal(applied.code, 0, applied.stderr);
  const milestone = await readFile(milestonePath, "utf8");
  assert.match(milestone, /\| Work Item ID \| Title \| Status \| Notes \|/);
  assert.match(milestone, /\| FR-101 \| Deterministic Workflow \| active \|  \|/);
  const outsideScope = (text) => text.replace(
    /<!-- catpaw:milestone-scope:start -->[\s\S]*?<!-- catpaw:milestone-scope:end -->/,
    "<scope>",
  );
  assert.equal(outsideScope(milestone), outsideScope(milestoneBefore));
  assert.equal(await readFile(indexPath, "utf8"), indexBefore);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli([...args, "--apply"]);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("milestone add preserves existing Scope Notes including escaped pipes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", "Notes Phase"],
    ["work", "start", "--id", "FR-101", "--title", "Existing Work"],
    ["work", "start", "--id", "FR-102", "--title", "New Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const addWork = (work) => runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    work,
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  const first = await addWork("FR-101");
  assert.equal(first.code, 0, first.stderr);
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-notes-phase.md");
  const withNotes = (await readFile(milestonePath, "utf8")).replace(
    "| FR-101 | Existing Work | active |  |",
    "| FR-101 | Existing Work | active | Keep \\| review note |",
  );
  await writeFile(milestonePath, withNotes);

  const second = await addWork("FR-102");

  assert.equal(second.code, 0, `${second.stdout}${second.stderr}`);
  const milestone = await readFile(milestonePath, "utf8");
  assert.match(
    milestone,
    /\| FR-101 \| Existing Work \| active \| Keep \\\| review note \|/,
  );
  assert.match(milestone, /\| FR-102 \| New Work \| active \|  \|/);
});

test("milestone add refuses malformed managed Scope rows without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", "Malformed Scope"],
    ["work", "start", "--id", "FR-101", "--title", "Existing Work"],
    ["work", "start", "--id", "FR-102", "--title", "New Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const first = await runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-101",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(first.code, 0, first.stderr);
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-malformed-scope.md");
  const malformed = (await readFile(milestonePath, "utf8")).replace(
    "| FR-101 | Existing Work | active |  |",
    "| FR-101 | Existing Work | active | note | extra |",
  );
  await writeFile(milestonePath, malformed);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-102",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: "ERR_WORKFLOW_MILESTONE_SCOPE",
      message: "Milestone Scope table is malformed.",
    },
  });
  assert.deepEqual(await treeSnapshot(root), before);
});

test("tracked work close defaults to done and preserves Plan and Evidence", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Deterministic Workflow",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const workPath = path.join(root, ".catpaw/work/FR-101-deterministic-workflow.md");
  const planPath = path.join(root, ".catpaw/plans/FR-101-deterministic-workflow.md");
  const indexPath = path.join(root, ".catpaw/index.md");
  const beforePreview = await treeSnapshot(root);
  const args = [
    "work",
    "close",
    "--project",
    root,
    "--id",
    "FR-101",
    "--date",
    DATE,
    "--json",
  ];

  const preview = await runCli(args);

  assert.equal(preview.code, 0, preview.stderr);
  const previewReport = JSON.parse(preview.stdout);
  assert.equal(previewReport.command, "work close");
  assert.equal(previewReport.mode, "dry-run");
  assert.equal(previewReport.status, "preview");
  assert.deepEqual(previewReport.closure, {
    id: "FR-101",
    status: "done",
    acceptedGap: false,
  });
  assert.equal(previewReport.patch.operationCount, 2);
  assert.match(previewReport.patch.text, /WRITE REPLACE work\/FR-101-deterministic-workflow\.md/);
  assert.match(previewReport.patch.text, /WRITE REPLACE index\.md/);
  assert.doesNotMatch(previewReport.patch.text, /plans\//);
  assert.deepEqual(await treeSnapshot(root), beforePreview);

  const applied = await runCli([...args, "--apply"]);
  assert.equal(applied.code, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.status, "applied");
  assert.deepEqual(report.warnings, []);
  assert.equal(report.backupPath, null);
  const work = parseFrontmatter(await readFile(workPath, "utf8"));
  assert.deepEqual(validateMetadata("workItem", work.data), []);
  assert.equal(work.data.status, "done");
  assert.equal(work.data.stage, "reflect");
  assert.equal(work.data.updated, DATE);
  assert.equal(work.data.closed, DATE);
  assert.equal(await exists(planPath), true);
  const index = await readFile(indexPath, "utf8");
  assert.doesNotMatch(index, /\| FR-101 \|/);
  assert.match(index, /Narrative before managed sections\./);
  assert.match(index, /Narrative after managed sections\./);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli([...args, "--apply"]);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("gated work close refuses missing completion Evidence in every mode", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Boundary Failure",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const before = await treeSnapshot(root);
  const base = [
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--date",
    DATE,
    "--json",
  ];

  for (const [mode, args] of [
    ["dry-run", base],
    ["apply", [...base, "--apply"]],
  ]) {
    const result = await runCli(args);
    assert.equal(result.code, 1, `${mode}\n${result.stderr}`);
    assert.equal(result.stderr, "", mode);
    const report = JSON.parse(result.stdout);
    assert.equal(report.command, "work close", mode);
    assert.equal(report.mode, mode, mode);
    assert.equal(report.status, "refused", mode);
    assert.equal(
      report.reason,
      "Gated Work Item is missing required completion Evidence.",
      mode,
    );
    assert.deepEqual(report.gate, {
      required: ["test", "independent-review-or-provider"],
      missing: ["test", "independent-review-or-provider"],
      acceptedGap: false,
    });
    assert.equal(report.patch, null, mode);
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("Evidence apply requires a substantive body while dry-run may preview", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);
  const args = [
    "evidence",
    "add",
    "--project",
    root,
    "--type",
    "test",
    "--title",
    "Empty Test",
    "--date",
    DATE,
    "--json",
  ];

  const preview = await runCli(args);
  assert.equal(preview.code, 0, preview.stderr || preview.stdout);
  assert.equal(JSON.parse(preview.stdout).mode, "dry-run");
  assert.deepEqual(await treeSnapshot(root), before);

  const apply = await runCli([...args, "--apply"]);
  assert.equal(apply.code, 2);
  assert.equal(apply.stdout, "");
  assert.match(apply.stderr, /--body is required when --apply records Evidence/);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("gated work closes with bound test and independent review Evidence", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Boundary Failure",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const evidence = async (type, title, extra = []) => runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--work",
    "BUG-202",
    "--type",
    type,
    "--title",
    title,
    "--date",
    DATE,
    "--body",
    `${title} produced usable findings and verification details.`,
    ...extra,
    "--apply",
    "--json",
  ]);
  for (const result of [
    await evidence("test", "Regression Test"),
    await evidence("review", "Primary Review"),
  ]) {
    assert.equal(result.code, 0, result.stderr);
  }
  const closeArgs = [
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--date",
    DATE,
    "--json",
  ];

  const partial = await runCli(closeArgs);
  assert.equal(partial.code, 1, partial.stderr);
  assert.deepEqual(JSON.parse(partial.stdout).gate.missing, [
    "independent-review-or-provider",
  ]);

  const independent = await evidence("review", "Independent Review", [
    "--independent",
    "--agent",
    "test-agent",
  ]);
  assert.equal(independent.code, 0, independent.stderr);
  const closed = await runCli([...closeArgs, "--apply"]);

  assert.equal(closed.code, 0, closed.stderr);
  const report = JSON.parse(closed.stdout);
  assert.equal(report.status, "applied");
  assert.deepEqual(report.gate, {
    required: ["test", "independent-review-or-provider"],
    missing: [],
    acceptedGap: false,
  });
  assert.equal(
    await exists(path.join(
      root,
      ".catpaw/evidence/BUG-202/2026-07-11-test-regression-test.md",
    )),
    true,
  );
  assert.equal(
    await exists(path.join(
      root,
      ".catpaw/evidence/BUG-202/2026-07-11-review-independent-review.md",
    )),
    true,
  );
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/BUG-202-boundary-failure.md"),
    "utf8",
  ));
  assert.equal(work.data.status, "done");
});

test("independent review Evidence without a named agent does not satisfy the gate", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Agent Contract",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(started.code, 0, started.stderr);
  const tested = await runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--work",
    "BUG-202",
    "--type",
    "test",
    "--title",
    "Regression Test",
    "--date",
    DATE,
    "--body",
    "Regression test passed with recorded output.",
    "--apply",
    "--json",
  ]);
  assert.equal(tested.code, 0, tested.stderr);
  await writeFiles(root, {
    ".catpaw/evidence/BUG-202/review-without-agent.md": `---
type: review
work: BUG-202
stage: review
created: ${DATE}
updated: ${DATE}
independent: true
agent: null
lens: null
---

# Review without agent
`,
  });
  const before = await treeSnapshot(root);

  const result = await runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--date",
    DATE,
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).gate.missing, [
    "independent-review-or-provider",
  ]);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("accepted gap closes gated work and persists typed Evidence atomically", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Boundary Failure",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const before = await treeSnapshot(root);
  const args = [
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--accept-gap",
    "CI environment is unavailable",
    "--date",
    DATE,
    "--json",
  ];

  const preview = await runCli(args);

  assert.equal(preview.code, 0, preview.stderr);
  const previewReport = JSON.parse(preview.stdout);
  assert.equal(previewReport.status, "preview");
  assert.deepEqual(previewReport.gate, {
    required: ["test", "independent-review-or-provider"],
    missing: ["test", "independent-review-or-provider"],
    acceptedGap: true,
    reason: "CI environment is unavailable",
  });
  assert.deepEqual(previewReport.closure, {
    id: "BUG-202",
    status: "done",
    acceptedGap: true,
  });
  assert.deepEqual(previewReport.artifacts, [
    { kind: "workItem", path: "work/BUG-202-boundary-failure.md" },
    {
      kind: "evidence",
      path: "evidence/BUG-202/2026-07-11-reflection-accepted-gap.md",
    },
  ]);
  assert.equal(previewReport.patch.operationCount, 4);
  assert.match(previewReport.patch.text, /ENSURE DIR evidence\/BUG-202/);
  assert.match(
    previewReport.patch.text,
    /WRITE CREATE evidence\/BUG-202\/2026-07-11-reflection-accepted-gap\.md/,
  );
  assert.deepEqual(await treeSnapshot(root), before);

  const applied = await runCli([...args, "--apply"]);
  assert.equal(applied.code, 0, applied.stderr);
  const gapPath = path.join(
    root,
    ".catpaw/evidence/BUG-202/2026-07-11-reflection-accepted-gap.md",
  );
  const gap = parseFrontmatter(await readFile(gapPath, "utf8"));
  assert.deepEqual(validateMetadata("evidence", gap.data), []);
  assert.deepEqual(gap.data, {
    type: "reflection",
    work: "BUG-202",
    stage: "reflect",
    created: DATE,
    updated: DATE,
    independent: false,
    agent: null,
    lens: null,
  });
  assert.match(gap.body, /Missing gates:\n- test\n- independent-review-or-provider/);
  assert.match(gap.body, /Accepted reason: CI environment is unavailable/);
  assert.match(
    gap.body,
    /Does not authorize Git, push, PR, deploy, or external actions\./,
  );
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/BUG-202-boundary-failure.md"),
    "utf8",
  ));
  assert.equal(work.data.status, "done");
  assert.equal(work.data.stage, "reflect");

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli([...args, "--apply"]);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("work close replay on another date preserves terminal history exactly", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Immutable Close",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(started.code, 0, started.stderr);
  const close = (date) => runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "FR-101",
    "--date",
    date,
    "--apply",
    "--json",
  ]);
  const first = await close(DATE);
  assert.equal(first.code, 0, first.stderr);
  const beforeReplay = await treeSnapshot(root);

  const replay = await close("2026-07-12");

  assert.equal(replay.code, 0, replay.stderr);
  const report = JSON.parse(replay.stdout);
  assert.equal(report.status, "noop");
  assert.equal(report.patch.operationCount, 0);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/FR-101-immutable-close.md"),
    "utf8",
  ));
  assert.equal(work.data.updated, DATE);
  assert.equal(work.data.closed, DATE);
});

test("accepted-gap replay across dates is one immutable record", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const started = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Immutable Gap",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(started.code, 0, started.stderr);
  const close = (date, reason) => runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--accept-gap",
    reason,
    "--date",
    date,
    "--apply",
    "--json",
  ]);
  const reason = "CI environment is unavailable";
  const first = await close(DATE, reason);
  assert.equal(first.code, 0, first.stderr);
  const beforeReplay = await treeSnapshot(root);

  const matching = await close("2026-07-12", reason);

  assert.equal(matching.code, 0, matching.stderr);
  assert.equal(JSON.parse(matching.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
  assert.deepEqual(
    (await readdir(path.join(root, ".catpaw/evidence/BUG-202"))).sort(),
    ["2026-07-11-reflection-accepted-gap.md"],
  );

  const different = await close("2026-07-12", "A different gap reason");
  assert.equal(different.code, 1, different.stderr);
  const report = JSON.parse(different.stdout);
  assert.equal(report.status, "refused");
  assert.equal(
    report.reason,
    "--accept-gap does not match an existing accepted Gated gap.",
  );
  assert.equal(report.patch, null);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("accepted-gap replay does not read a reason from the next line", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--title",
    "Tampered Gap",
    "--mode",
    "gated",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const close = await runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--accept-gap",
    "Original reason",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(close.code, 0, close.stderr);
  const gapPath = path.join(
    root,
    `.catpaw/evidence/BUG-202/${DATE}-reflection-accepted-gap.md`,
  );
  const original = await readFile(gapPath, "utf8");
  const tampered = original.replace(
    "Accepted reason: Original reason",
    "Accepted reason:\nTampered next line",
  );
  assert.notEqual(tampered, original);
  await writeFile(gapPath, tampered);
  const beforeReplay = await treeSnapshot(root);

  const replay = await runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--accept-gap",
    "Tampered next line",
    "--date",
    "2026-07-12",
    "--apply",
    "--json",
  ]);

  assert.equal(replay.code, 1, replay.stderr);
  assert.equal(replay.stderr, "");
  const report = JSON.parse(replay.stdout);
  assert.equal(report.status, "invalid-board");
  assert.ok(
    report.findings.some(
      (item) => item.code === "gated-work-missing-completion-evidence",
    ),
  );
  assert.equal(report.patch, null);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("milestone close done refuses an empty Scope without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const start = await runCli([
    "milestone",
    "start",
    "--project",
    root,
    "--id",
    "MS-301",
    "--title",
    "Launch Phase",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(start.code, 0, start.stderr);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "milestone",
    "close",
    "--project",
    root,
    "--id",
    "MS-301",
    "--date",
    DATE,
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "milestone close");
  assert.equal(report.status, "refused");
  assert.equal(
    report.reason,
    "Milestone done requires at least one scoped Work Item.",
  );
  assert.deepEqual(report.gate, { scoped: [], nonTerminal: [] });
  assert.equal(report.patch, null);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("milestone close done waits for every scoped Work Item then applies", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const commands = [
    ["milestone", "start", "--id", "MS-301", "--title", "Launch Phase"],
    ["work", "start", "--id", "FR-101", "--title", "Release Work"],
    ["work", "start", "--id", "FR-102", "--title", "Remaining Work"],
  ];
  for (const command of commands) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  for (const work of ["FR-101", "FR-102"]) {
    const added = await runCli([
      "milestone",
      "add",
      "--project",
      root,
      "--milestone",
      "MS-301",
      "--work",
      work,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(added.code, 0, added.stderr);
  }
  const closeMilestone = [
    "milestone",
    "close",
    "--project",
    root,
    "--id",
    "MS-301",
    "--date",
    DATE,
    "--json",
  ];

  const closeWork = (id) => runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    id,
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  const firstClosed = await closeWork("FR-101");
  assert.equal(firstClosed.code, 0, firstClosed.stderr);

  const refused = await runCli(closeMilestone);
  assert.equal(refused.code, 1, refused.stderr);
  assert.equal(
    JSON.parse(refused.stdout).reason,
    "Milestone has non-terminal scoped Work Items.",
  );
  assert.deepEqual(JSON.parse(refused.stdout).gate, {
    scoped: ["FR-101", "FR-102"],
    nonTerminal: ["FR-102"],
  });

  const closedWork = await closeWork("FR-102");
  assert.equal(closedWork.code, 0, closedWork.stderr);
  const closedMilestone = await runCli([...closeMilestone, "--apply"]);
  assert.equal(closedMilestone.code, 0, closedMilestone.stderr);
  const report = JSON.parse(closedMilestone.stdout);
  assert.equal(report.status, "applied");
  assert.deepEqual(report.gate, {
    scoped: ["FR-101", "FR-102"],
    nonTerminal: [],
  });
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-launch-phase.md");
  const milestone = parseFrontmatter(await readFile(milestonePath, "utf8"));
  assert.deepEqual(validateMetadata("milestone", milestone.data), []);
  assert.equal(milestone.data.status, "done");
  assert.equal(milestone.data.updated, DATE);
  assert.equal(milestone.data.closed, DATE);
  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.doesNotMatch(index, /\| MS-301 \|/);
  assert.match(index, /Between the managed sections\./);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli([...closeMilestone, "--apply"]);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("work terminal transitions refresh only nonterminal Milestone Scopes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["work", "start", "--id", "FR-101", "--title", "Done Work"],
    ["work", "start", "--id", "BUG-202", "--title", "Cancelled Work"],
    ["milestone", "start", "--id", "MS-301", "--title", "Active Phase"],
    ["milestone", "start", "--id", "MS-302", "--title", "History Phase"],
    ["milestone", "start", "--id", "MS-303", "--title", "Blocked Phase"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const addScope = async (milestone, work) => {
    const result = await runCli([
      "milestone",
      "add",
      "--project",
      root,
      "--milestone",
      milestone,
      "--work",
      work,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  };
  await addScope("MS-301", "FR-101");
  await addScope("MS-301", "BUG-202");
  await addScope("MS-302", "FR-101");
  await addScope("MS-303", "FR-101");

  const activePath = path.join(root, ".catpaw/milestones/MS-301-active-phase.md");
  let active = await readFile(activePath, "utf8");
  active = active
    .replace(
      "| FR-101 | Done Work | active |  |",
      "| FR-101 | Done Work | active | Keep \\| done note |",
    )
    .replace(
      "| BUG-202 | Cancelled Work | active |  |",
      "| BUG-202 | Cancelled Work | active | Keep cancel note |",
    )
    .replace("## Exit Criteria", "Project-owned narrative.\n\n## Exit Criteria");
  await writeFile(activePath, active);

  const blockedPath = path.join(root, ".catpaw/milestones/MS-303-blocked-phase.md");
  await writeFile(
    blockedPath,
    (await readFile(blockedPath, "utf8")).replace("status: active", "status: blocked"),
  );
  const historicalClose = await runCli([
    "milestone",
    "close",
    "--project",
    root,
    "--id",
    "MS-302",
    "--status",
    "cancelled",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(historicalClose.code, 0, historicalClose.stderr);
  const historicalPath = path.join(root, ".catpaw/milestones/MS-302-history-phase.md");
  const historicalBefore = await readFile(historicalPath, "utf8");

  for (const [id, status] of [["FR-101", "done"], ["BUG-202", "cancelled"]]) {
    const result = await runCli([
      "work",
      "close",
      "--project",
      root,
      "--id",
      id,
      "--status",
      status,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, `${id}\n${result.stdout}${result.stderr}`);
  }

  const refreshedActive = await readFile(activePath, "utf8");
  assert.match(
    refreshedActive,
    /\| FR-101 \| Done Work \| done \| Keep \\\| done note \|/,
  );
  assert.match(
    refreshedActive,
    /\| BUG-202 \| Cancelled Work \| cancelled \| Keep cancel note \|/,
  );
  assert.match(refreshedActive, /Project-owned narrative\./);
  assert.match(
    await readFile(blockedPath, "utf8"),
    /\| FR-101 \| Done Work \| done \|  \|/,
  );
  assert.equal(await readFile(historicalPath, "utf8"), historicalBefore);
});

test("milestone close writes a final Scope snapshot from live Work statuses", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", "Final Snapshot"],
    ["work", "start", "--id", "FR-101", "--title", "Completed Work"],
    ["work", "start", "--id", "BUG-202", "--title", "Cancelled Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  for (const work of ["FR-101", "BUG-202"]) {
    const result = await runCli([
      "milestone",
      "add",
      "--project",
      root,
      "--milestone",
      "MS-301",
      "--work",
      work,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  for (const [id, status] of [["FR-101", "done"], ["BUG-202", "cancelled"]]) {
    const result = await runCli([
      "work",
      "close",
      "--project",
      root,
      "--id",
      id,
      "--status",
      status,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-final-snapshot.md");
  let stale = await readFile(milestonePath, "utf8");
  stale = stale
    .replace(
      /\| FR-101 \| Completed Work \| (?:done|active) \|  \|/,
      "| FR-101 | Completed Work | active | Final note |",
    )
    .replace(
      /\| BUG-202 \| Cancelled Work \| (?:cancelled|active) \|  \|/,
      "| BUG-202 | Cancelled Work | active |  |",
    );
  await writeFile(milestonePath, stale);

  const closed = await runCli([
    "milestone",
    "close",
    "--project",
    root,
    "--id",
    "MS-301",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);

  assert.equal(closed.code, 0, `${closed.stdout}${closed.stderr}`);
  const milestone = await readFile(milestonePath, "utf8");
  assert.match(
    milestone,
    /\| FR-101 \| Completed Work \| done \| Final note \|/,
  );
  assert.match(
    milestone,
    /\| BUG-202 \| Cancelled Work \| cancelled \|  \|/,
  );
});

test("milestone close replay on another date preserves terminal history exactly", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", "Immutable Phase"],
    ["work", "start", "--id", "FR-101", "--title", "Completed Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const added = await runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-101",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(added.code, 0, added.stderr);
  const workClosed = await runCli([
    "work",
    "close",
    "--project",
    root,
    "--id",
    "FR-101",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(workClosed.code, 0, workClosed.stderr);
  const close = (date) => runCli([
    "milestone",
    "close",
    "--project",
    root,
    "--id",
    "MS-301",
    "--date",
    date,
    "--apply",
    "--json",
  ]);
  const first = await close(DATE);
  assert.equal(first.code, 0, first.stderr);
  const beforeReplay = await treeSnapshot(root);

  const replay = await close("2026-07-12");

  assert.equal(replay.code, 0, replay.stderr);
  const report = JSON.parse(replay.stdout);
  assert.equal(report.status, "noop");
  assert.equal(report.patch.operationCount, 0);
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
  const milestone = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/milestones/MS-301-immutable-phase.md"),
    "utf8",
  ));
  assert.equal(milestone.data.updated, DATE);
  assert.equal(milestone.data.closed, DATE);
});

test("cancelled Work and Milestone bypass completion claims", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    [
      "work",
      "start",
      "--id",
      "BUG-202",
      "--title",
      "Cancelled Bug",
      "--mode",
      "gated",
    ],
    ["milestone", "start", "--id", "MS-301", "--title", "Cancelled Phase"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }

  for (const command of [
    ["work", "close", "--id", "BUG-202"],
    ["milestone", "close", "--id", "MS-301"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--status",
      "cancelled",
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "applied");
  }
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/BUG-202-cancelled-bug.md"),
    "utf8",
  ));
  const milestone = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/milestones/MS-301-cancelled-phase.md"),
    "utf8",
  ));
  assert.equal(work.data.status, "cancelled");
  assert.equal(work.data.stage, "reflect");
  assert.equal(milestone.data.status, "cancelled");
  assert.equal(await exists(path.join(root, ".catpaw/evidence/BUG-202")), false);
});

test("milestone start applies valid target metadata and replays as a no-op", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const args = [
    "milestone",
    "start",
    "--project",
    root,
    "--id",
    "MS-301",
    "--title",
    "Launch Phase",
    "--target",
    "beta | release",
    "--date",
    DATE,
    "--apply",
    "--json",
  ];

  const applied = await runCli(args);

  assert.equal(applied.code, 0, applied.stderr);
  const report = JSON.parse(applied.stdout);
  assert.equal(report.status, "applied");
  assert.deepEqual(report.warnings, []);
  assert.equal(report.backupPath, null);
  const milestonePath = path.join(root, ".catpaw/milestones/MS-301-launch-phase.md");
  const milestone = parseFrontmatter(await readFile(milestonePath, "utf8"));
  assert.deepEqual(validateMetadata("milestone", milestone.data), []);
  assert.equal(milestone.data.target, "beta | release");
  assert.match(milestone.body, /<!-- catpaw:milestone-scope:start -->/);
  assert.match(milestone.body, /\| Work Item ID \| Title \| Status \| Notes \|/);
  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  assert.match(index, /\| MS-301 \| Launch Phase \| active \| beta \\| release \|/);
  assert.match(index, /Narrative before managed sections\./);
  assert.match(index, /Between the managed sections\./);

  const beforeReplay = await treeSnapshot(root);
  const replay = await runCli(args);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "noop");
  assert.deepEqual(await treeSnapshot(root), beforeReplay);
});

test("every workflow mutation refuses schema 1 and recommends board migrate", async (t) => {
  const root = await fixture(t);
  await createSchema1Board(root);
  const before = await treeSnapshot(root);
  const commands = [
    ["work", "start", "--id", "FR-101", "--title", "Legacy Work"],
    ["work", "close", "--id", "FR-101"],
    ["milestone", "start", "--id", "MS-301", "--title", "Legacy Phase"],
    ["milestone", "add", "--milestone", "MS-301", "--work", "FR-101"],
    ["milestone", "close", "--id", "MS-301"],
    [
      "evidence",
      "add",
      "--type",
      "reflection",
      "--title",
      "Legacy Note",
      "--body",
      "Legacy reflection content.",
    ],
  ];

  for (const command of commands) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 1, `${command.join(" ")}\n${result.stderr}`);
    assert.equal(result.stderr, "", command.join(" "));
    const report = JSON.parse(result.stdout);
    assert.equal(report.schema, 1, command.join(" "));
    assert.equal(report.mode, "read-only", command.join(" "));
    assert.equal(report.status, "migration-required", command.join(" "));
    assert.equal(report.migrationRequired, true, command.join(" "));
    assert.equal(report.patch, null, command.join(" "));
    assert.equal(report.nextAction, "Run board migrate.", command.join(" "));
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("workflow enum and option mistakes are stable usage errors", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);
  const cases = [
    ["work", "start", "--id", "FR-101", "--title", "Bad", "--mode", "fast"],
    ["work", "close", "--id", "FR-101", "--status", "active"],
    ["milestone", "start", "--id", "MS-1", "--title", "Bad"],
    ["milestone", "close", "--id", "MS-301", "--status", "blocked"],
    ["evidence", "add", "--type", "memo", "--title", "Bad"],
    [
      "evidence",
      "add",
      "--type",
      "test",
      "--title",
      "Bad",
      "--stage",
      "verify",
    ],
    [
      "evidence",
      "add",
      "--type",
      "review",
      "--title",
      "Bad",
      "--lens",
      "architecture",
    ],
    ["evidence", "add", "--type", "review", "--title", "Bad", "--independent"],
    [
      "evidence",
      "add",
      "--type",
      "review",
      "--title",
      "Bad",
      "--independent",
      "--agent",
      "   ",
    ],
    [
      "work",
      "close",
      "--id",
      "FR-101",
      "--accept-gap",
      "   ",
    ],
  ];

  for (const command of cases) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
    ]);
    assert.equal(result.code, 2, `${command.join(" ")}\n${result.stderr}`);
    assert.equal(result.stdout, "", command.join(" "));
    assert.match(result.stderr, /^catpaw: .+\n$/, command.join(" "));
    assert.doesNotMatch(result.stderr, /\n\s+at |Node\.js/, command.join(" "));
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("accept-gap rejects CR and LF as precise CLI usage errors", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);

  for (const reason of ["First line\nSecond line", "First line\rSecond line"]) {
    const result = await runCli([
      "work",
      "close",
      "--project",
      root,
      "--id",
      "FR-101",
      "--accept-gap",
      reason,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);

    assert.equal(result.code, 2, JSON.stringify(reason));
    assert.equal(result.stdout, "", JSON.stringify(reason));
    assert.equal(
      result.stderr,
      "catpaw: --accept-gap requires a nonempty single-line reason\n",
      JSON.stringify(reason),
    );
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("missing workflow references are deterministic exit 1 refusals", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);
  const cases = [
    {
      args: [
        "evidence",
        "add",
        "--work",
        "FR-999",
        "--type",
        "test",
        "--title",
        "Missing Work",
        "--body",
        "Missing Work evidence body.",
      ],
      reason: "Work Item FR-999 does not exist.",
    },
    {
      args: ["milestone", "add", "--milestone", "MS-999", "--work", "FR-999"],
      reason: "Milestone MS-999 does not exist.",
    },
    {
      args: ["work", "close", "--id", "FR-999"],
      reason: "Work Item FR-999 does not exist.",
    },
  ];

  for (const item of cases) {
    const result = await runCli([
      ...item.args,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 1, result.stderr);
    assert.equal(result.stderr, "");
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "refused");
    assert.equal(report.reason, item.reason);
    assert.equal(report.patch, null);
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("workflow human output is deterministic and preserves apply diagnostics", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const args = [
    "work",
    "start",
    "--project",
    root,
    "--board",
    ".catpaw",
    "--id",
    "FR-101",
    "--title",
    "Human Report",
    "--date",
    DATE,
    "--dry-run",
  ];
  const first = await runCli(args, { cwd: root });
  const second = await runCli(args, { cwd: root });
  assert.equal(first.code, 0, first.stderr);
  assert.equal(first.stderr, "");
  assert.equal(second.stdout, first.stdout);
  assert.match(first.stdout, /^work start\nSchema: 2\nMode: dry-run\nStatus: preview\n/);
  assert.match(first.stdout, /Patch:\nREADY\n/);
  assert.match(first.stdout, /Next: Run work start --apply to create the Work Item and Plan\.\n$/);

  const output = renderMutationReport({
    command: "work close",
    schema: 2,
    mode: "apply",
    status: "applied",
    migrationRequired: false,
    patch: null,
    warnings: [{
      code: "stage-cleanup-failed",
      path: "/tmp/catpaw-stage",
      message: "Could not clean the stage.",
    }],
    backupPath: "/tmp/catpaw-backup",
    nextAction: "Inspect the warning.",
  });
  assert.match(output, /Backup: \/tmp\/catpaw-backup\n/);
  assert.match(output, /Warnings: 1\n/);
  assert.match(
    output,
    /- stage-cleanup-failed \[\/tmp\/catpaw-stage\] Could not clean the stage\./,
  );
});

test("duplicate dashboard marker blocks refuse mutation without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const indexPath = path.join(root, ".catpaw/index.md");
  await writeFile(
    indexPath,
    `${await readFile(indexPath, "utf8")}\n<!-- catpaw:active-work:start -->\n## Active Work\n\n_None._\n<!-- catpaw:active-work:end -->\n`,
  );
  const before = await treeSnapshot(root);

  const result = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "FR-101",
    "--title",
    "Duplicate Marker",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: "ERR_WORKFLOW_DASHBOARD_MARKER",
      message: "Dashboard contains duplicate CatPaw marker blocks.",
    },
  });
  assert.deepEqual(await treeSnapshot(root), before);
});

test("start refuses an existing identity at a different deterministic path", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["work", "start", "--id", "FR-101", "--title", "Original Work"],
    ["milestone", "start", "--id", "MS-301", "--title", "Original Phase"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const before = await treeSnapshot(root);
  const cases = [
    {
      args: ["work", "start", "--id", "FR-101", "--title", "Renamed Work"],
      reason: "Work Item FR-101 already exists at work/FR-101-original-work.md.",
    },
    {
      args: [
        "milestone",
        "start",
        "--id",
        "MS-301",
        "--title",
        "Renamed Phase",
      ],
      reason: "Milestone MS-301 already exists at milestones/MS-301-original-phase.md.",
    },
  ];

  for (const item of cases) {
    const result = await runCli([
      ...item.args,
      "--project",
      root,
      "--date",
      DATE,
      "--json",
    ]);
    assert.equal(result.code, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "refused");
    assert.equal(report.reason, item.reason);
    assert.equal(report.patch, null);
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("managed tables neutralize marker-like titles and targets", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const activeMilestonesStart = "<!-- catpaw:active-milestones:start -->";
  const activeMilestonesEnd = "<!-- catpaw:active-milestones:end -->";
  const activeWorkStart = "<!-- catpaw:active-work:start -->";
  const activeWorkEnd = "<!-- catpaw:active-work:end -->";
  const scopeStart = "<!-- catpaw:milestone-scope:start -->";
  const scopeEnd = "<!-- catpaw:milestone-scope:end -->";
  const commands = [
    [
      "milestone",
      "start",
      "--id",
      "MS-301",
      "--title",
      `Launch ${activeMilestonesStart}`,
      "--target",
      `Target ${activeWorkEnd}`,
    ],
    [
      "work",
      "start",
      "--id",
      "FR-101",
      "--title",
      `Safety ${activeWorkStart} ${scopeEnd}`,
    ],
    ["work", "start", "--id", "FR-102", "--title", "Follow Up"],
  ];
  for (const command of commands) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, `${command.join(" ")}\n${result.stdout}${result.stderr}`);
  }
  for (const work of ["FR-101", "FR-102"]) {
    const result = await runCli([
      "milestone",
      "add",
      "--project",
      root,
      "--milestone",
      "MS-301",
      "--work",
      work,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, `${work}\n${result.stdout}${result.stderr}`);
  }

  const index = await readFile(path.join(root, ".catpaw/index.md"), "utf8");
  for (const marker of [
    activeMilestonesStart,
    activeMilestonesEnd,
    activeWorkStart,
    activeWorkEnd,
  ]) {
    assert.equal(index.split(marker).length - 1, 1, marker);
  }
  assert.match(index, /Launch &lt;!-- catpaw:active-milestones:start -->/);
  assert.match(index, /Target &lt;!-- catpaw:active-work:end -->/);
  assert.match(index, /Safety &lt;!-- catpaw:active-work:start -->/);

  const milestone = await readFile(
    path.join(
      root,
      ".catpaw/milestones/MS-301-launch-catpaw-active-milestones-start.md",
    ),
    "utf8",
  );
  assert.equal(milestone.split(scopeStart).length - 1, 1);
  assert.equal(milestone.split(scopeEnd).length - 1, 1);
  assert.match(milestone, /Safety &lt;!-- catpaw:active-work:start -->/);
  assert.match(milestone, /&lt;!-- catpaw:milestone-scope:end -->/);

  const subsequent = await runCli([
    "work",
    "start",
    "--project",
    root,
    "--id",
    "CHORE-303",
    "--title",
    "Subsequent Mutation",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  assert.equal(subsequent.code, 0, `${subsequent.stdout}${subsequent.stderr}`);
});

test("milestone heading neutralizes Scope marker-like title text", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const scopeStart = "<!-- catpaw:milestone-scope:start -->";
  const scopeEnd = "<!-- catpaw:milestone-scope:end -->";
  const title = `Phase ${scopeStart} and ${scopeEnd}`;
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", title],
    ["work", "start", "--id", "FR-101", "--title", "Scoped Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, `${command.join(" ")}\n${result.stdout}${result.stderr}`);
  }

  const added = await runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-101",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);

  assert.equal(added.code, 0, `${added.stdout}${added.stderr}`);
  const milestone = await readFile(
    path.join(
      root,
      ".catpaw/milestones/MS-301-phase-catpaw-milestone-scope-start-and-catpaw-milestone-scope-end.md",
    ),
    "utf8",
  );
  assert.equal(milestone.split(scopeStart).length - 1, 1);
  assert.equal(milestone.split(scopeEnd).length - 1, 1);
  assert.match(
    milestone,
    /# MS-301: Phase &lt;!-- catpaw:milestone-scope:start --> and &lt;!-- catpaw:milestone-scope:end -->/,
  );
  assert.match(milestone, /\| FR-101 \| Scoped Work \| active \|  \|/);
});

test("milestone add refuses duplicate Scope marker blocks without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["milestone", "start", "--id", "MS-301", "--title", "Duplicate Scope"],
    ["work", "start", "--id", "FR-101", "--title", "Scoped Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const milestonePath = path.join(
    root,
    ".catpaw/milestones/MS-301-duplicate-scope.md",
  );
  await writeFile(
    milestonePath,
    `${await readFile(milestonePath, "utf8")}
<!-- catpaw:milestone-scope:start -->
| Work Item ID | Title | Status | Notes |
|---|---|---|---|
<!-- catpaw:milestone-scope:end -->
`,
  );
  const before = await treeSnapshot(root);

  const result = await runCli([
    "milestone",
    "add",
    "--project",
    root,
    "--milestone",
    "MS-301",
    "--work",
    "FR-101",
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: "ERR_WORKFLOW_MILESTONE_SCOPE",
      message: "Milestone must contain exactly one ordered Scope marker block.",
    },
  });
  assert.deepEqual(await treeSnapshot(root), before);
});

test("accept-gap refuses closures that are not missing Gated done Evidence", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    ["work", "start", "--id", "FR-101", "--title", "Tracked Work"],
    [
      "work",
      "start",
      "--id",
      "BUG-202",
      "--title",
      "Cancelled Gated Work",
      "--mode",
      "gated",
    ],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const before = await treeSnapshot(root);
  const cases = [
    ["--id", "FR-101"],
    ["--id", "BUG-202", "--status", "cancelled"],
  ];

  for (const closeOptions of cases) {
    const result = await runCli([
      "work",
      "close",
      "--project",
      root,
      ...closeOptions,
      "--accept-gap",
      "Not applicable here",
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 1, `${closeOptions.join(" ")}\n${result.stderr}`);
    assert.equal(result.stderr, "");
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "refused");
    assert.equal(
      report.reason,
      "--accept-gap requires a Gated done closure with missing required Evidence.",
    );
    assert.equal(report.patch, null);
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("provider Evidence satisfies only the exact bound Work independent gate", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  for (const command of [
    [
      "work",
      "start",
      "--id",
      "BUG-202",
      "--title",
      "Provider Gate Target",
      "--mode",
      "gated",
    ],
    ["work", "start", "--id", "BUG-203", "--title", "Other Work"],
  ]) {
    const result = await runCli([
      ...command,
      "--project",
      root,
      "--date",
      DATE,
      "--apply",
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr);
  }
  const addEvidence = (work, type, title, extra = []) => runCli([
    "evidence",
    "add",
    "--project",
    root,
    "--work",
    work,
    "--type",
    type,
    "--title",
    title,
    "--body",
    `${title} contains usable provider or test evidence.`,
    ...extra,
    "--date",
    DATE,
    "--apply",
    "--json",
  ]);
  for (const result of [
    await addEvidence("BUG-202", "test", "Target Test"),
    await addEvidence("BUG-202", "provider", "Nonindependent Provider", [
      "--agent",
      "provider-agent",
    ]),
    await addEvidence("BUG-203", "provider", "Wrong Work Provider", [
      "--independent",
      "--agent",
      "provider-agent",
    ]),
  ]) {
    assert.equal(result.code, 0, result.stderr);
  }
  await writeFiles(root, {
    ".catpaw/evidence/BUG-202/provider-without-agent.md": `---
type: provider
work: BUG-202
stage: review
created: ${DATE}
updated: ${DATE}
independent: true
agent: null
lens: null
---

# Provider without agent
`,
  });
  const closeArgs = [
    "work",
    "close",
    "--project",
    root,
    "--id",
    "BUG-202",
    "--date",
    DATE,
    "--json",
  ];

  const wrongWork = await runCli(closeArgs);
  assert.equal(wrongWork.code, 1, wrongWork.stderr);
  assert.deepEqual(JSON.parse(wrongWork.stdout).gate.missing, [
    "independent-review-or-provider",
  ]);

  const correctProvider = await addEvidence(
    "BUG-202",
    "provider",
    "Correct Provider",
    ["--independent", "--agent", "provider-agent"],
  );
  assert.equal(correctProvider.code, 0, correctProvider.stderr);
  const closed = await runCli([...closeArgs, "--apply"]);
  assert.equal(closed.code, 0, closed.stderr);
  assert.deepEqual(JSON.parse(closed.stdout).gate, {
    required: ["test", "independent-review-or-provider"],
    missing: [],
    acceptedGap: false,
  });
  const work = parseFrontmatter(await readFile(
    path.join(root, ".catpaw/work/BUG-202-provider-gate-target.md"),
    "utf8",
  ));
  assert.equal(work.data.status, "done");
});
