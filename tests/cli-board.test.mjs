import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { SCHEMA_2_LAYOUT } from "../src/runtime/lib/board.mjs";
import { renderBoardReport } from "../src/runtime/lib/commands/board.mjs";

const CLI = new URL("../src/runtime/bin/catpaw.mjs", import.meta.url);
const TODAY = "2026-07-11";
const execFileAsync = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-cli-board-"));
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

async function createWrongTypeBoard(root) {
  const boardPath = path.join(root, ".catpaw");
  const planTarget = path.join(root, "plan-target");
  await writeFiles(root, {
    ".catpaw/index.md": "---\nschema: 2\n---\n\n# CatPaw Board\n",
    ".catpaw/work": "keep work bytes\n",
    "plan-target/marker.txt": "keep target bytes\n",
  });
  await mkdir(path.join(boardPath, "evidence/topics"), { recursive: true });
  await symlink(planTarget, path.join(boardPath, "plans"));
  await execFileAsync("mkfifo", [path.join(boardPath, "milestones")]);
  return { boardPath, planTarget };
}

async function wrongTypeSnapshot({ boardPath, planTarget }) {
  const milestone = await lstat(path.join(boardPath, "milestones"));
  const work = await lstat(path.join(boardPath, "work"));
  const plans = await lstat(path.join(boardPath, "plans"));
  return {
    milestoneIsFifo: milestone.isFIFO(),
    workIsFile: work.isFile(),
    workBytes: await readFile(path.join(boardPath, "work"), "utf8"),
    plansIsSymlink: plans.isSymbolicLink(),
    plansTarget: await readlink(path.join(boardPath, "plans")),
    targetBytes: await readFile(path.join(planTarget, "marker.txt"), "utf8"),
  };
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

# CatPaw Board
`,
    ".catpaw/milestones/MS-001-active.md": `---
id: MS-001
status: active
created: ${TODAY}
updated: ${TODAY}
closed: null
target: Release
---

# Active milestone
`,
    ".catpaw/milestones/MS-002-done.md": `---
id: MS-002
status: done
created: ${TODAY}
updated: ${TODAY}
closed: ${TODAY}
target: Complete
---

# Done milestone
`,
    ".catpaw/work/FR-001-active.md": `---
id: FR-001
type: feature
mode: tracked
status: active
stage: build
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# Active feature
`,
    ".catpaw/work/BUG-002-blocked.md": `---
id: BUG-002
type: bug
mode: gated
status: blocked
stage: test
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# Blocked bug
`,
    ".catpaw/work/CHORE-003-done.md": `---
id: CHORE-003
type: chore
mode: tracked
status: done
stage: reflect
created: ${TODAY}
updated: ${TODAY}
closed: ${TODAY}
---

# Done chore
`,
    ".catpaw/plans/FR-001.md": `---
work: FR-001
updated: ${TODAY}
---

# Feature plan
`,
    ".catpaw/plans/BUG-002.md": `---
work: BUG-002
updated: ${TODAY}
---

# Bug plan
`,
    ".catpaw/plans/CHORE-003.md": `---
work: CHORE-003
updated: ${TODAY}
---

# Chore plan
`,
    ".catpaw/evidence/FR-001/research.md": `---
type: research
work: FR-001
stage: think
created: ${TODAY}
updated: ${TODAY}
---

# Research
`,
    ".catpaw/evidence/FR-001/review.md": `---
type: review
work: FR-001
stage: review
created: ${TODAY}
updated: ${TODAY}
---

# Review
`,
    ".catpaw/evidence/BUG-002/test.md": `---
type: test
work: BUG-002
stage: test
created: ${TODAY}
updated: ${TODAY}
---

# Test
`,
    ".catpaw/evidence/BUG-002/provider.md": `---
type: provider
work: BUG-002
stage: review
created: ${TODAY}
updated: ${TODAY}
---

# Provider
`,
    ".catpaw/evidence/topics/reflection.md": `---
type: reflection
work: null
stage: reflect
created: ${TODAY}
updated: ${TODAY}
---

# Reflection
`,
  });
}

async function createSchema1Board(root) {
  await writeFiles(root, {
    ".catpaw/index.md": `---
runtime: 2.1.7
---

# Legacy CatPaw Index
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
    if (relativeDirectory) entries.push(`dir:${relativeDirectory}`);
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      const target = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(target, relativePath);
      } else {
        const bytes = await readFile(target);
        const mode = (await lstat(target)).mode & 0o777;
        const digest = createHash("sha256").update(bytes).digest("hex");
        entries.push(`file:${relativePath}:${mode}:${bytes.length}:${digest}`);
      }
    }
  }

  await visit(root);
  return entries;
}

test("board init defaults to a JSON dry-run without writing", async (t) => {
  const root = await fixture(t);

  const result = await runCli(["board", "init", "--project", root, "--json"]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.equal(await exists(path.join(root, ".catpaw")), false);
  const report = JSON.parse(result.stdout);
  assert.deepEqual({ ...report, patch: undefined }, {
    command: "board init",
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    schema: 2,
    mode: "dry-run",
    status: "preview",
    migrationRequired: false,
    patch: undefined,
    nextAction: "Run board init --apply to create the board.",
  });
  assert.equal(report.patch.status, "ready");
  assert.equal(report.patch.operationCount, 6);
  assert.match(report.patch.text, /^READY\n/);
  assert.match(report.patch.text, /WRITE CREATE index\.md/);
});

test("board init --apply creates a validated schema 2 layout", async (t) => {
  const root = await fixture(t);
  const home = path.join(root, "fake-home");
  const boardPath = path.join(root, ".catpaw");

  const result = await runCli(
    ["board", "init", "--project", root, "--apply", "--json"],
    { home },
  );

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "apply");
  assert.equal(report.status, "applied");
  assert.equal(report.schema, 2);
  assert.equal(report.patch.status, "ready");
  assert.equal(report.patch.operationCount, 6);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.backupPath, null);
  assert.equal(report.nextAction, "Board is ready.");
  assert.equal(
    await readFile(path.join(boardPath, "index.md"), "utf8"),
    [
      "---",
      "schema: 2",
      "---",
      "",
      "# CatPaw Board",
      "",
      "<!-- catpaw:active-milestones:start -->",
      "## Active Milestones",
      "",
      "_None._",
      "<!-- catpaw:active-milestones:end -->",
      "",
      "<!-- catpaw:active-work:start -->",
      "## Active Work",
      "",
      "_None._",
      "<!-- catpaw:active-work:end -->",
      "",
    ].join("\n"),
  );
  for (const directory of [
    ...SCHEMA_2_LAYOUT.requiredDirectories,
  ]) {
    assert.equal((await stat(path.join(boardPath, directory))).isDirectory(), true);
  }
  assert.equal(await exists(path.join(home, ".catpaw")), false);
});

test("board init is an idempotent no-op for a healthy schema 2 board", async (t) => {
  const root = await fixture(t);
  const first = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ]);
  assert.equal(first.code, 0, first.stderr);
  const before = await treeSnapshot(root);

  const second = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ]);

  assert.equal(second.code, 0, second.stderr);
  assert.equal(second.stderr, "");
  const report = JSON.parse(second.stdout);
  assert.equal(report.mode, "apply");
  assert.equal(report.status, "noop");
  assert.equal(report.patch.status, "noop");
  assert.equal(report.patch.operationCount, 0);
  assert.equal(report.patch.text, "NO CHANGES\n");
  assert.equal(report.nextAction, "Board already initialized.");
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board init never rewrites a healthy schema 2 index narrative", async (t) => {
  const root = await fixture(t);
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

# Team Work Board

This narrative belongs to the project.
`,
  });
  const before = await treeSnapshot(root);

  const result = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "noop");
  assert.equal(report.patch.status, "noop");
  assert.equal(report.patch.operationCount, 0);
  assert.equal(report.patch.text, "NO CHANGES\n");
  assert.equal(report.nextAction, "Board already initialized.");
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board status has deterministic JSON and human output without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);

  const jsonResult = await runCli([
    "board",
    "status",
    "--project",
    root,
    "--json",
  ]);
  const humanResult = await runCli(["board", "status", "--project", root]);
  const repeatedHuman = await runCli(["board", "status", "--project", root]);

  assert.equal(jsonResult.code, 0, jsonResult.stderr);
  assert.equal(jsonResult.stderr, "");
  assert.deepEqual(JSON.parse(jsonResult.stdout), {
    command: "board status",
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    schema: 2,
    counts: {
      active: { milestones: 1, work: 2, plans: 2 },
      evidence: { research: 1, review: 1, test: 1, provider: 1, reflection: 1 },
    },
    findings: [],
    migrationRequired: false,
    nextAction: "Continue active milestone work.",
  });
  assert.equal(humanResult.code, 0, humanResult.stderr);
  assert.equal(humanResult.stderr, "");
  assert.equal(
    humanResult.stdout,
    [
      "Board status",
      "Schema: 2",
      "Active: milestones 1, work 2, plans 2",
      "Evidence: research 1, review 1, test 1, provider 1, reflection 1",
      "Migration required: no",
      "Findings: 0",
      "Next: Continue active milestone work.",
      "",
    ].join("\n"),
  );
  assert.equal(repeatedHuman.stdout, humanResult.stdout);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board doctor reports a healthy schema 2 board without writes", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  const before = await treeSnapshot(root);

  const jsonResult = await runCli([
    "board",
    "doctor",
    "--project",
    root,
    "--json",
  ]);
  const humanResult = await runCli(["board", "doctor", "--project", root]);

  assert.equal(jsonResult.code, 0, jsonResult.stderr);
  assert.equal(jsonResult.stderr, "");
  assert.deepEqual(JSON.parse(jsonResult.stdout), {
    command: "board doctor",
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    schema: 2,
    mode: "read-only",
    findings: [],
    migrationRequired: false,
    fix: null,
    nextAction: "No action required.",
  });
  assert.equal(humanResult.code, 0, humanResult.stderr);
  assert.equal(
    humanResult.stdout,
    [
      "Board doctor",
      "Schema: 2",
      "Mode: read-only",
      "Migration required: no",
      "Findings: 0",
      "Next: No action required.",
      "",
    ].join("\n"),
  );
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board doctor reports every shared error finding and exits 1", async (t) => {
  const root = await fixture(t);
  await createSchema2Board(root);
  await writeFiles(root, {
    ".catpaw/plans/FR-999-missing.md": `---
work: FR-999
updated: ${TODAY}
---

# Missing Work Item plan
`,
  });
  const before = await treeSnapshot(root);

  const jsonResult = await runCli([
    "board",
    "doctor",
    "--project",
    root,
    "--json",
  ]);
  const humanResult = await runCli(["board", "doctor", "--project", root]);

  assert.equal(jsonResult.code, 1, jsonResult.stderr);
  assert.equal(jsonResult.stderr, "");
  const report = JSON.parse(jsonResult.stdout);
  assert.equal(report.findings.length, 1);
  assert.deepEqual(
    {
      severity: report.findings[0].severity,
      code: report.findings[0].code,
      filePath: report.findings[0].filePath,
      message: report.findings[0].message,
    },
    {
      severity: "error",
      code: "missing-work-item",
      filePath: ".catpaw/plans/FR-999-missing.md",
      message: "Plan references missing Work Item FR-999.",
    },
  );
  assert.equal(report.nextAction, "Resolve the reported errors.");
  assert.equal(humanResult.code, 1, humanResult.stderr);
  assert.equal(
    humanResult.stdout,
    [
      "Board doctor",
      "Schema: 2",
      "Mode: read-only",
      "Migration required: no",
      "Findings: 1",
      "- ERROR missing-work-item [.catpaw/plans/FR-999-missing.md] Plan references missing Work Item FR-999.",
      "Next: Resolve the reported errors.",
      "",
    ].join("\n"),
  );
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board doctor --fix defaults to a layout-only dry-run", async (t) => {
  const root = await fixture(t);
  await writeFiles(root, {
    ".catpaw/index.md": "---\nschema: 2\n---\n\n# CatPaw Board\n",
  });
  const before = await treeSnapshot(root);

  const result = await runCli([
    "board",
    "doctor",
    "--fix",
    "--project",
    root,
    "--json",
  ]);
  const human = await runCli([
    "board",
    "doctor",
    "--fix",
    "--project",
    root,
  ]);
  const repeatedHuman = await runCli([
    "board",
    "doctor",
    "--fix",
    "--project",
    root,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "dry-run");
  assert.deepEqual(
    report.findings.map((item) => [item.severity, item.code, item.directory]),
    SCHEMA_2_LAYOUT.requiredDirectories.map((directory) => [
      "warning",
      "missing-board-directory",
      directory,
    ]),
  );
  assert.equal(report.fix.status, "preview");
  assert.equal(report.fix.patch.status, "ready");
  assert.equal(report.fix.patch.operationCount, 5);
  assert.match(report.fix.patch.text, /^READY\n/);
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    assert.match(report.fix.patch.text, new RegExp(`ENSURE DIR ${directory}`));
  }
  assert.doesNotMatch(report.fix.patch.text, /WRITE|MOVE|REMOVE/);
  assert.equal(
    report.nextAction,
    "Run board doctor --fix --apply to create missing directories.",
  );
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Findings: 5\n/);
  assert.match(human.stdout, /- WARNING missing-board-directory/);
  assert.match(human.stdout, /Fix: preview\nPatch:\nREADY\n/);
  assert.match(human.stdout, /ENSURE DIR evidence\/topics/);
  assert.equal(repeatedHuman.stdout, human.stdout);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board doctor --fix --apply creates only missing standard directories", async (t) => {
  const root = await fixture(t);
  const indexPath = path.join(root, ".catpaw/index.md");
  await writeFiles(root, {
    ".catpaw/index.md": "---\nschema: 2\n---\n\n# Preserve this narrative byte-for-byte.\n",
  });
  const indexBefore = await readFile(indexPath);

  const result = await runCli([
    "board",
    "doctor",
    "--fix",
    "--apply",
    "--project",
    root,
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "apply");
  assert.deepEqual(report.findings, []);
  assert.equal(report.fix.status, "applied");
  assert.equal(report.fix.patch.status, "ready");
  assert.equal(report.fix.patch.operationCount, 5);
  assert.deepEqual(report.fix.warnings, []);
  assert.equal(report.fix.backupPath, null);
  assert.doesNotMatch(report.fix.patch.text, /WRITE|MOVE|REMOVE/);
  assert.equal(report.nextAction, "No action required.");
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    assert.equal(
      (await stat(path.join(root, ".catpaw", directory))).isDirectory(),
      true,
    );
  }
  assert.deepEqual(await readFile(indexPath), indexBefore);

  const verified = await runCli([
    "board",
    "doctor",
    "--project",
    root,
    "--json",
  ]);
  assert.equal(verified.code, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout).findings, []);
});

test("schema 1 boards stay read-only and recommend board migrate", async (t) => {
  const root = await fixture(t);
  await createSchema1Board(root);
  const before = await treeSnapshot(root);

  const status = await runCli([
    "board",
    "status",
    "--project",
    root,
    "--json",
  ]);
  const init = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--apply",
    "--json",
  ]);
  const doctor = await runCli([
    "board",
    "doctor",
    "--project",
    root,
    "--json",
  ]);
  const fix = await runCli([
    "board",
    "doctor",
    "--fix",
    "--apply",
    "--project",
    root,
    "--json",
  ]);

  assert.equal(status.code, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).schema, 1);
  assert.equal(JSON.parse(status.stdout).migrationRequired, true);
  assert.equal(JSON.parse(status.stdout).nextAction, "Run board migrate.");

  assert.equal(init.code, 0, init.stderr);
  assert.deepEqual(JSON.parse(init.stdout), {
    command: "board init",
    projectRoot: root,
    boardPath: path.join(root, ".catpaw"),
    schema: 1,
    mode: "read-only",
    status: "migration-required",
    migrationRequired: true,
    patch: null,
    nextAction: "Run board migrate.",
  });

  assert.equal(doctor.code, 0, doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).migrationRequired, true);
  assert.equal(JSON.parse(doctor.stdout).nextAction, "Run board migrate.");

  assert.equal(fix.code, 1, fix.stderr);
  assert.equal(fix.stderr, "");
  const fixReport = JSON.parse(fix.stdout);
  assert.equal(fixReport.schema, 1);
  assert.equal(fixReport.mode, "read-only");
  assert.deepEqual(fixReport.fix, {
    status: "refused",
    reason: "Schema 1 boards require migration.",
  });
  assert.equal(fixReport.nextAction, "Run board migrate.");
  assert.deepEqual(await treeSnapshot(root), before);
});

test("schema 1 status counts legacy test and review Evidence by kind", async (t) => {
  const root = await fixture(t);
  await createSchema1Board(root);
  await writeFiles(root, {
    ".catpaw/tests/matrices/FR-001.md": "# Legacy test matrix\n",
    ".catpaw/reviews/FR-001/summary.md": "# Legacy review\n",
  });
  const before = await treeSnapshot(root);

  const result = await runCli([
    "board",
    "status",
    "--project",
    root,
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).counts.evidence, {
    research: 0,
    review: 1,
    test: 1,
    provider: 0,
    reflection: 0,
  });
  assert.deepEqual(await treeSnapshot(root), before);
});

test("missing, malformed, and unknown boards fail read commands without writes", async (t) => {
  const missingRoot = await fixture(t);
  const missingBefore = await treeSnapshot(missingRoot);
  const missing = await runCli([
    "board",
    "status",
    "--project",
    missingRoot,
    "--json",
  ]);
  assert.equal(missing.code, 1, missing.stderr);
  assert.equal(missing.stderr, "");
  assert.equal(JSON.parse(missing.stdout).schema, null);
  assert.deepEqual(
    JSON.parse(missing.stdout).findings.map((item) => item.code),
    ["missing-index"],
  );
  assert.deepEqual(await treeSnapshot(missingRoot), missingBefore);

  const malformedRoot = await fixture(t);
  await writeFiles(malformedRoot, {
    ".catpaw/index.md": "---\nschema: 2\n",
  });
  const malformedBefore = await treeSnapshot(malformedRoot);
  const malformedStatus = await runCli([
    "board",
    "status",
    "--project",
    malformedRoot,
    "--json",
  ]);
  const malformedInit = await runCli([
    "board",
    "init",
    "--project",
    malformedRoot,
    "--json",
  ]);
  assert.equal(malformedStatus.code, 1, malformedStatus.stderr);
  assert.deepEqual(
    JSON.parse(malformedStatus.stdout).findings.map((item) => item.code),
    ["frontmatter-parse"],
  );
  assert.equal(malformedInit.code, 1, malformedInit.stderr);
  assert.equal(malformedInit.stderr, "");
  assert.equal(JSON.parse(malformedInit.stdout).status, "invalid-board");
  assert.equal(JSON.parse(malformedInit.stdout).patch, null);
  assert.deepEqual(await treeSnapshot(malformedRoot), malformedBefore);

  const unknownRoot = await fixture(t);
  await writeFiles(unknownRoot, {
    ".catpaw/index.md": "---\nschema: 3\n---\n\n# Unknown schema\n",
  });
  const unknownBefore = await treeSnapshot(unknownRoot);
  const unknownStatus = await runCli([
    "board",
    "status",
    "--project",
    unknownRoot,
    "--json",
  ]);
  const unknownInit = await runCli([
    "board",
    "init",
    "--project",
    unknownRoot,
    "--json",
  ]);
  assert.equal(unknownStatus.code, 1, unknownStatus.stderr);
  assert.equal(JSON.parse(unknownStatus.stdout).schema, 3);
  assert.ok(
    JSON.parse(unknownStatus.stdout).findings.some(
      (item) => item.code === "schema-enum",
    ),
  );
  assert.equal(unknownInit.code, 1, unknownInit.stderr);
  assert.equal(unknownInit.stderr, "");
  assert.equal(JSON.parse(unknownInit.stdout).status, "invalid-board");
  assert.equal(JSON.parse(unknownInit.stdout).patch, null);
  assert.deepEqual(await treeSnapshot(unknownRoot), unknownBefore);
});

test("unknown arguments and invalid option combinations exit 2", async (t) => {
  const root = await fixture(t);
  const before = await treeSnapshot(root);
  const cases = [
    {
      args: [],
      message: "expected board init|status|doctor|migrate",
    },
    {
      args: ["unknown"],
      message: "unknown command: unknown",
    },
    {
      args: ["board", "unknown"],
      message: "unknown board command: unknown",
    },
    {
      args: ["board", "status", "extra"],
      message: "unknown argument: extra",
    },
    {
      args: ["board", "status", "--wat"],
      message: "unknown argument: --wat",
    },
    {
      args: ["board", "status", "--json", "--json"],
      message: "duplicate option: --json",
    },
    {
      args: ["board", "init", "--project"],
      message: "--project requires a value",
    },
    {
      args: [
        "board",
        "init",
        "--project",
        root,
        "--apply",
        "--dry-run",
      ],
      message: "--dry-run and --apply are mutually exclusive",
    },
    {
      args: ["board", "status", "--project", root, "--apply"],
      message: "--apply is not valid for board status",
    },
    {
      args: ["board", "doctor", "--project", root, "--apply"],
      message: "--apply requires --fix for board doctor",
    },
    {
      args: ["board", "doctor", "--project", root, "--dry-run"],
      message: "--dry-run requires --fix for board doctor",
    },
    {
      args: ["board", "init", "--project", root, "--fix"],
      message: "--fix is only valid for board doctor",
    },
  ];

  for (const { args, message } of cases) {
    const result = await runCli(args);
    assert.equal(result.code, 2, `${args.join(" ")}\n${result.stderr}`);
    assert.equal(result.stdout, "", args.join(" "));
    assert.equal(result.stderr, `catpaw: ${message}\n`, args.join(" "));
  }
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board init honors cwd, a relative --board, and explicit --dry-run", async (t) => {
  const root = await fixture(t);
  const physicalRoot = await realpath(root);
  const before = await treeSnapshot(root);
  const args = ["board", "init", "--board", "custom-board", "--dry-run"];

  const jsonResult = await runCli([...args, "--json"], { cwd: root });
  const humanResult = await runCli(args, { cwd: root });
  const repeatedHuman = await runCli(args, { cwd: root });

  assert.equal(jsonResult.code, 0, jsonResult.stderr);
  const report = JSON.parse(jsonResult.stdout);
  assert.equal(report.projectRoot, physicalRoot);
  assert.equal(report.boardPath, path.join(physicalRoot, "custom-board"));
  assert.equal(report.mode, "dry-run");
  assert.equal(humanResult.code, 0, humanResult.stderr);
  assert.match(
    humanResult.stdout,
    /^Board init\nSchema: 2\nMode: dry-run\nStatus: preview\nMigration required: no\nPatch:\nREADY\n/,
  );
  for (const directory of SCHEMA_2_LAYOUT.requiredDirectories) {
    assert.match(humanResult.stdout, new RegExp(`ENSURE DIR ${directory}`));
  }
  assert.match(humanResult.stdout, /WRITE CREATE index\.md/);
  assert.match(
    humanResult.stdout,
    /Next: Run board init --apply to create the board\.\n$/,
  );
  assert.equal(repeatedHuman.stdout, humanResult.stdout);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("board init reports a blocked patch plan with exit 1", async (t) => {
  const root = await fixture(t);
  const before = await treeSnapshot(root);

  const result = await runCli([
    "board",
    "init",
    "--project",
    root,
    "--board",
    "missing-parent/.catpaw",
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.status, "blocked");
  assert.equal(report.patch.status, "blocked");
  assert.match(report.patch.text, /^BLOCKED\n/);
  assert.match(report.patch.text, /BLOCK missing-root-parent/);
  assert.equal(report.nextAction, "Resolve the patch blockers.");
  assert.deepEqual(await treeSnapshot(root), before);
});

test("init, status, and doctor report non-directory layout entries", async (t) => {
  const root = await fixture(t);
  const targets = await createWrongTypeBoard(root);
  const before = await wrongTypeSnapshot(targets);
  const args = ["--project", root, "--json"];

  const init = await runCli(["board", "init", ...args]);
  const status = await runCli(["board", "status", ...args]);
  const doctor = await runCli(["board", "doctor", ...args]);

  for (const [command, result] of Object.entries({ init, status, doctor })) {
    assert.equal(result.code, 1, `${command}\n${result.stderr}`);
    assert.equal(result.stderr, "", command);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.findings
        .filter((item) => item.code === "invalid-board-directory")
        .map((item) => [
          item.severity,
          item.directory,
          item.actualType,
          item.fixable,
        ]),
      [
        ["error", "milestones", "special", false],
        ["error", "work", "file", false],
        ["error", "plans", "symlink", false],
      ],
      command,
    );
  }

  const initReport = JSON.parse(init.stdout);
  assert.equal(initReport.status, "invalid-board");
  assert.equal(initReport.patch, null);
  assert.equal(JSON.parse(status.stdout).counts.active.plans, 0);
  assert.equal(JSON.parse(doctor.stdout).fix, null);
  assert.deepEqual(await wrongTypeSnapshot(targets), before);
});

test("doctor applies missing directories while preserving a non-fixable conflict", async (t) => {
  const root = await fixture(t);
  const boardPath = path.join(root, ".catpaw");
  const workPath = path.join(boardPath, "work");
  const workBytes = "do not replace this file\n";
  await writeFiles(root, {
    ".catpaw/index.md": "---\nschema: 2\n---\n\n# CatPaw Board\n",
    ".catpaw/work": workBytes,
  });
  await mkdir(path.join(boardPath, "evidence/topics"), { recursive: true });

  const result = await runCli([
    "board",
    "doctor",
    "--fix",
    "--apply",
    "--project",
    root,
    "--json",
  ]);

  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.fix.status, "applied");
  assert.equal(report.fix.patch.status, "ready");
  assert.deepEqual(
    report.findings.map((item) => [item.code, item.directory, item.fixable]),
    [["invalid-board-directory", "work", false]],
  );
  assert.equal((await stat(path.join(boardPath, "milestones"))).isDirectory(), true);
  assert.equal((await stat(path.join(boardPath, "plans"))).isDirectory(), true);
  assert.equal((await lstat(workPath)).isFile(), true);
  assert.equal(await readFile(workPath, "utf8"), workBytes);
});

test("doctor staged validation failure returns deterministic JSON and rolls back", async (t) => {
  const root = await fixture(t);
  const boardPath = path.join(root, ".catpaw");
  const plansPath = path.join(boardPath, "plans");
  await writeFiles(root, {
    ".catpaw/index.md": "---\nschema: 2\n---\n\n# CatPaw Board\n",
    ".catpaw/work/FR-001-malformed.md": "---\nid: FR-001\n",
  });
  await mkdir(path.join(boardPath, "milestones"), { recursive: true });
  await mkdir(path.join(boardPath, "evidence/topics"), { recursive: true });
  const before = await treeSnapshot(root);
  const args = [
    "board",
    "doctor",
    "--fix",
    "--apply",
    "--project",
    root,
    "--json",
  ];

  const result = await runCli(args);
  const repeated = await runCli(args);

  assert.equal(result.code, 1);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: "ERR_BOARD_DOCTOR_STAGED_VALIDATION",
      message: "Staged board failed schema 2 layout validation.",
    },
  });
  assert.equal(repeated.stdout, result.stdout);
  assert.equal(repeated.stderr, "");
  assert.equal(await exists(plansPath), false);
  assert.deepEqual(await treeSnapshot(root), before);
});

test("doctor reports a blocked fix plan without applying or recommending it", async (t) => {
  const root = await fixture(t);
  const actualBoard = path.join(root, "actual-board");
  await writeFiles(root, {
    "actual-board/index.md": "---\nschema: 2\n---\n\n# Symlinked Board\n",
    "actual-board/marker.txt": "keep board bytes\n",
  });
  await Promise.all(
    SCHEMA_2_LAYOUT.requiredDirectories
      .filter((directory) => directory !== "work")
      .map((directory) =>
        mkdir(path.join(actualBoard, directory), { recursive: true })
      ),
  );
  const boardLink = path.join(root, ".catpaw");
  await symlink(actualBoard, boardLink);
  const before = await treeSnapshot(actualBoard);

  const base = ["board", "doctor", "--fix", "--project", root];
  const dryRun = await runCli([...base, "--json"]);
  const apply = await runCli([...base, "--apply", "--json"]);
  const repeatedApply = await runCli([...base, "--apply", "--json"]);

  for (const [mode, result] of Object.entries({ dryRun, apply })) {
    assert.equal(result.code, 1, `${mode}\n${result.stderr}`);
    assert.equal(result.stderr, "", mode);
    const report = JSON.parse(result.stdout);
    assert.equal(report.fix.status, "blocked", mode);
    assert.equal(report.fix.patch.status, "blocked", mode);
    assert.match(report.fix.patch.text, /^BLOCKED\n/, mode);
    assert.match(report.fix.patch.text, /symlink-traversal/, mode);
    assert.equal(report.nextAction, "Resolve the patch blockers.", mode);
    assert.doesNotMatch(report.nextAction, /--apply/, mode);
  }
  assert.equal(JSON.parse(dryRun.stdout).mode, "dry-run");
  assert.equal(JSON.parse(apply.stdout).mode, "apply");
  assert.equal(repeatedApply.stdout, apply.stdout);
  assert.equal(await readlink(boardLink), actualBoard);
  assert.equal(await exists(path.join(actualBoard, "work")), false);
  assert.deepEqual(await treeSnapshot(actualBoard), before);
});

test("a non-directory board root has stable human and JSON operational errors", async (t) => {
  const root = await fixture(t);
  const boardPath = path.join(root, "board-file");
  const bytes = "not a board directory\n";
  await writeFile(boardPath, bytes);
  const args = ["board", "status", "--project", root, "--board", boardPath];

  const human = await runCli(args);
  const repeatedHuman = await runCli(args);
  const json = await runCli([...args, "--json"]);
  const repeatedJson = await runCli([...args, "--json"]);

  assert.equal(human.code, 1);
  assert.equal(human.stdout, "");
  assert.equal(
    human.stderr,
    `catpaw: Board root is not a directory: ${boardPath}\n`,
  );
  assert.equal(repeatedHuman.stderr, human.stderr);
  assert.doesNotMatch(human.stderr, /\n\s+at |Node\.js/);

  assert.equal(json.code, 1);
  assert.equal(json.stderr, "");
  assert.deepEqual(JSON.parse(json.stdout), {
    error: {
      code: "ERR_BOARD_ROOT_NOT_DIRECTORY",
      message: `Board root is not a directory: ${boardPath}`,
    },
  });
  assert.equal(repeatedJson.stdout, json.stdout);
  assert.equal(await readFile(boardPath, "utf8"), bytes);
});

test("human rendering preserves apply warnings and backup paths", () => {
  const warning = {
    code: "rollback-cleanup-failed",
    path: "/tmp/catpaw-rollback",
    message: "Could not remove the rollback directory.",
  };
  const init = renderBoardReport({
    command: "board init",
    schema: 2,
    mode: "apply",
    status: "applied",
    migrationRequired: false,
    findings: [],
    patch: null,
    warnings: [warning],
    backupPath: "/tmp/catpaw-backup",
    nextAction: "Inspect the warning.",
  });
  const doctor = renderBoardReport({
    command: "board doctor",
    schema: 2,
    mode: "apply",
    migrationRequired: false,
    findings: [],
    fix: {
      status: "applied",
      patch: null,
      warnings: [warning],
      backupPath: "/tmp/catpaw-backup",
    },
    nextAction: "Inspect the warning.",
  });

  for (const output of [init, doctor]) {
    assert.match(output, /Backup: \/tmp\/catpaw-backup\n/);
    assert.match(output, /Warnings: 1\n/);
    assert.match(
      output,
      /- rollback-cleanup-failed \[\/tmp\/catpaw-rollback\] Could not remove the rollback directory\./,
    );
  }
});
