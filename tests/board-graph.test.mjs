import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadBoard,
  SCHEMA_2_LAYOUT,
} from "../src/runtime/lib/board.mjs";
import { collectBoardFindings } from "../src/runtime/lib/findings.mjs";
import { buildArtifactGraph } from "../src/runtime/lib/graph.mjs";

const TODAY = "2026-07-11";

async function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-board-graph-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFiles(root, files);
  return root;
}

function schema2Files() {
  return {
    ".catpaw/index.md": `---
schema: 2
---

# CatPaw Board
`,
    ".catpaw/milestones/MS-002-later.md": `---
id: MS-002
status: blocked
created: ${TODAY}
updated: ${TODAY}
closed: null
target: Later
---

# MS-002 Later
`,
    ".catpaw/milestones/MS-001-release.md": `---
id: MS-001
status: active
created: ${TODAY}
updated: ${TODAY}
closed: null
target: Release
---

# MS-001 Release

## Scope

| Work Item | Title | Status | Notes |
|---|---|---|---|
| FR-001 | Shared graph | active | current |
`,
    ".catpaw/work/FR-002-later.md": `---
id: FR-002
type: feature
mode: tracked
status: blocked
stage: plan
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# FR-002 Later
`,
    ".catpaw/work/FR-001-shared-graph.md": `---
id: FR-001
type: feature
mode: tracked
status: active
stage: build
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# FR-001 Shared Graph
`,
    ".catpaw/plans/FR-001-shared-graph.md": `---
work: FR-001
updated: ${TODAY}
---

# Plan
`,
    ".catpaw/evidence/FR-001/02-test.md": `---
type: test
work: FR-001
stage: test
created: ${TODAY}
updated: ${TODAY}
independent: false
agent: Codex
lens: null
---

# Test Evidence
`,
    ".catpaw/evidence/FR-001/01-review.md": `---
type: review
work: FR-001
stage: review
created: ${TODAY}
updated: ${TODAY}
independent: true
agent: Claude Code
lens: system-contracts
---

# Review Evidence

The graph contract is sound.
`,
    ".catpaw/evidence/topics/runtime-reflection.md": `---
type: reflection
work: null
stage: reflect
created: ${TODAY}
updated: ${TODAY}
independent: false
agent: null
lens: null
---

# Runtime Reflection
`,
  };
}

test("exports one deeply frozen schema 2 layout descriptor", () => {
  assert.deepEqual(SCHEMA_2_LAYOUT.artifactRoots, {
    milestones: "milestones",
    workItems: "work",
    plans: "plans",
    evidence: "evidence",
  });
  assert.deepEqual(SCHEMA_2_LAYOUT.requiredDirectories, [
    "milestones",
    "work",
    "plans",
    "evidence",
    "evidence/topics",
  ]);
  assert.equal(Object.isFrozen(SCHEMA_2_LAYOUT), true);
  assert.equal(Object.isFrozen(SCHEMA_2_LAYOUT.artifactRoots), true);
  assert.equal(Object.isFrozen(SCHEMA_2_LAYOUT.requiredDirectories), true);
  assert.throws(() => {
    SCHEMA_2_LAYOUT.artifactRoots.workItems = "reqs";
  }, TypeError);
  assert.throws(() => {
    SCHEMA_2_LAYOUT.requiredDirectories.push("extra");
  }, TypeError);
});

test("loads a schema 2 board in deterministic artifact order", async (t) => {
  const root = await fixture(t, schema2Files());

  const board = await loadBoard({ projectRoot: root });

  assert.equal(board.schema, 2);
  assert.equal(board.runtime, null);
  assert.deepEqual(board.milestones.map((item) => item.id), ["MS-001", "MS-002"]);
  assert.deepEqual(board.workItems.map((item) => item.id), ["FR-001", "FR-002"]);
  assert.deepEqual(board.plans.map((item) => item.work), ["FR-001"]);
  assert.deepEqual(
    board.evidence.map((item) => item.path),
    [
      ".catpaw/evidence/FR-001/01-review.md",
      ".catpaw/evidence/FR-001/02-test.md",
      ".catpaw/evidence/topics/runtime-reflection.md",
    ],
  );
  assert.deepEqual(board.findings, []);
});

test("preserves typed Evidence metadata, project-relative path, and body", async (t) => {
  const root = await fixture(t, schema2Files());

  const board = await loadBoard({ projectRoot: root });
  const evidence = board.evidence.find((item) => item.type === "review");

  assert.deepEqual(
    {
      type: evidence?.type,
      stage: evidence?.stage,
      independent: evidence?.independent,
      agent: evidence?.agent,
      lens: evidence?.lens,
      path: evidence?.path,
      body: evidence?.body,
    },
    {
      type: "review",
      stage: "review",
      independent: true,
      agent: "Claude Code",
      lens: "system-contracts",
      path: ".catpaw/evidence/FR-001/01-review.md",
      body: "\n# Review Evidence\n\nThe graph contract is sound.\n",
    },
  );
});

test("builds explicit milestone, plan, and Evidence links to Work Items", async (t) => {
  const root = await fixture(t, schema2Files());
  const board = await loadBoard({ projectRoot: root });

  const graph = buildArtifactGraph(board);

  assert.deepEqual(
    graph.edges.map((edge) => [
      edge.relation,
      edge.from.kind,
      edge.from.id,
      edge.to.kind,
      edge.to.id,
      edge.resolved,
    ]),
    [
      ["milestone-work", "milestone", "MS-001", "workItem", "FR-001", true],
      ["plan-work", "plan", ".catpaw/plans/FR-001-shared-graph.md", "workItem", "FR-001", true],
      [
        "evidence-work",
        "evidence",
        ".catpaw/evidence/FR-001/01-review.md",
        "workItem",
        "FR-001",
        true,
      ],
      [
        "evidence-work",
        "evidence",
        ".catpaw/evidence/FR-001/02-test.md",
        "workItem",
        "FR-001",
        true,
      ],
    ],
  );
  assert.equal(
    graph.nodes.find((node) => node.kind === "workItem" && node.id === "FR-001")?.path,
    ".catpaw/work/FR-001-shared-graph.md",
  );
});

test("reports invalid status, stage, and type without normalizing metadata", async (t) => {
  const files = schema2Files();
  files[".catpaw/work/FR-001-shared-graph.md"] = `---
id: FR-001
type: bug
mode: tracked
status: paused
stage: coding
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# Invalid Work Item
`;
  const root = await fixture(t, files);

  const board = await loadBoard({ projectRoot: root });
  const work = board.workItems.find((item) => item.id === "FR-001");
  const invalidFields = board.findings
    .filter((item) => item.filePath === ".catpaw/work/FR-001-shared-graph.md")
    .map((item) => [item.code, item.field])
    .sort((left, right) => left[1].localeCompare(right[1]));

  assert.equal(work?.type, "bug");
  assert.equal(work?.status, "paused");
  assert.equal(work?.stage, "coding");
  assert.deepEqual(invalidFields, [
    ["schema-enum", "stage"],
    ["schema-enum", "status"],
    ["schema-id-type", "type"],
  ]);
});

test("reports every graph reference to a missing Work Item with relative paths", async (t) => {
  const files = schema2Files();
  files[".catpaw/milestones/MS-001-release.md"] = `---
id: MS-001
status: active
created: ${TODAY}
updated: ${TODAY}
closed: null
target: Release
---

# MS-001 Release

## Scope

| Work Item | Title | Status | Notes |
|---|---|---|---|
| FR-999 | Missing feature | active | stale |
`;
  files[".catpaw/plans/BUG-999-missing.md"] = `---
work: BUG-999
updated: ${TODAY}
---

# Missing Plan Target
`;
  files[".catpaw/evidence/CHORE-999/missing.md"] = `---
type: provider
work: CHORE-999
stage: review
created: ${TODAY}
updated: ${TODAY}
independent: true
agent: Claude Code
lens: system-contracts
---

# Missing Evidence Target
`;
  const root = await fixture(t, files);
  const board = await loadBoard({ projectRoot: root });
  const graph = buildArtifactGraph(board);

  const missing = collectBoardFindings(board, graph).filter(
    (item) => item.code === "missing-work-item",
  );

  assert.deepEqual(
    missing.map((item) => [item.relation, item.work, item.filePath]),
    [
      ["milestone-work", "FR-999", ".catpaw/milestones/MS-001-release.md"],
      ["plan-work", "BUG-999", ".catpaw/plans/BUG-999-missing.md"],
      ["evidence-work", "CHORE-999", ".catpaw/evidence/CHORE-999/missing.md"],
    ],
  );
  assert.ok(missing.every((item) => !path.isAbsolute(item.filePath)));
});

test("turns strict frontmatter parse failures into findings", async (t) => {
  const files = schema2Files();
  files[".catpaw/plans/broken.md"] = `---
work: FR-001
updated: ${TODAY}
`;
  const root = await fixture(t, files);

  const board = await loadBoard({ projectRoot: root });
  const finding = board.findings.find((item) => item.code === "frontmatter-parse");

  assert.equal(finding?.severity, "error");
  assert.equal(finding?.filePath, ".catpaw/plans/broken.md");
  assert.match(finding?.message ?? "", /closing frontmatter delimiter/i);
});

test("blocks board loading when index.md is missing", async (t) => {
  const root = await fixture(t, {
    ".catpaw/reqs/FR-001-legacy.md": `---
id: FR-001
status: active
closed: null
---

# Legacy Work
`,
  });

  const board = await loadBoard({ projectRoot: root });
  const finding = board.findings.find((item) => item.code === "missing-index");

  assert.equal(board.schema, null);
  assert.equal(board.schemaVersion, null);
  assert.deepEqual(board.workItems, []);
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.filePath, ".catpaw/index.md");
});

test("keeps malformed index frontmatter in an unknown blocked schema state", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": `---
runtime: 2.1.7
`,
    ".catpaw/reqs/FR-001-legacy.md": `---
id: FR-001
status: active
closed: null
---

# Legacy Work
`,
  });

  const board = await loadBoard({ projectRoot: root });
  const finding = board.findings.find((item) => item.code === "frontmatter-parse");

  assert.equal(board.schema, null);
  assert.equal(board.schemaVersion, null);
  assert.deepEqual(board.workItems, []);
  assert.equal(finding?.filePath, ".catpaw/index.md");
});

test("keeps internal board kind when parsed index metadata declares kind", async (t) => {
  const files = schema2Files();
  files[".catpaw/index.md"] = `---
schema: 2
kind: evidence
---

# CatPaw Board
`;
  const root = await fixture(t, files);

  const board = await loadBoard({ projectRoot: root });
  const finding = board.findings.find(
    (item) => item.code === "schema-additionalProperties" && item.field === "kind",
  );

  assert.equal(board.index.kind, "board");
  assert.equal(board.index.metadata.kind, "evidence");
  assert.equal(finding?.artifactKind, "board");
});

test("reports duplicate Work Item IDs and leaves graph targets ambiguous", async (t) => {
  const files = schema2Files();
  files[".catpaw/work/FR-001-duplicate.md"] = files[
    ".catpaw/work/FR-001-shared-graph.md"
  ].replace("# FR-001 Shared Graph", "# FR-001 Duplicate");
  files[".catpaw/work/FR-002-duplicate.md"] = files[
    ".catpaw/work/FR-002-later.md"
  ].replace("# FR-002 Later", "# FR-002 Duplicate");
  const root = await fixture(t, files);
  const board = await loadBoard({ projectRoot: root });
  const graph = buildArtifactGraph(board);
  const findings = collectBoardFindings(board, graph);

  assert.deepEqual(
    (graph.duplicates ?? []).map((item) => [item.id, item.paths]),
    [
      [
        "FR-001",
        [
          ".catpaw/work/FR-001-duplicate.md",
          ".catpaw/work/FR-001-shared-graph.md",
        ],
      ],
      [
        "FR-002",
        [
          ".catpaw/work/FR-002-duplicate.md",
          ".catpaw/work/FR-002-later.md",
        ],
      ],
    ],
  );
  assert.deepEqual(
    findings
      .filter((item) => item.code === "duplicate-work-item-id")
      .map((item) => [item.work, item.paths]),
    (graph.duplicates ?? []).map((item) => [item.id, item.paths]),
  );

  const ambiguousEdges = graph.edges.filter((edge) => edge.to.id === "FR-001");
  assert.ok(ambiguousEdges.length > 0);
  assert.ok(ambiguousEdges.every((edge) => edge.resolved === false));
  assert.ok(ambiguousEdges.every((edge) => edge.resolution === "ambiguous"));
  assert.ok(ambiguousEdges.every((edge) => edge.to.path === null));
  assert.equal(
    findings.some(
      (item) => item.code === "missing-work-item" && item.work === "FR-001",
    ),
    false,
  );
});

test("reports an unsupported declared board schema without treating it as schema 1", async (t) => {
  const files = schema2Files();
  files[".catpaw/index.md"] = `---
schema: 3
---

# Unsupported Board
`;
  const root = await fixture(t, files);

  const board = await loadBoard({ projectRoot: root });
  const finding = board.findings.find(
    (item) => item.code === "schema-enum" && item.field === "schema",
  );

  assert.equal(board.schema, 3);
  assert.deepEqual(board.workItems, []);
  assert.equal(finding?.filePath, ".catpaw/index.md");
});

test("keeps schema 1 boards readable and byte-identical", async (t) => {
  const req = `---
id: FR-001
type: feature
status: active
level: L2
created: ${TODAY}
updated: ${TODAY}
closed: null
---

# FR-001 Legacy Work
`;
  const root = await fixture(t, {
    ".catpaw/index.md": `---
runtime: 2.1.7
---

# Legacy Board
`,
    ".catpaw/reqs/FR-001-legacy.md": req,
  });
  const reqPath = path.join(root, ".catpaw/reqs/FR-001-legacy.md");
  const before = await readFile(reqPath, "utf8");

  const board = await loadBoard({ projectRoot: root });

  assert.equal(board.schema, 1);
  assert.equal(board.runtime, "2.1.7");
  assert.deepEqual(board.workItems.map((item) => item.id), ["FR-001"]);
  assert.equal(await readFile(reqPath, "utf8"), before);
});

test("skips a schema 2 artifact root that is not a directory", async (t) => {
  const workBytes = "reserved by another file\n";
  const root = await fixture(t, {
    ".catpaw/index.md": `---
schema: 2
---

# CatPaw Board
`,
    ".catpaw/work": workBytes,
  });

  const board = await loadBoard({ projectRoot: root });

  assert.equal(board.schema, 2);
  assert.deepEqual(board.workItems, []);
  assert.equal(await readFile(path.join(root, ".catpaw/work"), "utf8"), workBytes);
});

test("rejects a board root that exists but is not a directory", async (t) => {
  const root = await fixture(t, {
    "board-file": "not a directory\n",
  });
  const boardPath = path.join(root, "board-file");

  await assert.rejects(
    loadBoard({ projectRoot: root, boardPath }),
    (error) => {
      assert.equal(error.code, "ERR_BOARD_ROOT_NOT_DIRECTORY");
      assert.equal(error.message, `Board root is not a directory: ${boardPath}`);
      return true;
    },
  );
});

test("Gated Work closed as done requires usable test and independent Evidence", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": `---
schema: 2
---

# CatPaw Board
`,
    ".catpaw/work/BUG-401-gate.md": `---
id: BUG-401
type: bug
mode: gated
status: done
stage: reflect
created: ${TODAY}
updated: ${TODAY}
closed: ${TODAY}
---

# BUG-401 Gate
`,
    ".catpaw/evidence/BUG-401/test.md": `---
type: test
work: BUG-401
stage: test
created: ${TODAY}
updated: ${TODAY}
independent: false
agent: null
lens: null
---

# Empty Test

## Record

_No body supplied._
`,
    ".catpaw/evidence/BUG-401/review.md": `---
type: review
work: BUG-401
stage: review
created: ${TODAY}
updated: ${TODAY}
independent: true
agent: cc
lens: null
---

# Empty Review

## Record

_No body supplied._
`,
  });

  const board = await loadBoard({ projectRoot: root });
  const findings = collectBoardFindings(board, buildArtifactGraph(board));
  const gate = findings.find(
    (item) => item.code === "gated-work-missing-completion-evidence",
  );

  assert.equal(gate?.severity, "error");
  assert.equal(gate?.work, "BUG-401");
  assert.deepEqual(gate?.missing, ["test", "independent-review-or-provider"]);
});

test("accepted Gated gaps cover only the missing gates they name", async (t) => {
  const root = await fixture(t, {
    ".catpaw/index.md": `---
schema: 2
---

# CatPaw Board
`,
    ".catpaw/work/BUG-402-gap.md": `---
id: BUG-402
type: bug
mode: gated
status: done
stage: reflect
created: ${TODAY}
updated: ${TODAY}
closed: ${TODAY}
---

# BUG-402 Gap
`,
    ".catpaw/evidence/BUG-402/2026-07-11-reflection-accepted-gap.md": `---
type: reflection
work: BUG-402
stage: reflect
created: ${TODAY}
updated: ${TODAY}
independent: false
agent: null
lens: null
---

# Accepted Gap: BUG-402

## Record

Missing gates:
- independent-review-or-provider

Accepted reason: reviewer unavailable
`,
  });

  const board = await loadBoard({ projectRoot: root });
  const findings = collectBoardFindings(board, buildArtifactGraph(board));
  const gate = findings.find(
    (item) => item.code === "gated-work-missing-completion-evidence",
  );

  assert.equal(gate?.severity, "error");
  assert.deepEqual(gate?.missing, ["test", "independent-review-or-provider"]);
});
