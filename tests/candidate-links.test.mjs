import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, realpath, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { candidateFor } from "../src/runtime/lib/candidate.mjs";

async function fixture(t, git = true) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "catpaw-links-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (git) execFileSync("git", ["init", "-q"], { cwd: root });
  await mkdir(path.join(root, ".catpaw"));
  await writeFile(path.join(root, "AGENTS.md"), "instructions");
  const work = { contract: 4, id: "FR-001", scope: ".", owner: "primary", cycle: 1, acceptance: "links", body: "" };
  return { root, hash: (options = {}) => candidateFor({ projectRoot: root, ...options }, work) };
}

for (const git of [true, false]) {
  test(`internal file links retain target content and link identity in ${git ? "Git" : "plain"} candidates`, async t => {
    const { root, hash } = await fixture(t, git);
    const plain = await hash();
    const link = path.join(root, "CLAUDE.md");
    await symlink("AGENTS.md", link);
    const first = await hash();
    assert.notEqual(first, plain);
    await writeFile(path.join(root, "AGENTS.md"), "changed instructions");
    assert.notEqual(await hash(), first);
    await writeFile(path.join(root, "AGENTS.md"), "instructions");
    assert.equal(await hash(), first);
    await writeFile(path.join(root, "OTHER.md"), "instructions");
    const beforeRetarget = await hash();
    await rm(link);
    await symlink("OTHER.md", link);
    assert.notEqual(await hash(), beforeRetarget);
  });
}

test("unsafe, excluded, ignored, chained and non-file link targets remain rejected", async t => {
  const { root, hash } = await fixture(t);
  await writeFile(path.join(root, ".gitignore"), "private.txt\n");
  await writeFile(path.join(root, "private.txt"), "must not be included");
  await writeFile(path.join(root, ".catpaw/state.md"), "board");
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs/file.md"), "docs");
  const link = path.join(root, "CLAUDE.md");
  for (const target of ["../outside.md", "/etc/hosts", "missing.md", "missing/../AGENTS.md", "CLAUDE.md", "docs", ".catpaw/state.md", ".git/config", ".git/../AGENTS.md", "private.txt"]) {
    await symlink(target, link);
    await assert.rejects(hash(), /unsafe link/, target);
    await rm(link);
  }
  await symlink("AGENTS.md", path.join(root, "alias.md"));
  await symlink("alias.md", link);
  await assert.rejects(hash(), /unsafe link/);
  await rm(link);
  await rm(path.join(root, "alias.md"));
  await symlink("docs/file.md", link);
  await assert.rejects(hash({ candidateExclusions: [path.join(root, "docs")] }), /unsafe link/);
});

test("raw link traversal cannot hide ignored directory aliases before parent segments", async t => {
  const { root, hash } = await fixture(t);
  await writeFile(path.join(root, ".gitignore"), "alias\n");
  const outside = await realpath(await mkdtemp(path.join(os.tmpdir(), "catpaw-outside-")));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(path.join(outside, "child"));
  await writeFile(path.join(outside, "AGENTS.md"), "outside scope");
  await symlink(path.join(outside, "child"), path.join(root, "alias"));
  await symlink("alias/../AGENTS.md", path.join(root, "CLAUDE.md"));
  await assert.rejects(hash(), /unsafe link/);
});

test("relative parent traversal through real in-scope directories is supported", async t => {
  const { root, hash } = await fixture(t);
  await mkdir(path.join(root, "docs"));
  await symlink("../AGENTS.md", path.join(root, "docs/CLAUDE.md"));
  assert.match(await hash(), /^[a-f0-9]{64}$/);
});
