import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const DOCS = [
  "README.md",
  "README.zh-CN.md",
  "NOTICE.md",
  "AGENTS.md",
  "AI-INSTALL.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/glossary.md",
  "docs/architecture/three-layer-model.md",
  "docs/architecture/sync-and-references.md",
  "docs/architecture/migration-pipeline.md",
  "docs/decisions/0019-catpaw-3-hybrid-runtime.md",
  "docs/decisions/0020-selective-schema-1-migration.md",
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

test("public docs present CatPaw 3 without claiming global activation", async () => {
  for (const file of ["README.md", "README.zh-CN.md"]) {
    const text = await readFile(path.join(REPO, file), "utf8");
    assert.match(text, /3\.0\.3/);
    assert.match(text, /board schema 2/i);
    assert.match(text, /Direct[\s\S]*Tracked[\s\S]*Gated/);
    assert.match(text, /Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect/);
    assert.match(text, /pending activation/i);
    assert.match(text, /does not[\s\S]*automatically[\s\S]*(install|apply|migrate)/i);
    assert.match(text, /cc[\s\S]*cx/i);
    assert.match(text, /~\/\.catpaw\/bin\/catpaw\.mjs/);
  }
});

test("current maintainer docs do not route through removed v2 authorities", async () => {
  const stale = /\bL[0-3]\b|Expert Council|Provider Stance|Provider Outcome|Laosan|老三|Gemini|src\/runtime\/(?:commands|specs|roles|source-evidence|tools)\/|provider-session\.sh|Current runtime version: `2\.|当前 runtime 版本：`2\./;
  for (const file of DOCS) {
    const text = await readFile(path.join(REPO, file), "utf8");
    assert.doesNotMatch(text, stale, file);
  }
});

test("public notice keeps attribution without a removed source-evidence claim", async () => {
  const text = await readFile(path.join(REPO, "NOTICE.md"), "utf8");
  assert.match(text, /Design Inspiration/);
  assert.match(text, /gstack[\s\S]*Superpowers/);
  assert.doesNotMatch(text, /source-evidence/i);
});

test("repository instructions route operations to v3 authorities", async () => {
  const text = await readFile(path.join(REPO, "AGENTS.md"), "utf8");
  for (const authority of [
    "src/runtime/runtime-policy.md",
    "src/runtime/guidance/workflow.md",
    "src/runtime/guidance/independent-checks.md",
    "src/runtime/guidance/milestones.md",
    "src/runtime/guidance/maintenance.md",
    "src/runtime/providers/README.md",
    "src/runtime/schemas/board-v2.json",
    "src/runtime/bin/catpaw.mjs",
  ]) {
    assert.match(text, new RegExp(authority.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(text, /Do not install or apply the source runtime unless explicitly requested/i);
  assert.match(text, /callable external Agents[\s\S]*cc[\s\S]*cx/i);
});

test("maintainer architecture documents the three runtime surfaces and version split", async () => {
  const [model, sync, migration] = await Promise.all([
    readFile(path.join(REPO, "docs/architecture/three-layer-model.md"), "utf8"),
    readFile(path.join(REPO, "docs/architecture/sync-and-references.md"), "utf8"),
    readFile(path.join(REPO, "docs/architecture/migration-pipeline.md"), "utf8"),
  ]);
  assert.match(model, /Always-on Rules/);
  assert.match(model, /On-demand Guidance/);
  assert.match(model, /Executable Tools/);
  assert.match(sync, /source[\s\S]*dist[\s\S]*installed[\s\S]*project board/i);
  assert.match(sync, /runtime-manifest\.json/);
  assert.match(migration, /schema 1[\s\S]*schema 2/i);
  assert.match(migration, /dry-run[\s\S]*stage[\s\S]*backup[\s\S]*publish/i);
  assert.match(migration, /does not[\s\S]*automatically[\s\S]*migrate/i);
});

test("ADR-0019 records the accepted Hybrid Runtime decision", async () => {
  const text = await readFile(
    path.join(REPO, "docs/decisions/0019-catpaw-3-hybrid-runtime.md"),
    "utf8",
  );
  assert.match(text, /^# ADR-0019:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(text, /Hybrid Runtime/);
  assert.match(text, /Direct[\s\S]*Tracked[\s\S]*Gated/);
  assert.match(text, /Lens[\s\S]*Agent[\s\S]*Independent Check/);
  assert.match(text, /board schema 2/i);
  assert.match(text, /supersed/i);
});

test("ADR-0020 records bounded schema 1 migration", async () => {
  const text = await readFile(
    path.join(REPO, "docs/decisions/0020-selective-schema-1-migration.md"),
    "utf8",
  );
  assert.match(text, /^# ADR-0020:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(text, /active dependency closure/i);
  assert.match(text, /legacy\/schema-1/);
  assert.match(text, /SHA-256/i);
  assert.match(text, /not a sixth artifact kind/i);
});

test("maintainer docs retain durable rationale instead of completed task plans", async () => {
  assert.equal(await exists(path.join(REPO, "docs/plans")), false);

  const readme = await readFile(path.join(REPO, "docs/README.md"), "utf8");
  assert.match(readme, /temporary design and implementation plans/i);
  assert.match(readme, /do not belong in `docs\/`/i);

  for (const file of [
    "0001-version-stamp-on-index.md",
    "0003-one-shot-upgrade-via-migrations.md",
    "0007-runtime-upgrade-project-orchestration.md",
    "0008-req-path-stability.md",
    "0009-project-stamps-track-runtime.md",
    "0011-provider-cli-dialogue.md",
    "0013-lifecycle-role-orchestration.md",
    "0014-interactive-ui-verification.md",
  ]) {
    const text = await readFile(path.join(REPO, "docs/decisions", file), "utf8");
    assert.match(text, /^Status: Superseded by ADR-0019/m, file);
  }
});

test("all local links in current public and maintainer docs resolve", async () => {
  for (const file of DOCS) {
    const text = await readFile(path.join(REPO, file), "utf8");
    for (const match of text.matchAll(/\[[^\]\n]+]\(([^)]+)\)/g)) {
      const target = match[1].split(/[?#]/, 1)[0];
      if (
        target === "" ||
        target.startsWith("/") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)
      ) continue;
      const resolved = path.resolve(REPO, path.dirname(file), target);
      assert.equal(await exists(resolved), true, `${file} -> ${match[1]}`);
    }
  }
});
