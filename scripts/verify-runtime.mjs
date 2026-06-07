#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repoRoot, "src", "runtime");
const distRoot = path.join(repoRoot, "dist", "runtime");
const installedRoot = path.join(process.env.HOME ?? "", ".catpaw");

const checks = [];

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readText(target) {
  return readFile(target, "utf8");
}

async function readJson(target) {
  return JSON.parse(await readText(target));
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes ${parent}: ${child}`);
  }
}

function assertSafeManifestPath(entry) {
  if (!entry || entry.startsWith("/") || entry.includes("..")) {
    throw new Error(`Unsafe manifest path: ${entry}`);
  }
}

async function verifyPackageRoot(label, root, manifest) {
  if (!(await pathExists(root))) {
    record(`${label} root`, false, root);
    return;
  }
  record(`${label} root`, true, root);

  for (const entry of manifest.canonicalFiles) {
    assertSafeManifestPath(entry);
    const target = path.join(root, entry);
    assertInside(root, target);
    record(`${label} canonical ${entry}`, await pathExists(target), entry);
  }

  for (const commandName of manifest.commands ?? []) {
    const target = path.join(root, "commands", `${commandName}.md`);
    assertInside(root, target);
    record(`${label} command ${commandName}`, await pathExists(target), commandName);
  }
}

async function verifySourceTooling() {
  const projectInspector = path.join(repoRoot, "scripts", "catpaw-project.mjs");
  const projectInspectorTest = path.join(repoRoot, "tests", "catpaw-project.test.mjs");

  record(
    "source project graph inspector exists",
    await pathExists(projectInspector),
    "scripts/catpaw-project.mjs",
  );
  if (await pathExists(projectInspector)) {
    const text = await readText(projectInspector);
    record(
      "source project graph inspector exports analyzeProject",
      text.includes("export async function analyzeProject"),
      "scripts/catpaw-project.mjs",
    );
    record(
      "source project graph inspector governance checks",
      text.includes("invalid-provider-stance") &&
        text.includes("l3-req-missing-test-matrix") &&
        text.includes("active-plan-terminal-status") &&
        text.includes("archived-plan-active-status"),
      "scripts/catpaw-project.mjs",
    );
  }
  record(
    "source project graph inspector tests exist",
    await pathExists(projectInspectorTest),
    "tests/catpaw-project.test.mjs",
  );
  if (await pathExists(projectInspectorTest)) {
    const testText = await readText(projectInspectorTest);
    record(
      "source project graph inspector governance tests",
      testText.includes("doctor reports invalid provider stance values") &&
        testText.includes("doctor reports L3 req without test matrix") &&
        testText.includes("doctor reports plan directory and status drift"),
      "tests/catpaw-project.test.mjs",
    );
  }
}

async function verifyVersions(sourceManifest) {
  const sourceVersion = (await readText(path.join(sourceRoot, "VERSION"))).trim();
  const runtimeReadme = await readText(path.join(sourceRoot, "README.md"));
  record(
    "source VERSION matches manifest",
    sourceVersion === sourceManifest.version,
    `${sourceVersion} / ${sourceManifest.version}`,
  );
  record(
    "source README version is current",
    runtimeReadme.includes(`Current runtime version: \`${sourceVersion}\`.`),
    sourceVersion,
  );
  record(
    "source changelog has version entry",
    (await readText(path.join(sourceRoot, "CHANGELOG.md"))).includes(`## ${sourceVersion} -`),
    sourceVersion,
  );

  if (await pathExists(path.join(distRoot, "VERSION"))) {
    const distVersion = (await readText(path.join(distRoot, "VERSION"))).trim();
    const distManifest = await readJson(path.join(distRoot, "runtime-manifest.json"));
    record("dist VERSION matches source", distVersion === sourceVersion, distVersion);
    record(
      "dist manifest matches source",
      distManifest.version === sourceManifest.version,
      distManifest.version,
    );
  }

  if (await pathExists(path.join(installedRoot, "VERSION"))) {
    const installedVersion = (await readText(path.join(installedRoot, "VERSION"))).trim();
    const installedManifest = await readJson(
      path.join(installedRoot, "runtime-manifest.json"),
    );
    record(
      "installed VERSION matches source",
      installedVersion === sourceVersion,
      installedVersion,
    );
    record(
      "installed manifest matches source",
      installedManifest.version === sourceManifest.version,
      installedManifest.version,
    );
  } else {
    record("installed runtime exists", false, installedRoot);
  }
}

async function verifyProtocolInvariants(rootLabel, root) {
  const files = {
    policy: path.join(root, "runtime-policy.md"),
    classify: path.join(root, "commands", "classify.md"),
    initProject: path.join(root, "commands", "init-project.md"),
    plan: path.join(root, "commands", "plan.md"),
    provider: path.join(root, "commands", "provider.md"),
    review: path.join(root, "commands", "review.md"),
    status: path.join(root, "commands", "status.md"),
    doctor: path.join(root, "commands", "doctor.md"),
    registryDoctor: path.join(root, "commands", "registry-doctor.md"),
    globalAdapter: path.join(root, "snippets", "global-adapter.md"),
    projectAdapter: path.join(root, "snippets", "project-adapter.md"),
    qaStrategist: path.join(root, "roles", "qa-strategist.md"),
    designReviewer: path.join(root, "roles", "design-reviewer.md"),
    architectureSpec: path.join(root, "specs", "01-architecture.md"),
    subsystemsSpec: path.join(root, "specs", "06-subsystems.md"),
    operatingRules: path.join(root, "specs", "08-operating-rules.md"),
    projectDirectory: path.join(root, "specs", "03-project-directory.md"),
    rolesSpec: path.join(root, "specs", "09-roles.md"),
    planTemplate: path.join(root, "templates", "plan.md"),
    reviewTemplate: path.join(root, "templates", "review-summary.md"),
    testMatrix: path.join(root, "templates", "test-matrix.md"),
  };

  if (!(await pathExists(files.policy))) return;

  const policy = await readText(files.policy);
  const classify = await readText(files.classify);
  const initProject = await readText(files.initProject);
  const plan = await readText(files.plan);
  const provider = await readText(files.provider);
  const review = await readText(files.review);
  const status = await readText(files.status);
  const doctor = await readText(files.doctor);
  const registryDoctor = await readText(files.registryDoctor);
  const globalAdapter = await readText(files.globalAdapter);
  const projectAdapter = await readText(files.projectAdapter);
  const qaStrategist = await readText(files.qaStrategist);
  const designReviewer = await readText(files.designReviewer);
  const architectureSpec = await readText(files.architectureSpec);
  const subsystemsSpec = await readText(files.subsystemsSpec);
  const operatingRules = await readText(files.operatingRules);
  const projectDirectory = await readText(files.projectDirectory);
  const rolesSpec = await readText(files.rolesSpec);
  const planTemplate = await readText(files.planTemplate);
  const reviewTemplate = await readText(files.reviewTemplate);
  const testMatrix = await readText(files.testMatrix);
  const staleMaterialJudgment =
    policy.includes("materially improves judgment") ||
    plan.includes("adds material judgment") ||
    review.includes("materially affects the review");
  const skippedAsProviderStance = plan.includes("`preferred` or `skipped`");

  record(
    `${rootLabel} lifecycle role routing`,
    policy.includes("Lifecycle role routing"),
    "runtime-policy.md",
  );
  record(
    `${rootLabel} architecture layer model`,
    architectureSpec.includes("4 conceptual layers + 2 cross-cutting control planes") &&
      architectureSpec.includes("Artifact Graph") &&
      architectureSpec.includes("Gates / Verification") &&
      architectureSpec.includes("Do not count lifecycle stages or workflow levels as extra layers"),
    "specs/01-architecture.md",
  );
  record(
    `${rootLabel} progress handoff`,
    policy.includes("Progress Handoff Contract"),
    "runtime-policy.md",
  );
  record(
    `${rootLabel} frontend UI self-verification`,
    policy.includes("Frontend / UI Self-Verification") &&
      policy.includes("Browser / browser-use") &&
      policy.includes("Computer Use"),
    "runtime-policy.md",
  );
  record(
    `${rootLabel} UI verification command guidance`,
    classify.includes("interactive surface") &&
      plan.includes("self-verification surface") &&
      review.includes("Interactive UI Evidence"),
    "commands/classify.md + commands/plan.md + commands/review.md",
  );
  record(
    `${rootLabel} UI verification adapter snippets`,
    globalAdapter.includes("Computer Use") &&
      projectAdapter.includes("Computer Use"),
    "snippets/global-adapter.md + snippets/project-adapter.md",
  );
  record(
    `${rootLabel} Computer Use priority guidance`,
    policy.includes("Surface selection rules") &&
      policy.includes("Promote Computer Use") &&
      policy.includes("profile/session state") &&
      classify.includes("Computer Use should move ahead") &&
      plan.includes("selected surface, selection reason") &&
      review.includes("Review evidence should name the selected surface") &&
      qaStrategist.includes("Selection rules") &&
      qaStrategist.includes("Promote Computer Use") &&
      designReviewer.includes("Promote Computer Use") &&
      subsystemsSpec.includes("Computer Use moves ahead") &&
      operatingRules.includes("Surface selection") &&
      globalAdapter.includes("real-window") &&
      projectAdapter.includes("real-window"),
    "runtime-policy.md + classify/plan/review commands + QA/Design roles + specs + adapter snippets",
  );
  record(
    `${rootLabel} Subagent Preference Gate guidance`,
    policy.includes("Subagent Preference Gate") &&
      policy.includes("Prefer current-tool subagent") &&
      policy.includes("Subagent skipped: <why inline handling is sufficient>") &&
      provider.includes("Provider stance") &&
      provider.includes("Subagent Preference Gate") &&
      provider.includes("Subagent skipped: <why inline handling is sufficient>") &&
      classify.includes("provider stance as `preferred`") &&
      plan.includes("provider stance as") &&
      plan.includes("`skipped` is an outcome, not a provider stance") &&
      plan.includes("Subagent skipped: <reason>") &&
      review.includes("Provider stance should be reported") &&
      review.includes("reported separately from stance") &&
      operatingRules.includes("Subagent Preference Gate") &&
      rolesSpec.includes("Provider stance should be classified") &&
      rolesSpec.includes("Preferred subagent selection") &&
      globalAdapter.includes("Prefer current-tool subagent") &&
      projectAdapter.includes("Prefer current-tool subagent"),
    "runtime-policy.md + commands/provider.md + classify/plan/review + specs/08-operating-rules.md + specs/09-roles.md + adapter snippets",
  );
  record(
    `${rootLabel} provider stance enum`,
    provider.includes("`forced`:") &&
      provider.includes("`preferred`:") &&
      provider.includes("`inline`:") &&
      review.includes("`forced`, `preferred`, or `inline`") &&
      operatingRules.includes("| `inline` |") &&
      operatingRules.includes("| `preferred` |") &&
      operatingRules.includes("| `forced` |"),
    "commands/provider.md + commands/review.md + specs/08-operating-rules.md",
  );
  record(
    `${rootLabel} provider outcome separation`,
    !staleMaterialJudgment &&
      !skippedAsProviderStance &&
      plan.includes("record provider outcome") &&
      review.includes("Provider outcomes such as `used`, `skipped`, `unavailable`, or `gap`") &&
      operatingRules.includes("Provider outcome is the observed result") &&
      operatingRules.includes("| `used` |") &&
      operatingRules.includes("| `skipped` |") &&
      operatingRules.includes("| `unavailable` |") &&
      operatingRules.includes("| `gap` |"),
    "runtime-policy.md + commands/plan.md + commands/review.md + specs/08-operating-rules.md",
  );
  record(
    `${rootLabel} UI evidence templates include surface decision`,
    planTemplate.includes("Selected surface") &&
      planTemplate.includes("Selection reason") &&
      reviewTemplate.includes("Interactive UI Evidence") &&
      reviewTemplate.includes("Remaining gap"),
    "templates/plan.md + templates/review-summary.md",
  );
  record(
    `${rootLabel} provider stance templates include subagent skip`,
    planTemplate.includes("Provider stance") &&
      planTemplate.includes("Subagent skipped") &&
      reviewTemplate.includes("Provider stance") &&
      reviewTemplate.includes("Subagent skipped"),
    "templates/plan.md + templates/review-summary.md",
  );
  record(
    `${rootLabel} index active work table shape`,
    initProject.includes("| ID | Title | Status | Links |") &&
      status.includes("| ID | Title | Status | Links |") &&
      projectDirectory.includes("Recommended Active Work shape"),
    "commands/init-project.md + commands/status.md + specs/03-project-directory.md",
  );
  record(
    `${rootLabel} provider command exists`,
    await pathExists(files.provider),
    "commands/provider.md",
  );
  record(
    `${rootLabel} forced provider gate guidance`,
    policy.includes("Forced Provider Gate") &&
      provider.includes("Forced Provider Gate") &&
      plan.includes("Provider gate") &&
      review.includes("Provider gaps") &&
      rolesSpec.includes("Forced provider gates"),
    "runtime-policy.md + commands/provider.md + commands/plan.md + commands/review.md + specs/09-roles.md",
  );
  record(
    `${rootLabel} forced provider gate templates`,
    planTemplate.includes("Provider gate") &&
      planTemplate.includes("Provider gap") &&
      reviewTemplate.includes("Provider gaps"),
    "templates/plan.md + templates/review-summary.md",
  );
  record(
    `${rootLabel} status read-only wording`,
    status.includes("Project-artifact read-only"),
    "commands/status.md",
  );
  record(
    `${rootLabel} doctor read-only wording`,
    doctor.includes("Project-artifact read-only"),
    "commands/doctor.md",
  );
  record(
    `${rootLabel} registry discover report-only`,
    registryDoctor.includes("never\nauto-registers discovered boards") ||
      registryDoctor.includes("never auto-registers discovered boards"),
    "commands/registry-doctor.md",
  );
  record(
    `${rootLabel} test matrix req link`,
    testMatrix.includes("Req: ../../reqs/"),
    "templates/test-matrix.md",
  );
  record(
    `${rootLabel} test matrix plan link`,
    testMatrix.includes("Plan: ../../plans/"),
    "templates/test-matrix.md",
  );
}

function frontmatterRuntime(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const match = text.slice(4, end).match(/^runtime:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

async function verifyRegistry(installedVersion) {
  const registryPath = path.join(installedRoot, "state", "projects.json");
  if (!(await pathExists(registryPath))) {
    record("registry exists", true, "not present; no registered boards");
    return;
  }

  const registry = await readJson(registryPath);
  const projects = registry.projects ?? [];
  let current = 0;
  let missing = 0;
  let mismatched = 0;
  let activeDone = 0;
  let badMatrixLinks = 0;

  for (const project of projects) {
    const boardPath = project.boardPath;
    if (!(await pathExists(boardPath))) {
      missing += 1;
      continue;
    }

    const indexPath = path.join(boardPath, "index.md");
    const indexText = await readText(indexPath);
    const indexRuntime = frontmatterRuntime(indexText);
    if (project.stamp === installedVersion && indexRuntime === installedVersion) {
      current += 1;
    } else {
      mismatched += 1;
    }

    const activeDir = path.join(boardPath, "plans", "active");
    if (await pathExists(activeDir)) {
      for (const fileName of await readdir(activeDir)) {
        if (!fileName.endsWith(".md")) continue;
        const text = await readText(path.join(activeDir, fileName));
        if (/^status:\s*(done|cancelled)\s*$/m.test(text)) activeDone += 1;
      }
    }

    const matrixDir = path.join(boardPath, "tests", "matrices");
    if (await pathExists(matrixDir)) {
      for (const fileName of await readdir(matrixDir)) {
        if (!fileName.endsWith(".md")) continue;
        const text = await readText(path.join(matrixDir, fileName));
        if (/(?:Req:\s+\.\.\/reqs\/|Plan:\s+\.\.\/plans\/)/.test(text)) {
          badMatrixLinks += 1;
        }
      }
    }
  }

  record(
    "registry boards current",
    current === projects.length && missing === 0 && mismatched === 0,
    `${current}/${projects.length} current, ${missing} missing, ${mismatched} mismatched`,
  );
  record(
    "registry active plans are active",
    activeDone === 0,
    `${activeDone} done/cancelled plans under plans/active`,
  );
  record(
    "registry test matrix links",
    badMatrixLinks === 0,
    `${badMatrixLinks} old test matrix links`,
  );
}

async function main() {
  const sourceManifest = await readJson(path.join(sourceRoot, "runtime-manifest.json"));
  await verifyVersions(sourceManifest);
  await verifySourceTooling();
  await verifyPackageRoot("source", sourceRoot, sourceManifest);
  await verifyPackageRoot("dist", distRoot, sourceManifest);
  await verifyPackageRoot("installed", installedRoot, sourceManifest);
  await verifyProtocolInvariants("source", sourceRoot);
  await verifyProtocolInvariants("dist", distRoot);
  await verifyProtocolInvariants("installed", installedRoot);

  const installedVersion = (await pathExists(path.join(installedRoot, "VERSION")))
    ? (await readText(path.join(installedRoot, "VERSION"))).trim()
    : null;
  if (installedVersion) await verifyRegistry(installedVersion);

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  console.log(
    `Result: ${failed.length === 0 ? "PASS" : "FAIL"} (${checks.length - failed.length}/${checks.length})`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
