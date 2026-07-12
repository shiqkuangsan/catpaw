import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RUNTIME = fileURLToPath(new URL("../src/runtime/", import.meta.url));
const ACTIVE_DOC_ROOTS = [
  "runtime-policy.md",
  "README.md",
  "AI-INSTALL.md",
  "guidance",
  "lenses",
  "providers",
  "migrations/README.md",
  "snippets",
  "templates",
];
const REMOVED_TREES = [
  "commands",
  "specs",
  "guides",
  "roles",
  "source-evidence",
  "tools",
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

async function markdownFiles(relativePath) {
  const absolutePath = path.join(RUNTIME, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en")
  )) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(child)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(child);
  }
  return files;
}

async function activeDocs() {
  const files = [];
  for (const root of ACTIVE_DOC_ROOTS) {
    const target = path.join(RUNTIME, root);
    const stats = await readdir(path.dirname(target), { withFileTypes: true });
    const entry = stats.find((item) => item.name === path.basename(target));
    if (entry?.isDirectory()) files.push(...(await markdownFiles(root)));
    else files.push(root);
  }
  return files;
}

test("runtime authority surface omits superseded v2 document trees", async () => {
  for (const tree of REMOVED_TREES) {
    assert.equal(await exists(path.join(RUNTIME, tree)), false, tree);
  }
  for (const file of [
    "guidance/workflow.md",
    "guidance/independent-checks.md",
    "guidance/milestones.md",
    "guidance/maintenance.md",
    "lenses/README.md",
    "providers/README.md",
    "schemas/board-v2.json",
    "bin/catpaw.mjs",
  ]) {
    assert.equal(await exists(path.join(RUNTIME, file)), true, file);
  }
});

test("schema 2 installs only four canonical artifact templates", async () => {
  assert.deepEqual(
    (await readdir(path.join(RUNTIME, "templates"))).sort(),
    ["evidence.md", "milestone.md", "plan.md", "work-item.md"],
  );
});

test("active runtime docs have one v3 vocabulary without stale routing terms", async () => {
  const files = await activeDocs();
  const staleConcept = /\bL[0-3]\b|Expert Council|Provider Stance|Provider Outcome|Laosan|老三|Gemini|third opinion|roles\/|provider-dialogue\.md/;
  const staleCanonicalPath = /(?:^|[^/])reqs\/|reviews\/|tests\/matrices/;
  for (const file of files) {
    const text = await readFile(path.join(RUNTIME, file), "utf8");
    assert.doesNotMatch(text, staleConcept, file);
    if (file !== "guidance/maintenance.md") {
      assert.doesNotMatch(text, staleCanonicalPath, file);
    }
  }
});

test("runtime policy is a routing card and delegates detail to canonical owners", async () => {
  const text = await readFile(path.join(RUNTIME, "runtime-policy.md"), "utf8");
  for (const link of [
    "guidance/workflow.md",
    "guidance/independent-checks.md",
    "guidance/milestones.md",
    "guidance/maintenance.md",
    "lenses/README.md",
    "providers/README.md",
    "schemas/board-v2.json",
  ]) {
    assert.match(text, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(text, /Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect/);
  assert.match(text, /Direct \| Tracked \| Gated/);
  assert.match(text, /source repo[\s\S]*installed runtime/i);
  assert.match(text, /does not authorize[\s\S]*commit[\s\S]*push[\s\S]*deploy/i);
  assert.doesNotMatch(text, /CLI Playbook|Migration Operations|Role Selection Matrix/);
});

test("maintenance guidance preserves install, adapter, registry, and migration capability", async () => {
  const [install, maintenance] = await Promise.all([
    readFile(path.join(RUNTIME, "AI-INSTALL.md"), "utf8"),
    readFile(path.join(RUNTIME, "guidance/maintenance.md"), "utf8"),
  ]);
  const combined = `${install}\n${maintenance}`;
  for (const concept of [
    /~\/\.catpaw/,
    /runtime-manifest\.json/,
    /adapter/i,
    /projects\.json/,
    /board migrate/,
    /backup/i,
    /pending activation/i,
  ]) {
    assert.match(combined, concept);
  }
  assert.match(combined, /do not[\s\S]*automatically[\s\S]*migrate/i);
  assert.match(combined, /preserve[\s\S]*state\/projects\.json/i);
});

test("migration authority is schema-based and keeps release migrations historical", async () => {
  const text = await readFile(path.join(RUNTIME, "migrations/README.md"), "utf8");
  assert.match(text, /catpaw board migrate/);
  assert.match(text, /board schema version/i);
  assert.match(text, /schema-2\.md/);
  assert.match(text, /1\.1\.0\.md[\s\S]*historical/i);
  assert.match(text, /dry-run[\s\S]*stage[\s\S]*backup[\s\S]*publish/i);
  assert.doesNotMatch(
    text,
    /upgrade-project|runtime stamp|commands\/(?:upgrade-project|release-runtime)\.md/i,
  );
});

test("schema 1 diagnostics never recommend removed v2 commands", async () => {
  const text = await readFile(path.join(RUNTIME, "lib/findings.mjs"), "utf8");
  assert.doesNotMatch(text, /catpaw:(?:reconcile|milestone|upgrade-project)/i);
  assert.doesNotMatch(text, /Council provider evidence/i);
  assert.match(text, /catpaw board migrate/);
});

test("maintenance retains deterministic legacy import boundaries", async () => {
  const text = await readFile(
    path.join(RUNTIME, "guidance/maintenance.md"),
    "utf8",
  );
  for (const mapping of [
    /todos\/reqs\/\*[\s\S]*work\//i,
    /todos\/plans\/[\s\S]*plans\//i,
    /todos\/research\/\*[\s\S]*research Evidence/i,
    /todos\/tests[\s\S]*test Evidence/i,
    /todos\/lessons\.md[\s\S]*reflection Evidence/i,
  ]) {
    assert.match(text, mapping);
  }
  assert.match(text, /ID prefix[\s\S]*infer[\s\S]*type/i);
  assert.match(text, /do not infer[\s\S]*status[\s\S]*stage[\s\S]*date/i);
  assert.match(text, /file mtime/i);
  assert.match(text, /board doctor/);
  assert.match(text, /preserve[\s\S]*legacy tree/i);
});

test("maintenance retains exact registry check and remove semantics", async () => {
  const text = await readFile(
    path.join(RUNTIME, "guidance/maintenance.md"),
    "utf8",
  );
  for (const field of [
    "schemaVersion",
    "boardPath",
    "projectRoot",
    "schema",
    "runtimeSeen",
    "registeredVia",
    "registeredAt",
    "lastSeenAt",
    "lastSeenVia",
  ]) {
    assert.match(text, new RegExp(`"${field}"`));
  }
  assert.match(text, /primary key[\s\S]*absolute `boardPath`/i);
  assert.match(text, /duplicate[\s\S]*block/i);
  assert.match(text, /dry-run[\s\S]*exact entr/i);
  assert.match(text, /backups\/registry/);
  assert.match(text, /recheck[\s\S]*(digest|preimage)/i);
  assert.match(text, /atomic/i);
  assert.match(text, /never deletes or modifies the project board/i);
});

test("maintenance retains deterministic adapter merge targets and conflicts", async () => {
  const text = await readFile(
    path.join(RUNTIME, "guidance/maintenance.md"),
    "utf8",
  );
  assert.match(text, /~\/\.claude\/CLAUDE\.md/);
  assert.match(text, /~\/\.codex\/AGENTS\.md/);
  assert.match(text, /zero managed blocks[\s\S]*append/i);
  assert.match(text, /one managed block[\s\S]*replace/i);
  assert.match(text, /multiple managed blocks[\s\S]*block/i);
  assert.match(text, /unmanaged CatPaw section[\s\S]*user decision/i);
  assert.match(text, /backups\/adapters/);
  assert.match(text, /exact patch/i);
});

test("observable Agent command examples keep the project-scoped session key", async () => {
  const text = await readFile(path.join(RUNTIME, "providers/README.md"), "utf8");
  for (const command of ["open", "send", "status", "read", "close"]) {
    assert.match(
      text,
      new RegExp(`catpaw agent ${command}[^\\n]+--project <path>`),
    );
  }
});

test("runtime command examples resolve the executable and match CLI options", async () => {
  const [policy, milestones] = await Promise.all([
    readFile(path.join(RUNTIME, "runtime-policy.md"), "utf8"),
    readFile(path.join(RUNTIME, "guidance/milestones.md"), "utf8"),
  ]);
  assert.match(policy, /~\/\.catpaw\/bin\/catpaw\.mjs/);
  assert.match(policy, /src\/runtime\/bin\/catpaw\.mjs/);
  assert.match(policy, /does not[\s\S]*(?:modify|write|manage)[\s\S]*PATH/i);
  assert.match(milestones, /catpaw milestone add\s+--milestone <id>/);
  assert.doesNotMatch(milestones, /catpaw milestone add\s+--id\b/);
});

test("all local Markdown links in active runtime docs resolve", async () => {
  const files = await activeDocs();
  for (const file of files) {
    const text = await readFile(path.join(RUNTIME, file), "utf8");
    for (const match of text.matchAll(/\[[^\]\n]+]\(([^)]+)\)/g)) {
      const target = match[1].split(/[?#]/, 1)[0];
      if (
        target === "" ||
        target.includes("{{") ||
        target.startsWith("/") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)
      ) continue;
      const resolved = path.resolve(RUNTIME, path.dirname(file), target);
      assert.equal(await exists(resolved), true, `${file} -> ${match[1]}`);
    }
  }
});

test("adapter snippets activate the compact policy without copying runtime files", async () => {
  const [globalAdapter, projectAdapter] = await Promise.all([
    readFile(path.join(RUNTIME, "snippets/global-adapter.md"), "utf8"),
    readFile(path.join(RUNTIME, "snippets/project-adapter.md"), "utf8"),
  ]);
  const combined = `${globalAdapter}\n${projectAdapter}`;
  assert.match(combined, /~\/\.catpaw\/runtime-policy\.md/);
  assert.match(combined, /project-local `\.catpaw\/`[\s\S]*artifact board/i);
  assert.doesNotMatch(combined, /commands\/provider\.md|specs\/09-roles\.md/);
});
