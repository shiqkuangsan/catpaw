import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
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
  "docs/decisions/0021-zero-touch-semantic-schema-1-migration.md",
  "docs/decisions/0022-tiered-local-git-authority-and-engineering-methods.md",
  "docs/decisions/0023-task-envelopes-and-risk-based-agent-dispatch.md",
  "docs/decisions/0024-bounded-builder-slice-commits.md",
  "docs/decisions/0025-executor-owned-advisory-orchestration.md",
  "docs/decisions/0026-user-facing-concept-consolidation.md",
];
const CURRENT_NARRATIVE_DOCS = [
  "README.md",
  "README.zh-CN.md",
  "AGENTS.md",
  "AI-INSTALL.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "NOTICE.md",
  "docs/README.md",
  "docs/glossary.md",
  "docs/architecture/three-layer-model.md",
  "docs/architecture/sync-and-references.md",
  "docs/architecture/migration-pipeline.md",
  "src/runtime/README.md",
  "src/runtime/AI-INSTALL.md",
  "src/runtime/runtime-policy.md",
  "src/runtime/guidance/agent-dispatch.md",
  "src/runtime/guidance/engineering-methods.md",
  "src/runtime/guidance/independent-checks.md",
  "src/runtime/guidance/maintenance.md",
  "src/runtime/guidance/milestones.md",
  "src/runtime/guidance/workflow.md",
  "src/runtime/providers/README.md",
  "src/runtime/providers/claude.md",
  "src/runtime/providers/codex.md",
  "src/runtime/snippets/global-adapter.md",
  "src/runtime/snippets/project-adapter.md",
];
const CURRENT_INTERPRETATION_EXPECTATIONS = new Map([
  ["0004-global-project-registry.md", [
    /guidance\/maintenance\.md/i,
    /absolute board path[\s\S]*primary key/i,
    /never mutate or delete project boards/i,
  ]],
  ["0006-user-visible-dispatch.md", [
    /Work\/Proof/i,
    /Understand ->[\s\S]*Execute -> Check ->[\s\S]*Finish/,
    /not an Approval gate/i,
  ]],
  ["0012-contract-first-quality-gates.md", [
    /behavior-sensitive Work/i,
    /Proof/,
    /ADR-0019[\s\S]*ADR-0026/,
  ]],
  ["0015-observable-provider-sessions.md", [
    /`cc`[\s\S]*`cx`/,
    /transport[\s\S]*open\|send\|status\|read\|close/i,
    /never establish completion or Approval/i,
  ]],
  ["0016-milestones-and-subagent-governance.md", [
    /Milestone[\s\S]*Work/i,
    /explore[\s\S]*build[\s\S]*check/i,
    /independent-checks\.md/i,
  ]],
  ["0017-adversarial-review-guidance.md", [
    /Adversarial review[\s\S]*`check`/i,
    /Proof/,
    /distinct[\s\S]*actor/i,
  ]],
  ["0018-claude-code-safe-mode-provider-cli.md", [
    /reciprocal `cc` transport/i,
    /providers\/claude\.md/i,
    /not completion Proof or[\s\S]*Approval/i,
  ]],
  ["0019-catpaw-3-hybrid-runtime.md", [
    /Work[\s\S]*Proof[\s\S]*Approval/,
    /Understand ->[\s\S]*Execute -> Check -> Finish/,
    /explore[\s\S]*build[\s\S]*check/i,
  ]],
  ["0022-tiered-local-git-authority-and-engineering-methods.md", [
    /`build` intent/,
    /Evidence[\s\S]*Proof/,
    /protected\/base[\s\S]*external[\s\S]*authority/i,
  ]],
  ["0023-task-envelopes-and-risk-based-agent-dispatch.md", [
    /explore[\s\S]*build[\s\S]*check/i,
    /primary agent[\s\S]*final adoption/i,
    /Work \/ Proof \/ Approval/,
  ]],
  ["0024-bounded-builder-slice-commits.md", [
    /`build`[\s\S]*not a persona/i,
    /cannot create Approval/i,
    /primary agent[\s\S]*final adoption/i,
  ]],
  ["0025-executor-owned-advisory-orchestration.md", [
    /explore[\s\S]*build[\s\S]*check/i,
    /intent list[\s\S]*intent show --intent <id>/i,
    /historical design state[\s\S]*cannot create Approval/i,
  ]],
  ["0026-user-facing-concept-consolidation.md", [
    /ADR-0027/,
    /status[\s\S]*work[\s\S]*proof[\s\S]*milestone/i,
    /intent list\|show[\s\S]*transport/i,
  ]],
]);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function markdownFiles(relativeDir) {
  const absoluteDir = path.join(REPO, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await markdownFiles(relative));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relative);
    }
  }
  return files.sort();
}

function currentInterpretation(text, file) {
  const match = text.match(
    /^## Current Interpretation\n\n([\s\S]*?)\n## Context$/m,
  );
  assert.ok(match, `${file} has a bounded Current Interpretation before Context`);
  return match[1];
}

test("public docs present CatPaw 3 without claiming global activation", async () => {
  for (const file of ["README.md", "README.zh-CN.md"]) {
    const text = await readFile(path.join(REPO, file), "utf8");
    assert.match(text, /3\.4\.0/);
    assert.match(text, /schema 2/i);
    assert.match(text, /Work[\s\S]*Proof[\s\S]*Approval/);
    assert.match(text, /Understand -> Execute -> Check -> Finish/);
    assert.match(text, /explore[\s\S]*build[\s\S]*check/i);
    assert.match(text, /activation[\s\S]*machine-local/i);
    assert.doesNotMatch(text, /Activation (?:status|状态)[:：]?\s*\*\*pending activation\*\*/i);
    assert.match(text, /(?:does not[\s\S]*automatically|不会自动)[\s\S]*(install|apply|migrate)/i);
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

test("current narrative docs do not teach the retired Role Catalog surface", async () => {
  const retired = /CatPaw 3\.0|\bL[0-3]\b|Expert Council|Provider Stance|provider-session\.sh|\bagent roles\b|\bagent role --role\b|\bRole Catalog\b|\bsix[- ]Role\b|src\/runtime\/(?:commands|specs|roles|source-evidence|tools)\/|src\/runtime\/(?:catalog\/roles\.json|lib\/role-catalog\.mjs)/i;
  const activeRuntimeDocs = (await markdownFiles("src/runtime"))
    .filter((file) =>
      file !== "src/runtime/CHANGELOG.md" &&
      !file.startsWith("src/runtime/migrations/")
    );
  const currentDocs = [...new Set([
    ...CURRENT_NARRATIVE_DOCS,
    ...activeRuntimeDocs,
  ])].sort();
  for (const file of currentDocs) {
    const text = await readFile(path.join(REPO, file), "utf8");
    assert.doesNotMatch(text, retired, file);
  }
});

test("every ADR declares lifecycle status and amended core ADRs lead with current interpretation", async () => {
  const decisionDir = path.join(REPO, "docs/decisions");
  const decisions = (await readdir(decisionDir))
    .filter((file) => /^\d{4}-.+\.md$/.test(file))
    .sort();
  assert.equal(decisions.length, 27);

  for (const file of decisions) {
    const text = await readFile(path.join(decisionDir, file), "utf8");
    assert.match(
      text,
      /^Status: (?:Accepted(?:; [^\n]+)?|Superseded by ADR-\d{4})$/m,
      file,
    );
    const status = text.match(/^Status: ([^\n]+)$/m)?.[1];
    if (status?.startsWith("Accepted;")) {
      const interpretation = currentInterpretation(text, file);
      assert.match(interpretation, /ADR-\d{4}/, file);
      const expectations = CURRENT_INTERPRETATION_EXPECTATIONS.get(file);
      assert.ok(expectations, `${file} has explicit current-semantic expectations`);
      for (const expected of expectations) {
        assert.match(interpretation, expected, file);
      }
    }
  }

  assert.equal(
    CURRENT_INTERPRETATION_EXPECTATIONS.size,
    decisions.filter((file) =>
      CURRENT_INTERPRETATION_EXPECTATIONS.has(file)
    ).length,
  );
});

test("public notice keeps attribution without a removed source-evidence claim", async () => {
  const text = await readFile(path.join(REPO, "NOTICE.md"), "utf8");
  assert.match(text, /Design Inspiration/);
  assert.match(text, /gstack[\s\S]*Superpowers/);
  assert.doesNotMatch(text, /source-evidence/i);
});

test("repository instructions route operations to v3.4 authorities", async () => {
  const text = await readFile(path.join(REPO, "AGENTS.md"), "utf8");
  for (const authority of [
    "src/runtime/runtime-policy.md",
    "src/runtime/guidance/workflow.md",
    "src/runtime/guidance/agent-dispatch.md",
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
  assert.match(text, /CatPaw-managed[\s\S]*cc[\s\S]*cx[\s\S]*not[\s\S]*complete roster/i);
  assert.match(text, /primary agent[\s\S]*task-intent composition[\s\S]*final adoption/i);
  assert.match(text, /delegated integration owner[\s\S]*exact build grant[\s\S]*clean inbound adoption/i);
  assert.match(text, /Work \| Proof \| Approval/);
});

test("ADR-0023 retains history while routing current delegation to three intents", async () => {
  const text = await readFile(
    path.join(
      REPO,
      "docs/decisions/0023-task-envelopes-and-risk-based-agent-dispatch.md",
    ),
    "utf8",
  );
  const current = currentInterpretation(text, "ADR-0023");
  assert.match(text, /^# ADR-0023:/m);
  assert.match(text, /Status: Accepted;[^\n]*ADR-0025[^\n]*superseded by ADR-0026/i);
  assert.match(text, /Task Envelope/);
  assert.match(current, /explore[\s\S]*build[\s\S]*check/i);
  assert.match(text, /Historical Amendment By ADR-0025[\s\S]*Role Catalog/i);
  assert.match(text, /Amendment By ADR-0026[\s\S]*agent intents[\s\S]*agent intent --intent <id>/i);
});

test("ADR-0024 retains history while routing current commit authority through build", async () => {
  const text = await readFile(
    path.join(REPO, "docs/decisions/0024-bounded-builder-slice-commits.md"),
    "utf8",
  );
  const current = currentInterpretation(text, "ADR-0024");
  assert.match(text, /^# ADR-0024:/m);
  assert.match(text, /Status: Accepted;[^\n]*ADR-0025[^\n]*ADR-0026/i);
  assert.match(current, /build[\s\S]*not a[\s\S]*persona/i);
  assert.match(text, /Amendments By ADR-0025 And ADR-0026[\s\S]*bounded local commit series/i);
  assert.match(text, /delegated integration owner[\s\S]*no Git authority[\s\S]*integration grant/i);
  assert.match(text, /primary agent[\s\S]*final adoption/i);
  assert.match(text, /board schema remains 2/i);
});

test("ADR-0025 records Executor-owned advisory orchestration and hard bounds", async () => {
  const text = await readFile(
    path.join(
      REPO,
      "docs/decisions/0025-executor-owned-advisory-orchestration.md",
    ),
    "utf8",
  );
  const current = currentInterpretation(text, "ADR-0025");
  assert.match(text, /^# ADR-0025:/m);
  assert.match(text, /Status: Accepted;[^\n]*Role Catalog[^\n]*superseded by ADR-0026/i);
  assert.match(current, /explore[\s\S]*build[\s\S]*check/i);
  assert.match(current, /intent list[\s\S]*intent show --intent <id>/i);
  assert.match(text, /Agent Executor[\s\S]*models[\s\S]*transports[\s\S]*parallelism[\s\S]*final adoption/i);
  assert.match(text, /Hard runtime contracts[\s\S]*Advisory orchestration[\s\S]*Executor decisions/i);
  assert.match(text, /Historical Role Catalog decision[\s\S]*Scout[\s\S]*Architect[\s\S]*Builder[\s\S]*Reviewer[\s\S]*Verifier[\s\S]*Integrator/);
  assert.match(text, /no concurrent write[\s\S]*shared mutable\s+surface/i);
  assert.match(text, /bounded series of local commits[\s\S]*Executor chooses useful commit\s+cadence/i);
  assert.match(text, /Historical read-only discovery surface[\s\S]*At the time[\s\S]*agent roles[\s\S]*agent role --role <id>/i);
  assert.match(text, /(?:does not add|Neither design adds)[\s\S]*`agent plan`[\s\S]*automatic adoption[\s\S]*invocation ledger/i);
  assert.match(text, /Board schema remains 2/i);
});

test("ADR-0026 consolidates public concepts without weakening safety contracts", async () => {
  const text = await readFile(
    path.join(
      REPO,
      "docs/decisions/0026-user-facing-concept-consolidation.md",
    ),
    "utf8",
  );
  assert.match(text, /^# ADR-0026:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(text, /Work \| Proof \| Approval/);
  assert.match(text, /Understand -> Execute -> Check -> Finish/);
  assert.match(text, /explore[\s\S]*build[\s\S]*check/i);
  assert.match(text, /different from the actor that built/i);
  assert.match(text, /proof add[\s\S]*evidence add/i);
  assert.match(text, /work start --high-risk[\s\S]*mode: gated/i);
  assert.match(text, /Board schema remains 2/i);
  assert.match(text, /Remote[\s\S]*protected\/base[\s\S]*destructive[\s\S]*explicit user Approval/i);
});

test("ADR-0027 layers daily, contract, and advanced CLI surfaces", async () => {
  const text = await readFile(
    path.join(REPO, "docs/decisions/0027-layered-cli-facade.md"),
    "utf8",
  );
  assert.match(text, /^# ADR-0027:/m);
  assert.match(text, /^Status: Accepted$/m);
  assert.match(text, /daily:[\s\S]*status \| work \| proof \| milestone/i);
  assert.match(text, /contracts:[\s\S]*intent/i);
  assert.match(text, /advanced:[\s\S]*board \| transport/i);
  assert.match(text, /Approval gets no command or artifact/i);
  assert.match(text, /schema-shaped JSON[\s\S]*compatibility/i);
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
  const current = currentInterpretation(text, "ADR-0019");
  assert.match(text, /^# ADR-0019:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(current, /Work[\s\S]*Proof[\s\S]*Approval/);
  assert.match(text, /Hybrid Runtime/);
  assert.match(text, /Direct[\s\S]*Tracked[\s\S]*Gated/);
  assert.match(text, /Lens[\s\S]*Agent[\s\S]*Independent Check/);
  assert.match(text, /board schema 2/i);
  assert.match(text, /supersed/i);
});

test("ADR-0021 supersedes selective migration with zero-touch conversion", async () => {
  const oldDecision = await readFile(
    path.join(REPO, "docs/decisions/0020-selective-schema-1-migration.md"),
    "utf8",
  );
  const text = await readFile(
    path.join(REPO, "docs/decisions/0021-zero-touch-semantic-schema-1-migration.md"),
    "utf8",
  );
  assert.match(oldDecision, /Status: Superseded by ADR-0021/i);
  assert.match(text, /^# ADR-0021:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(text, /zero-touch/i);
  assert.match(text, /conservative defaults/i);
  assert.match(text, /legacy\/schema-1/);
  assert.match(text, /checksummed/i);
  assert.match(text, /No `recordState: historical`/i);
});

test("ADR-0022 records tiered local Git authority and CatPaw-owned methods", async () => {
  const text = await readFile(
    path.join(
      REPO,
      "docs/decisions/0022-tiered-local-git-authority-and-engineering-methods.md",
    ),
    "utf8",
  );
  const current = currentInterpretation(text, "ADR-0022");
  assert.match(text, /^# ADR-0022:/m);
  assert.match(text, /Status: Accepted/i);
  assert.match(current, /`build` intent/i);
  assert.match(current, /Proof/);
  assert.match(current, /Approval/);
  assert.match(text, /local[\s\S]*worktree[\s\S]*commit/i);
  assert.match(text, /push[\s\S]*PR[\s\S]*explicit/i);
  assert.match(text, /Debugging[\s\S]*RED\/GREEN/i);
  assert.match(text, /Superpowers[\s\S]*(?:uninstall|remove|retire)/i);
  assert.match(text, /activated[\s\S]*adapters?[^\n]*current[\s\S]*Superpowers[\s\S]*(?:uninstall|remove)/i);
  assert.match(text, /inventory[\s\S]*preserve[\s\S]*existing[\s\S]*worktrees/i);
});

test("maintainer docs retain durable rationale instead of completed task plans", async () => {
  assert.equal(await exists(path.join(REPO, "docs/plans")), false);

  const readme = await readFile(path.join(REPO, "docs/README.md"), "utf8");
  assert.match(readme, /temporary design and implementation plans/i);
  assert.match(readme, /do not belong in `docs\/`/i);
  assert.match(readme, /Current behavioral authority[\s\S]*Current explanation[\s\S]*Historical record/i);
  assert.match(readme, /historical names must not be copied into new operating guidance/i);

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

test("all local links in public, maintainer, and ADR docs resolve", async () => {
  const decisionDocs = await markdownFiles("docs/decisions");
  const checkedDocs = [...new Set([...DOCS, ...decisionDocs])].sort();
  for (const file of checkedDocs) {
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
