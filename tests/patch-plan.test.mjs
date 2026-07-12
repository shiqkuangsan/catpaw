import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import { promisify } from "node:util";
import test from "node:test";

import { applyPatchPlan } from "../src/runtime/lib/atomic-write.mjs";
import {
  createPatchPlan,
  renderPatchPlan,
  snapshotTree,
} from "../src/runtime/lib/patch-plan.mjs";

const execFileAsync = promisify(execFile);

async function fixture(t, { absentRoot = false } = {}) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "catpaw-patch-plan-"));
  const root = path.join(sandbox, "board");
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  if (!absentRoot) await mkdir(root);
  return { root, sandbox };
}

async function put(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function treeSnapshot(root) {
  try {
    await lstat(root);
  } catch (error) {
    if (error?.code === "ENOENT") return ["absent"];
    throw error;
  }

  const entries = [];

  async function visit(directory, relativeDirectory = "") {
    const names = await readdir(directory);
    names.sort();

    if (relativeDirectory) entries.push(`dir:${relativeDirectory}`);
    for (const name of names) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${name}`
        : name;
      const absolutePath = path.join(directory, name);
      const stats = await lstat(absolutePath);
      if (stats.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (stats.isFile()) {
        const content = await readFile(absolutePath);
        entries.push(
          `file:${relativePath}:${stats.mode & 0o777}:${content.length}:${createHash("sha256").update(content).digest("hex")}`,
        );
      } else if (stats.isSymbolicLink()) {
        entries.push(`link:${relativePath}:${await readlink(absolutePath)}`);
      } else {
        entries.push(`special:${relativePath}:${stats.mode}`);
      }
    }
  }

  await visit(root);
  return entries;
}

function blockerCodes(plan) {
  return plan.blockers.map((blocker) => blocker.code);
}

function observeRollback(plan, action) {
  let cancelled = false;
  const parent = path.dirname(plan.root);
  const prefix = `.${path.basename(plan.root)}.catpaw-stage-`;
  const promise = (async () => {
    for (let attempt = 0; attempt < 5000 && !cancelled; attempt += 1) {
      const rollbackName = (await readdir(parent)).find(
        (name) => name.startsWith(prefix) && name.endsWith(".rollback"),
      );
      if (rollbackName) {
        try {
          await action(path.join(parent, rollbackName));
          return true;
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      await waitForImmediate();
    }
    return false;
  })();
  return { cancel: () => { cancelled = true; }, promise };
}

async function addDigestPadding(root) {
  const directory = path.join(root, "padding");
  await mkdir(directory);
  await Promise.all(
    Array.from({ length: 32 }, (_, index) =>
      writeFile(
        path.join(directory, `${String(index).padStart(2, "0")}.bin`),
        Buffer.alloc(64 * 1024, index),
      ),
    ),
  );
}

function freezeForgedPlan(plan, operations = plan.operations) {
  return Object.freeze({
    ...plan,
    operations: Object.freeze(
      operations.map((operation) => Object.freeze({ ...operation })),
    ),
    blockers: Object.freeze(
      plan.blockers.map((blocker) => Object.freeze({ ...blocker })),
    ),
  });
}

test("creates a deterministic, deeply frozen plan without writing", async (t) => {
  const { root } = await fixture(t);
  await put(root, "old.txt", "old");
  await put(root, "trash.bin", Buffer.from([0, 1, 2, 255]));
  await mkdir(path.join(root, "empty"));
  const before = await treeSnapshot(root);

  const operations = [
    { type: "remove-dir", path: "empty" },
    {
      type: "write-file",
      path: "generated/info.txt",
      content: "private payload",
      mode: "create",
    },
    { type: "move-file", from: "old.txt", to: "archive/old.txt" },
    { type: "remove-file", path: "trash.bin" },
    { type: "ensure-dir", path: "generated" },
    { type: "ensure-dir", path: "archive" },
  ];

  const plan = await createPatchPlan({ root: `${root}/../board`, operations });
  const shuffled = await createPatchPlan({ root, operations: [...operations].reverse() });

  assert.equal(plan.root, await realpath(root));
  assert.equal(plan.status, "ready");
  assert.match(plan.rootDigest, /^[0-9a-f]{64}$/);
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(plan.operations, shuffled.operations);
  assert.equal(renderPatchPlan(plan), renderPatchPlan(shuffled));
  assert.deepEqual(
    plan.operations.map((operation) => operation.type),
    [
      "ensure-dir",
      "ensure-dir",
      "move-file",
      "write-file",
      "remove-file",
      "remove-dir",
    ],
  );
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.operations), true);
  assert.equal(Object.isFrozen(plan.operations[0]), true);
  assert.deepEqual(await treeSnapshot(root), before);

  const rendered = renderPatchPlan(plan);
  assert.match(rendered, /WRITE CREATE generated\/info\.txt/);
  assert.match(rendered, /15 bytes/);
  assert.match(rendered, /sha256=[0-9a-f]{64}/);
  assert.doesNotMatch(rendered, /private payload/);
});

test("collapses idempotent filesystem requests into an exact no-op", async (t) => {
  const { root, sandbox } = await fixture(t);
  await mkdir(path.join(root, "docs"));
  await put(root, "docs/readme.md", "same bytes");
  const before = await treeSnapshot(root);

  const plan = await createPatchPlan({
    root,
    operations: [
      { type: "ensure-dir", path: "docs" },
      {
        type: "write-file",
        path: "docs/readme.md",
        content: "same bytes",
        mode: "replace",
      },
      { type: "remove-file", path: "missing.txt" },
      { type: "remove-dir", path: "missing-dir" },
    ],
  });

  assert.equal(plan.status, "noop");
  assert.deepEqual(plan.operations, []);
  assert.deepEqual(plan.blockers, []);
  assert.equal(renderPatchPlan(plan), "NO CHANGES\n");

  let validationCalls = 0;
  const result = await applyPatchPlan(plan, {
    validate: async () => {
      validationCalls += 1;
    },
  });

  assert.deepEqual(result, { status: "noop", backupPath: null, warnings: [] });
  assert.equal(validationCalls, 0);
  assert.deepEqual(await treeSnapshot(root), before);
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("simulates and applies exact create modes while preserving replacement modes", async (t) => {
  const { root } = await fixture(t);
  await put(root, "replace.txt", "before");
  await chmod(path.join(root, "replace.txt"), 0o640);

  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "private.txt",
        content: "private",
        mode: "create",
        fileMode: 0o600,
      },
      {
        type: "write-file",
        path: "replace.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });

  assert.equal(plan.status, "ready");
  assert.equal(
    plan.operations.find((item) => item.path === "private.txt").fileMode,
    0o600,
  );
  assert.equal(
    plan.operations.find((item) => item.path === "replace.txt").fileMode,
    0o640,
  );
  assert.match(renderPatchPlan(plan), /private\.txt .*mode=0600/);
  assert.match(renderPatchPlan(plan), /replace\.txt .*mode=0640/);

  await applyPatchPlan(plan);

  assert.equal((await lstat(path.join(root, "private.txt"))).mode & 0o7777, 0o600);
  assert.equal((await lstat(path.join(root, "replace.txt"))).mode & 0o7777, 0o640);
  assert.equal(await readFile(path.join(root, "replace.txt"), "utf8"), "after");

  const digest = (await snapshotTree(root)).digest;
  const repeated = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "private.txt",
        content: "private",
        mode: "create",
        fileMode: 0o600,
      },
      {
        type: "write-file",
        path: "replace.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });
  assert.equal(repeated.rootDigest, digest);
  assert.equal(repeated.status, "noop");
  assert.deepEqual(repeated.operations, []);
});

test("a successful create plan becomes a no-op when planned again", async (t) => {
  const { root } = await fixture(t);
  const operations = [
    { type: "ensure-dir", path: "generated" },
    {
      type: "write-file",
      path: "generated/result.txt",
      content: "stable",
      mode: "create",
    },
  ];

  const first = await createPatchPlan({ root, operations });
  assert.equal(first.status, "ready");
  const result = await applyPatchPlan(first);
  assert.deepEqual(result, { status: "applied", backupPath: null, warnings: [] });

  const second = await createPatchPlan({ root, operations });
  assert.equal(second.status, "noop");
  assert.equal(renderPatchPlan(second), "NO CHANGES\n");
});

test("blocks unsafe POSIX-relative paths", async (t) => {
  const { root } = await fixture(t);
  const unsafePaths = [
    "/absolute",
    "C:/windows",
    "C:\\windows",
    "a\\b",
    "",
    ".",
    "..",
    "a/../b",
    "a//b",
    "a/",
    "nul\0byte",
    "control\u0001byte",
  ];

  for (const unsafePath of unsafePaths) {
    const plan = await createPatchPlan({
      root,
      operations: [{ type: "ensure-dir", path: unsafePath }],
    });
    assert.equal(plan.status, "blocked", unsafePath);
    assert.ok(blockerCodes(plan).includes("unsafe-path"), unsafePath);
  }
});

test("blocks symlink traversal and special files", async (t) => {
  const { root, sandbox } = await fixture(t);
  const outside = path.join(sandbox, "outside");
  await mkdir(outside);
  await put(outside, "value.txt", "outside");
  await symlink(outside, path.join(root, "linked"));

  const throughSymlink = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "linked/value.txt",
        content: "changed",
        mode: "replace",
      },
    ],
  });
  assert.equal(throughSymlink.status, "blocked");
  assert.ok(blockerCodes(throughSymlink).includes("symlink-traversal"));
  assert.equal(await readFile(path.join(outside, "value.txt"), "utf8"), "outside");

  const pipePath = path.join(root, "named-pipe");
  await execFileAsync("mkfifo", [pipePath]);
  const specialFile = await createPatchPlan({
    root,
    operations: [{ type: "remove-file", path: "named-pipe" }],
  });
  assert.equal(specialFile.status, "blocked");
  assert.ok(blockerCodes(specialFile).includes("special-file"));
});

test("throws TypeError for malformed operation objects", async (t) => {
  const { root } = await fixture(t);

  await assert.rejects(
    createPatchPlan({ root, operations: [null] }),
    TypeError,
  );
  await assert.rejects(
    createPatchPlan({ root, operations: [{ type: "copy-file", path: "x" }] }),
    TypeError,
  );
  await assert.rejects(
    createPatchPlan({
      root,
      operations: [
        { type: "write-file", path: "x", content: "x", mode: "append" },
      ],
    }),
    TypeError,
  );
});

test("validates file modes and rejects permission-forged plans", async (t) => {
  const { root } = await fixture(t);

  for (const fileMode of [-1, 0o10000, 0.5, "0600", null]) {
    await assert.rejects(
      createPatchPlan({
        root,
        operations: [
          {
            type: "write-file",
            path: "private.txt",
            content: "private",
            mode: "create",
            fileMode,
          },
        ],
      }),
      { name: "TypeError", message: /fileMode must be an integer between 0 and 0o7777/ },
    );
  }

  await put(root, "replace.txt", "before");
  await chmod(path.join(root, "replace.txt"), 0o640);
  const modeChange = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "replace.txt",
        content: "after",
        mode: "replace",
        fileMode: 0o644,
      },
    ],
  });
  assert.equal(modeChange.status, "blocked");
  assert.ok(blockerCodes(modeChange).includes("replacement-mode-mismatch"));

  const trusted = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "private.txt",
        content: "private",
        mode: "create",
        fileMode: 0o600,
      },
    ],
  });
  const forged = freezeForgedPlan(trusted, [
    { ...trusted.operations[0], fileMode: 0o644 },
  ]);

  assert.throws(() => {
    trusted.operations[0].fileMode = 0o644;
  }, TypeError);
  await assert.rejects(applyPatchPlan(forged), TypeError);
  await assert.rejects(access(path.join(root, "private.txt")), { code: "ENOENT" });
});

test("renderPatchPlan rejects plain, cloned, and unknown-operation plans", async (t) => {
  const { root } = await fixture(t);
  const trusted = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "new.txt",
        content: "new",
        mode: "create",
      },
    ],
  });
  const plain = {
    root: trusted.root,
    rootDigest: trusted.rootDigest,
    status: "noop",
    operations: [],
    blockers: [],
  };
  const cloned = structuredClone(trusted);
  const unknown = freezeForgedPlan(trusted, [
    { type: "copy-file", from: "source.txt", to: "target.txt" },
  ]);

  assert.throws(() => renderPatchPlan(plain), TypeError);
  assert.throws(() => renderPatchPlan(cloned), TypeError);
  assert.throws(() => renderPatchPlan(unknown), TypeError);
});

test("applyPatchPlan rejects forged traversal before filesystem activity", async (t) => {
  const { root, sandbox } = await fixture(t);
  const trusted = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "inside.txt",
        content: "inside",
        mode: "create",
      },
    ],
  });
  const forged = freezeForgedPlan(trusted, [
    {
      type: "write-file",
      path: "../escaped.txt",
      content: "escaped",
      mode: "create",
    },
  ]);
  let validationCalls = 0;

  await assert.rejects(
    applyPatchPlan(forged, {
      validate: async () => {
        validationCalls += 1;
      },
    }),
    TypeError,
  );

  assert.equal(validationCalls, 0);
  await assert.rejects(access(path.join(sandbox, "escaped.txt")), { code: "ENOENT" });
  await assert.rejects(access(path.join(root, "inside.txt")), { code: "ENOENT" });
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("applyPatchPlan rejects cloned, malformed, and unknown-operation plans", async (t) => {
  const { root, sandbox } = await fixture(t);
  const trusted = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "inside.txt",
        content: "inside",
        mode: "create",
      },
    ],
  });
  const unknown = freezeForgedPlan(trusted, [
    { type: "copy-file", from: "source.txt", to: "target.txt" },
  ]);
  const malformed = Object.freeze({
    root: trusted.root,
    rootDigest: trusted.rootDigest,
    status: "blocked",
    operations: Object.freeze([]),
    blockers: Object.freeze([]),
  });

  await assert.rejects(applyPatchPlan(structuredClone(trusted)), TypeError);
  await assert.rejects(applyPatchPlan(unknown), TypeError);
  await assert.rejects(applyPatchPlan(malformed), TypeError);
  await assert.rejects(access(path.join(root, "inside.txt")), { code: "ENOENT" });
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("turns expected filesystem collisions into deterministic blockers", async (t) => {
  const { root } = await fixture(t);
  await put(root, "file.txt", "existing");
  await put(root, "source.txt", "source");
  await put(root, "destination.txt", "destination");
  await put(root, "nonempty/child.txt", "child");

  const cases = [
    {
      code: "existing-target",
      operation: {
        type: "write-file",
        path: "file.txt",
        content: "different",
        mode: "create",
      },
    },
    {
      code: "missing-target",
      operation: {
        type: "write-file",
        path: "missing.txt",
        content: "different",
        mode: "replace",
      },
    },
    {
      code: "expected-directory",
      operation: { type: "ensure-dir", path: "file.txt" },
    },
    {
      code: "existing-move-destination",
      operation: {
        type: "move-file",
        from: "source.txt",
        to: "destination.txt",
      },
    },
    {
      code: "missing-source",
      operation: {
        type: "move-file",
        from: "missing-source.txt",
        to: "new-destination.txt",
      },
    },
    {
      code: "directory-not-empty",
      operation: { type: "remove-dir", path: "nonempty" },
    },
    {
      code: "missing-parent",
      operation: {
        type: "write-file",
        path: "missing-parent/file.txt",
        content: "new",
        mode: "create",
      },
    },
  ];

  for (const { code, operation } of cases) {
    const plan = await createPatchPlan({ root, operations: [operation] });
    assert.equal(plan.status, "blocked", code);
    assert.ok(blockerCodes(plan).includes(code), `${code}: ${JSON.stringify(plan.blockers)}`);
  }
});

test("blocks duplicate roles, file prefixes, and move chains or cycles", async (t) => {
  const { root } = await fixture(t);
  await put(root, "one.txt", "one");
  await put(root, "two.txt", "two");

  const duplicateTarget = [
    { type: "ensure-dir", path: "same" },
    {
      type: "write-file",
      path: "same",
      content: "same",
      mode: "create",
    },
  ];
  const duplicateA = await createPatchPlan({ root, operations: duplicateTarget });
  const duplicateB = await createPatchPlan({
    root,
    operations: [...duplicateTarget].reverse(),
  });
  assert.equal(duplicateA.status, "blocked");
  assert.ok(blockerCodes(duplicateA).includes("duplicate-target"));
  assert.deepEqual(duplicateA.blockers, duplicateB.blockers);
  const blockerOrder = duplicateA.blockers.map(
    (blocker) => `${blocker.code}\0${blocker.path}\0${blocker.message}`,
  );
  assert.deepEqual(blockerOrder, [...blockerOrder].sort());

  const duplicateSource = await createPatchPlan({
    root,
    operations: [
      { type: "move-file", from: "one.txt", to: "moved.txt" },
      { type: "remove-file", path: "one.txt" },
    ],
  });
  assert.ok(blockerCodes(duplicateSource).includes("duplicate-source"));

  const prefix = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "parent",
        content: "file",
        mode: "create",
      },
      { type: "ensure-dir", path: "parent/child" },
    ],
  });
  assert.ok(blockerCodes(prefix).includes("file-directory-prefix"));

  const chain = await createPatchPlan({
    root,
    operations: [
      { type: "move-file", from: "one.txt", to: "middle.txt" },
      { type: "move-file", from: "middle.txt", to: "final.txt" },
    ],
  });
  assert.ok(blockerCodes(chain).includes("move-chain"));

  const cycle = await createPatchPlan({
    root,
    operations: [
      { type: "move-file", from: "one.txt", to: "two.txt" },
      { type: "move-file", from: "two.txt", to: "one.txt" },
    ],
  });
  assert.ok(blockerCodes(cycle).includes("move-chain"));
});

test("initializes an absent root through a validated sibling stage", async (t) => {
  const { root, sandbox } = await fixture(t, { absentRoot: true });
  const plan = await createPatchPlan({
    root,
    operations: [
      { type: "ensure-dir", path: "work" },
      { type: "ensure-dir", path: "evidence/reviews" },
      {
        type: "write-file",
        path: "index.md",
        content: "# Board\n",
        mode: "create",
      },
    ],
  });

  assert.equal(plan.status, "ready");
  assert.equal(plan.rootDigest, "absent-root");
  await assert.rejects(access(root), { code: "ENOENT" });

  let validated = false;
  await applyPatchPlan(plan, {
    validate: async ({ stageRoot }) => {
      assert.notEqual(stageRoot, root);
      assert.equal(path.dirname(stageRoot), path.dirname(plan.root));
      assert.equal(await readFile(path.join(stageRoot, "index.md"), "utf8"), "# Board\n");
      assert.equal((await lstat(path.join(stageRoot, "evidence/reviews"))).isDirectory(), true);
      validated = true;
    },
  });

  assert.equal(validated, true);
  assert.equal(await readFile(path.join(root, "index.md"), "utf8"), "# Board\n");
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("canonicalizes existing and absent roots through an ancestor symlink", async (t) => {
  const { sandbox } = await fixture(t, { absentRoot: true });
  const physicalParent = path.join(sandbox, "physical-parent");
  const ancestorAlias = path.join(sandbox, "ancestor-alias");
  const physicalExistingRoot = path.join(physicalParent, "existing-board");
  await mkdir(physicalExistingRoot, { recursive: true });
  await put(physicalExistingRoot, "value.txt", "before");
  await symlink(physicalParent, ancestorAlias);

  const existingPlan = await createPatchPlan({
    root: path.join(ancestorAlias, "existing-board"),
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });
  assert.equal(existingPlan.root, await realpath(physicalExistingRoot));
  await applyPatchPlan(existingPlan, {
    validate: async ({ stageRoot }) => {
      assert.equal(path.dirname(stageRoot), await realpath(physicalParent));
    },
  });
  assert.equal(await readFile(path.join(physicalExistingRoot, "value.txt"), "utf8"), "after");
  await assert.rejects(access(path.join(sandbox, "existing-board")), { code: "ENOENT" });

  const physicalAbsentRoot = path.join(await realpath(physicalParent), "created-board");
  const absentPlan = await createPatchPlan({
    root: path.join(ancestorAlias, "created-board"),
    operations: [
      {
        type: "write-file",
        path: "index.md",
        content: "# Created\n",
        mode: "create",
      },
    ],
  });
  assert.equal(absentPlan.root, physicalAbsentRoot);
  assert.equal(absentPlan.rootDigest, "absent-root");
  await applyPatchPlan(absentPlan);
  assert.equal(await readFile(path.join(physicalAbsentRoot, "index.md"), "utf8"), "# Created\n");
  assert.deepEqual((await readdir(physicalParent)).sort(), ["created-board", "existing-board"]);
});

test("blocks a root that is itself a symbolic link", async (t) => {
  const { sandbox } = await fixture(t, { absentRoot: true });
  const targetRoot = path.join(sandbox, "target-root");
  const linkedRoot = path.join(sandbox, "linked-root");
  await mkdir(targetRoot);
  await symlink(targetRoot, linkedRoot);

  const plan = await createPatchPlan({
    root: linkedRoot,
    operations: [{ type: "ensure-dir", path: "work" }],
  });

  assert.equal(plan.status, "blocked");
  assert.ok(blockerCodes(plan).includes("symlink-traversal"));
  await assert.rejects(applyPatchPlan(plan), /blocked/i);
  await assert.rejects(access(path.join(targetRoot, "work")), { code: "ENOENT" });
});

test("applies a migration-shaped plan while preserving unknown binary files and empty dirs", async (t) => {
  const { root } = await fixture(t);
  const unknown = Buffer.from([0, 255, 16, 32, 128, 1]);
  await put(root, "index.md", "old index\n");
  await put(root, "legacy/item.md", "legacy item\n");
  await put(root, "legacy/remove.bin", Buffer.from([9, 8, 7]));
  await put(root, "unknown.bin", unknown);
  await mkdir(path.join(root, "legacy/empty"));
  await mkdir(path.join(root, "unknown-empty"));

  const plan = await createPatchPlan({
    root,
    operations: [
      { type: "remove-dir", path: "legacy" },
      { type: "remove-file", path: "legacy/remove.bin" },
      {
        type: "write-file",
        path: "index.md",
        content: "new index\n",
        mode: "replace",
      },
      { type: "move-file", from: "legacy/item.md", to: "archive/item.md" },
      { type: "ensure-dir", path: "archive" },
      { type: "remove-dir", path: "legacy/empty" },
    ],
  });

  assert.equal(plan.status, "ready", JSON.stringify(plan.blockers));
  await applyPatchPlan(plan, {
    validate: async ({ stageRoot }) => {
      assert.equal(await readFile(path.join(stageRoot, "archive/item.md"), "utf8"), "legacy item\n");
      assert.deepEqual(await readFile(path.join(stageRoot, "unknown.bin")), unknown);
      assert.equal((await lstat(path.join(stageRoot, "unknown-empty"))).isDirectory(), true);
      await assert.rejects(access(path.join(stageRoot, "legacy")), { code: "ENOENT" });
    },
  });

  assert.equal(await readFile(path.join(root, "index.md"), "utf8"), "new index\n");
  assert.equal(await readFile(path.join(root, "archive/item.md"), "utf8"), "legacy item\n");
  assert.deepEqual(await readFile(path.join(root, "unknown.bin")), unknown);
  assert.equal((await lstat(path.join(root, "unknown-empty"))).isDirectory(), true);
  await assert.rejects(access(path.join(root, "legacy")), { code: "ENOENT" });
});

test("validation failure leaves the complete live root byte-identical", async (t) => {
  const { root, sandbox } = await fixture(t);
  await put(root, "value.txt", "before");
  await put(root, "unknown.bin", Buffer.from([4, 3, 2, 1, 0, 255]));
  await mkdir(path.join(root, "empty"));
  const before = await treeSnapshot(root);
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });

  await assert.rejects(
    applyPatchPlan(plan, {
      validate: async ({ stageRoot }) => {
        assert.equal(await readFile(path.join(stageRoot, "value.txt"), "utf8"), "after");
        throw new Error("validation failed");
      },
    }),
    /validation failed/,
  );

  assert.deepEqual(await treeSnapshot(root), before);
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("rejects a stale plan before validation or staging", async (t) => {
  const { root, sandbox } = await fixture(t);
  await put(root, "value.txt", "planned preimage");
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "planned result",
        mode: "replace",
      },
    ],
  });
  await put(root, "value.txt", "concurrent change");

  let validationCalls = 0;
  await assert.rejects(
    applyPatchPlan(plan, {
      validate: async () => {
        validationCalls += 1;
      },
    }),
    /stale/i,
  );

  assert.equal(validationCalls, 0);
  assert.equal(await readFile(path.join(root, "value.txt"), "utf8"), "concurrent change");
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("rejects post-validation staleness before backup or swap", async (t) => {
  const { root, sandbox } = await fixture(t);
  const backupPath = path.join(sandbox, "backup");
  await put(root, "value.txt", "before");
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "planned",
        mode: "replace",
      },
    ],
  });

  await assert.rejects(
    applyPatchPlan(plan, {
      backupPath,
      validate: async ({ stageRoot }) => {
        assert.equal(await readFile(path.join(stageRoot, "value.txt"), "utf8"), "planned");
        await writeFile(path.join(plan.root, "value.txt"), "external change");
      },
    }),
    /stale/i,
  );

  assert.equal(await readFile(path.join(root, "value.txt"), "utf8"), "external change");
  await assert.rejects(access(backupPath), { code: "ENOENT" });
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("verifies the claimed rollback preimage before backup or publication", async (t) => {
  const { root, sandbox } = await fixture(t);
  const backupPath = path.join(sandbox, "backup");
  await addDigestPadding(root);
  await put(root, "zzz.txt", "before");
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "zzz.txt",
        content: "planned",
        mode: "replace",
      },
    ],
  });
  let observer;
  let applyError;

  try {
    await applyPatchPlan(plan, {
      backupPath,
      validate: async () => {
        observer = observeRollback(plan, async (rollbackRoot) => {
          await writeFile(path.join(rollbackRoot, "zzz.txt"), "claimed external change");
        });
      },
    });
  } catch (error) {
    applyError = error;
  } finally {
    observer?.cancel();
  }

  assert.equal(await observer.promise, true);
  assert.match(applyError?.message ?? "", /stale/i);
  assert.equal(
    await readFile(path.join(root, "zzz.txt"), "utf8"),
    "claimed external change",
  );
  await assert.rejects(access(backupPath), { code: "ENOENT" });
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("copies a complete preimage backup after validation and before swap", async (t) => {
  const { root, sandbox } = await fixture(t);
  const backupPath = path.join(sandbox, "backup");
  await put(root, "value.txt", "before");
  await put(root, "unknown.bin", Buffer.from([7, 0, 6, 255]));
  await mkdir(path.join(root, "empty"));
  const before = await treeSnapshot(root);
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });

  const result = await applyPatchPlan(plan, {
    backupPath,
    validate: async () => {
      await assert.rejects(access(backupPath), { code: "ENOENT" });
    },
  });

  assert.deepEqual(result, {
    status: "applied",
    backupPath: path.resolve(backupPath),
    warnings: [],
  });
  assert.deepEqual(await treeSnapshot(backupPath), before);
  assert.equal(await readFile(path.join(root, "value.txt"), "utf8"), "after");

  const nextPlan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "later",
        mode: "replace",
      },
    ],
  });
  const liveBeforeRefusals = await treeSnapshot(root);

  await assert.rejects(applyPatchPlan(nextPlan, { backupPath }), /already exists/i);
  await assert.rejects(
    applyPatchPlan(nextPlan, { backupPath: path.join(root, "nested-backup") }),
    /inside.*root/i,
  );

  const rootAlias = path.join(sandbox, "root-alias");
  await symlink(root, rootAlias);
  let aliasValidationCalls = 0;
  await assert.rejects(
    applyPatchPlan(nextPlan, {
      backupPath: path.join(rootAlias, "nested-backup"),
      validate: async () => {
        aliasValidationCalls += 1;
      },
    }),
    /inside.*root/i,
  );
  assert.equal(aliasValidationCalls, 0);
  assert.deepEqual(await treeSnapshot(root), liveBeforeRefusals);
  assert.deepEqual((await readdir(sandbox)).sort(), ["backup", "board", "root-alias"]);
});

test("rejects validator mutation of the staged postimage", async (t) => {
  const { root, sandbox } = await fixture(t);
  const backupPath = path.join(sandbox, "backup");
  await put(root, "value.txt", "before");
  await put(root, "binary.dat", Buffer.from([1, 2, 3, 0, 255]));
  await mkdir(path.join(root, "empty"));
  const before = await treeSnapshot(root);
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });

  await assert.rejects(
    applyPatchPlan(plan, {
      validate: async ({ stageRoot }) => {
        await writeFile(path.join(stageRoot, "value.txt"), "validator mutation");
      },
    }),
    (error) => error?.code === "ERR_PATCH_VALIDATION_MUTATION",
  );

  assert.deepEqual(await treeSnapshot(root), before);
  await assert.rejects(access(backupPath), { code: "ENOENT" });
  assert.deepEqual(await readdir(sandbox), ["board"]);
});

test("retains a published backup and reports it when commit fails", async (t) => {
  const { root, sandbox } = await fixture(t);
  const backupPath = path.join(sandbox, "backup");
  await addDigestPadding(root);
  await put(root, "value.txt", "before");
  const before = await treeSnapshot(root);
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "value.txt",
        content: "after",
        mode: "replace",
      },
    ],
  });
  let observer;
  let applyError;

  try {
    await applyPatchPlan(plan, {
      backupPath,
      validate: async ({ stageRoot }) => {
        observer = observeRollback(plan, async () => {
          await rm(stageRoot, { recursive: true, force: true });
        });
      },
    });
  } catch (error) {
    applyError = error;
  } finally {
    observer?.cancel();
  }

  assert.equal(await observer.promise, true);
  assert.equal(applyError?.code, "ERR_PATCH_COMMIT");
  assert.equal(applyError?.backupPath, path.resolve(backupPath));
  assert.deepEqual(await treeSnapshot(root), before);
  assert.deepEqual(await treeSnapshot(backupPath), before);
  assert.deepEqual((await readdir(sandbox)).sort(), ["backup", "board"]);
});

test("refuses blocked plans without validating or writing", async (t) => {
  const { root, sandbox } = await fixture(t);
  await put(root, "exists.txt", "existing");
  const before = await treeSnapshot(root);
  const plan = await createPatchPlan({
    root,
    operations: [
      {
        type: "write-file",
        path: "exists.txt",
        content: "different",
        mode: "create",
      },
    ],
  });
  let validationCalls = 0;

  await assert.rejects(
    applyPatchPlan(plan, {
      validate: async () => {
        validationCalls += 1;
      },
    }),
    /blocked/i,
  );

  assert.equal(validationCalls, 0);
  assert.deepEqual(await treeSnapshot(root), before);
  assert.deepEqual(await readdir(sandbox), ["board"]);
});
