import assert from "node:assert/strict";
import test from "node:test";

import {
  loadBoardSchema,
  validateMetadata,
} from "../src/runtime/lib/schema.mjs";
import { parseFrontmatter } from "../src/runtime/lib/frontmatter.mjs";

const validRecords = {
  board: { schema: 2 },
  milestone: {
    id: "MS-001",
    status: "active",
    created: "2026-07-11",
    updated: "2026-07-11",
    closed: null,
    target: "Public beta",
  },
  workItem: {
    id: "FR-001",
    type: "feature",
    mode: "tracked",
    status: "active",
    stage: "build",
    created: "2026-07-11",
    updated: "2026-07-11",
    closed: null,
  },
  plan: {
    work: "FR-001",
    updated: "2026-07-11",
  },
  evidence: {
    type: "review",
    work: "FR-001",
    stage: "review",
    created: "2026-07-11",
    updated: "2026-07-11",
    independent: true,
    agent: "Claude Code",
    lens: "system-contracts",
  },
};

test("loadBoardSchema exposes schema version 2 and all artifact definitions", () => {
  const schema = loadBoardSchema();

  assert.equal(schema.schemaVersion, 2);
  assert.deepEqual(Object.keys(schema.artifacts), [
    "board",
    "milestone",
    "workItem",
    "plan",
    "evidence",
  ]);
  assert.deepEqual(schema.artifacts.board.required, ["schema"]);
  assert.deepEqual(schema.artifacts.board.properties.schema.enum, [2]);
  assert.equal(loadBoardSchema(), schema);
});

test("loadBoardSchema cannot be mutated across validation calls", () => {
  const schema = loadBoardSchema();
  const boardVersions = schema.artifacts.board.properties.schema.enum;

  assert.ok(Object.isFrozen(schema));
  assert.ok(Object.isFrozen(boardVersions));
  assert.throws(() => {
    boardVersions[0] = 1;
  }, TypeError);
  assert.deepEqual(
    validateMetadata("board", { schema: 1 }).map(({ code, path }) => [code, path]),
    [["enum", "schema"]],
  );
});

test("loadBoardSchema exposes the canonical work ID pattern", () => {
  const schema = loadBoardSchema();
  const workIdPattern = "^(?:FR|BUG|CHORE)-[0-9]{3,}$";

  assert.equal(schema.artifacts.workItem.properties.id.pattern, workIdPattern);
  assert.equal(schema.artifacts.plan.properties.work.pattern, workIdPattern);
  assert.equal(schema.artifacts.evidence.properties.work.pattern, workIdPattern);
});

test("validateMetadata accepts valid metadata for every artifact kind", () => {
  const schema = loadBoardSchema();

  for (const [kind, record] of Object.entries(validRecords)) {
    assert.deepEqual(validateMetadata(kind, record, schema), [], kind);
  }
});

test("validateMetadata accepts alternate enum values and every work ID prefix", () => {
  const cases = [
    [
      "nullable milestone target",
      "milestone",
      { ...validRecords.milestone, status: "blocked", target: null },
    ],
    [
      "BUG work item",
      "workItem",
      {
        ...validRecords.workItem,
        id: "BUG-002",
        type: "bug",
        mode: "gated",
        status: "blocked",
        stage: "test",
      },
    ],
    [
      "CHORE work item",
      "workItem",
      {
        ...validRecords.workItem,
        id: "CHORE-003",
        type: "chore",
        stage: "reflect",
      },
    ],
    ["BUG plan", "plan", { ...validRecords.plan, work: "BUG-002" }],
    ["CHORE plan", "plan", { ...validRecords.plan, work: "CHORE-003" }],
    [
      "test evidence",
      "evidence",
      {
        ...validRecords.evidence,
        type: "test",
        work: "BUG-002",
        stage: "test",
        lens: "experience",
      },
    ],
    [
      "reflection evidence",
      "evidence",
      {
        ...validRecords.evidence,
        type: "reflection",
        work: "CHORE-003",
        stage: "reflect",
        agent: null,
        lens: "performance",
      },
    ],
  ];

  for (const [name, kind, record] of cases) {
    assert.deepEqual(validateMetadata(kind, record), [], name);
  }
});

test("validateMetadata keeps work ID prefixes and types consistent", () => {
  for (const [id, type] of [
    ["FR-001", "bug"],
    ["BUG-002", "feature"],
    ["CHORE-003", "feature"],
  ]) {
    const findings = validateMetadata("workItem", {
      ...validRecords.workItem,
      id,
      type,
    });

    assert.ok(
      findings.some((item) => item.code === "id-type" && item.path === "type"),
      `${id}/${type}: ${JSON.stringify(findings)}`,
    );
  }
});

test("validateMetadata checks real calendar dates", () => {
  for (const date of ["2026-02-31", "2025-02-29", "2026-04-31"]) {
    const findings = validateMetadata("plan", {
      ...validRecords.plan,
      updated: date,
    });

    assert.ok(
      findings.some((item) => item.code === "format" && item.path === "updated"),
      `${date}: ${JSON.stringify(findings)}`,
    );
  }

  assert.deepEqual(
    validateMetadata("plan", { ...validRecords.plan, updated: "2024-02-29" }),
    [],
  );
});

test("parsed frontmatter validates against the same metadata contract", () => {
  const parsed = parseFrontmatter(`---
id: BUG-004
type: bug
mode: gated
status: active
stage: test
created: 2026-07-11
updated: 2026-07-11
closed: null
---
# Reproduce the failure
`);

  assert.deepEqual(validateMetadata("workItem", parsed.data), []);
  assert.equal(parsed.body, "# Reproduce the failure\n");
});

test("validateMetadata accepts reflection evidence without a work item", () => {
  assert.deepEqual(
    validateMetadata("evidence", {
      ...validRecords.evidence,
      type: "reflection",
      work: null,
      stage: "reflect",
      lens: "performance",
    }),
    [],
  );
});

test("validateMetadata rejects invalid schema values and missing evidence work", () => {
  const { work: _work, ...evidenceWithoutWork } = validRecords.evidence;
  const cases = [
    [
      "milestone target type",
      "milestone",
      { ...validRecords.milestone, target: 42 },
      "type",
      "target",
    ],
    [
      "milestone status enum",
      "milestone",
      { ...validRecords.milestone, status: "paused" },
      "enum",
      "status",
    ],
    [
      "work item ID prefix",
      "workItem",
      { ...validRecords.workItem, id: "REQ-001" },
      "pattern",
      "id",
    ],
    [
      "work item type enum",
      "workItem",
      { ...validRecords.workItem, type: "task" },
      "enum",
      "type",
    ],
    [
      "work item mode enum",
      "workItem",
      { ...validRecords.workItem, mode: "direct" },
      "enum",
      "mode",
    ],
    [
      "work item status enum",
      "workItem",
      { ...validRecords.workItem, status: "paused" },
      "enum",
      "status",
    ],
    [
      "work item stage enum",
      "workItem",
      { ...validRecords.workItem, stage: "deploy" },
      "enum",
      "stage",
    ],
    [
      "plan work prefix",
      "plan",
      { ...validRecords.plan, work: "MS-001" },
      "pattern",
      "work",
    ],
    [
      "required evidence work",
      "evidence",
      evidenceWithoutWork,
      "required",
      "work",
    ],
    [
      "evidence type enum",
      "evidence",
      { ...validRecords.evidence, type: "summary" },
      "enum",
      "type",
    ],
    [
      "evidence work prefix",
      "evidence",
      { ...validRecords.evidence, work: "MS-001" },
      "pattern",
      "work",
    ],
    [
      "evidence stage enum",
      "evidence",
      { ...validRecords.evidence, stage: "deploy" },
      "enum",
      "stage",
    ],
    [
      "evidence lens enum",
      "evidence",
      { ...validRecords.evidence, lens: "architecture" },
      "enum",
      "lens",
    ],
  ];

  for (const [name, kind, record, code, path] of cases) {
    const findings = validateMetadata(kind, record);
    assert.ok(
      findings.some((item) => item.code === code && item.path === path),
      `${name}: ${JSON.stringify(findings)}`,
    );
  }
});

test("validateMetadata reports required, type, enum, pattern, and extra fields", () => {
  const findings = validateMetadata("workItem", {
    id: "REQ-1",
    type: "feature",
    mode: "fast",
    status: "active",
    stage: 3,
    created: "11/07/2026",
    updated: "2026-07-11",
    closed: null,
    extra: true,
  });

  assert.deepEqual(
    findings.map(({ code, path }) => [code, path]),
    [
      ["pattern", "id"],
      ["enum", "mode"],
      ["type", "stage"],
      ["pattern", "created"],
      ["additionalProperties", "extra"],
    ],
  );
  assert.match(findings[0].message, /workItem\.id.*must match/i);

  const missing = validateMetadata("plan", {});
  assert.deepEqual(
    missing.map(({ code, path }) => [code, path]),
    [
      ["required", "work"],
      ["required", "updated"],
    ],
  );
});

test("validateMetadata enforces board schema 2", () => {
  const findings = validateMetadata("board", { schema: 1 });

  assert.deepEqual(
    findings.map(({ code, path }) => [code, path]),
    [["enum", "schema"]],
  );
  assert.match(findings[0].message, /must be one of: 2/i);
});

test("validateMetadata enforces closed dates from terminal status", async (t) => {
  await t.test("terminal status requires a closed date", () => {
    const findings = validateMetadata("workItem", {
      ...validRecords.workItem,
      status: "done",
      closed: null,
    });

    assert.deepEqual(
      findings.map(({ code, path }) => [code, path]),
      [["closed-status", "closed"]],
    );
    assert.match(findings[0].message, /ISO date.*status is done/i);
  });

  await t.test("nonterminal status requires null", () => {
    const findings = validateMetadata("milestone", {
      ...validRecords.milestone,
      status: "blocked",
      closed: "2026-07-11",
    });

    assert.deepEqual(
      findings.map(({ code, path }) => [code, path]),
      [["closed-status", "closed"]],
    );
    assert.match(findings[0].message, /must be null.*status is blocked/i);
  });

  await t.test("terminal status accepts an ISO closed date", () => {
    assert.deepEqual(
      validateMetadata("workItem", {
        ...validRecords.workItem,
        status: "cancelled",
        closed: "2026-07-11",
      }),
      [],
    );
  });
});

test("validateMetadata supports nullable and optional evidence fields", () => {
  const topicEvidence = {
    ...validRecords.evidence,
    work: null,
    agent: null,
    lens: null,
  };

  assert.deepEqual(validateMetadata("evidence", topicEvidence), []);

  const findings = validateMetadata("evidence", {
    ...topicEvidence,
    independent: "yes",
    lens: "architecture",
  });
  assert.deepEqual(
    findings.map(({ code, path }) => [code, path]),
    [
      ["type", "independent"],
      ["enum", "lens"],
    ],
  );
});

test("validateMetadata returns readable findings for invalid inputs", () => {
  assert.deepEqual(validateMetadata("unknown", {}), [
    {
      code: "unknown-kind",
      path: "$",
      message: 'Unknown artifact kind "unknown".',
    },
  ]);

  assert.deepEqual(validateMetadata("board", null), [
    {
      code: "type",
      path: "$",
      message: "board metadata must be an object.",
    },
  ]);
});
