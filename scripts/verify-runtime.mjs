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

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
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
        text.includes("preferred-subagent-missing-outcome") &&
        text.includes("milestone-missing-req") &&
        text.includes("index-lists-terminal-milestone") &&
        text.includes("l3-req-missing-test-matrix") &&
        text.includes("active-plan-terminal-status") &&
        text.includes("archived-plan-active-status") &&
        text.includes("project-adapter-missing") &&
        text.includes("project-adapter-stale"),
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
        testText.includes("doctor warns when preferred subagent stance lacks outcome evidence") &&
        testText.includes("status summarizes active milestones") &&
        testText.includes("doctor reports milestone and req state drift") &&
        testText.includes("doctor reports L3 req without test matrix") &&
        testText.includes("doctor reports plan directory and status drift") &&
        testText.includes("doctor reports missing project adapter") &&
        testText.includes("doctor reports stale project adapter"),
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
    aiInstall: path.join(root, "AI-INSTALL.md"),
    classify: path.join(root, "commands", "classify.md"),
    initProject: path.join(root, "commands", "init-project.md"),
    installAdapter: path.join(root, "commands", "install-adapter.md"),
    milestone: path.join(root, "commands", "milestone.md"),
    plan: path.join(root, "commands", "plan.md"),
    provider: path.join(root, "commands", "provider.md"),
    providerSession: path.join(root, "tools", "provider-session.sh"),
    review: path.join(root, "commands", "review.md"),
    close: path.join(root, "commands", "close.md"),
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
    workflowControl: path.join(root, "specs", "13-workflow-control-model.md"),
    milestoneTemplate: path.join(root, "templates", "milestone.md"),
    planTemplate: path.join(root, "templates", "plan.md"),
    reviewTemplate: path.join(root, "templates", "review-summary.md"),
    providerDialogueTemplate: path.join(root, "templates", "provider-dialogue.md"),
    testMatrix: path.join(root, "templates", "test-matrix.md"),
  };

  if (!(await pathExists(files.policy))) return;

  const policy = await readText(files.policy);
  const aiInstall = await readText(files.aiInstall);
  const classify = await readText(files.classify);
  const initProject = await readText(files.initProject);
  const installAdapter = await readText(files.installAdapter);
  const milestone = await readText(files.milestone);
  const plan = await readText(files.plan);
  const provider = await readText(files.provider);
  const providerSession = await readText(files.providerSession);
  const review = await readText(files.review);
  const close = await readText(files.close);
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
  const workflowControl = await readText(files.workflowControl);
  const milestoneTemplate = await readText(files.milestoneTemplate);
  const planTemplate = await readText(files.planTemplate);
  const reviewTemplate = await readText(files.reviewTemplate);
  const providerDialogueTemplate = await readText(files.providerDialogueTemplate);
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
    `${rootLabel} adapter activation guidance`,
    aiInstall.includes("commands/install-adapter.md") &&
      initProject.includes("commands/install-adapter.md") &&
      installAdapter.includes("catpaw:install-adapter") &&
      installAdapter.includes("<!-- CATPAW:BEGIN -->") &&
      installAdapter.includes("marker block") &&
      installAdapter.includes("Project adapter activation should be considered current") &&
      doctor.includes("Adapter activation") &&
      doctor.includes("catpaw:install-adapter --project --dry-run") &&
      globalAdapter.includes("<!-- CATPAW:BEGIN -->") &&
      globalAdapter.includes("<!-- CATPAW:END -->") &&
      projectAdapter.includes("<!-- CATPAW:BEGIN -->") &&
      projectAdapter.includes("<!-- CATPAW:END -->"),
    "AI-INSTALL.md + commands/init-project.md + commands/install-adapter.md + commands/doctor.md + snippets",
  );
  record(
    `${rootLabel} observable provider sessions`,
    provider.includes("Observable Long-Running Provider Mode") &&
      provider.includes("No stdout while the provider process/session is still alive") &&
      provider.includes("is not sufficient\nevidence") &&
      provider.includes("Claude Code") &&
      provider.includes("Codex") &&
      provider.includes("OpenCode") &&
      provider.includes("Capability fallback ladder") &&
      provider.includes("Provider availability is a capability check") &&
      provider.includes("Do not repeatedly pressure the user") &&
      provider.includes("provider-session.sh open") &&
      provider.includes("provider-session.sh check") &&
      review.includes("observable long-running provider mode") &&
      operatingRules.includes("Provider Availability") &&
      operatingRules.includes("tmux, Claude Code, Codex, Gemini, OpenCode") &&
      operatingRules.includes("observable provider session -> provider-native or") &&
      operatingRules.includes("No stdout") &&
      providerSession.includes("provider-session.sh") &&
      providerSession.includes("cmd_check") &&
      providerSession.includes("FALLBACK non-interactive-cli") &&
      providerSession.includes("claude)") &&
      providerSession.includes("codex)") &&
      providerSession.includes("opencode)") &&
      providerDialogueTemplate.includes("Observed status") &&
      providerDialogueTemplate.includes("Wait policy"),
    "commands/provider.md + commands/review.md + specs/08-operating-rules.md + tools/provider-session.sh + templates/provider-dialogue.md",
  );
  record(
    `${rootLabel} Claude Code safe-mode provider CLI`,
    provider.includes("CC_SMOKE_OK") &&
      provider.includes("stdin +\nsafe-mode") &&
      provider.includes("--safe-mode") &&
      provider.includes("--permission-mode plan") &&
      provider.includes("--disallowedTools Edit,Write,NotebookEdit") &&
      provider.includes("--add-dir /abs/path/worktree-a") &&
      provider.includes("`--add-dir` is variadic") &&
      provider.includes("Do not append the prompt after `--add-dir`") &&
      provider.includes("Provider prompts must therefore be\nself-contained") &&
      review.includes("counts\n  as no usable output") &&
      operatingRules.includes("no usable output") &&
      !provider.includes('claude -p --no-session-persistence --permission-mode plan "<prompt>"'),
    "commands/provider.md + commands/review.md + specs/08-operating-rules.md",
  );
  record(
    `${rootLabel} workflow control model`,
    workflowControl.includes("Workflow Control Model") &&
      workflowControl.includes("Canonical Decision Table") &&
      workflowControl.includes("framed -> planned -> building -> reviewing -> verifying -> done") &&
      workflowControl.includes("not a new required frontmatter schema") &&
      policy.includes("specs/13-workflow-control-model.md") &&
      policy.includes("Workflow state target when tracked") &&
      policy.includes("Milestone fit") &&
      classify.includes("State target:") &&
      classify.includes("specs/13-workflow-control-model.md") &&
      close.includes("terminal workflow state `done` or") &&
      operatingRules.includes("Workflow State and Artifact Policy") &&
      operatingRules.includes("not a new required\n  frontmatter schema") &&
      architectureSpec.includes("specs/13-workflow-control-model.md"),
    "specs/13-workflow-control-model.md + runtime-policy.md + classify/close + specs/08-operating-rules.md + specs/01-architecture.md",
  );
  record(
    `${rootLabel} milestone phase orchestration`,
    policy.includes("Milestone fit") &&
      policy.includes("FR remains the smallest verifiable unit") &&
      milestone.includes("catpaw:milestone") &&
      milestone.includes(".catpaw/milestones/MS-001-<slug>.md") &&
      milestone.includes("not a fifth workflow level") &&
      projectDirectory.includes("milestones/") &&
      projectDirectory.includes("Recommended Active Milestones shape") &&
      initProject.includes("milestones/") &&
      status.includes(".catpaw/milestones/*.md") &&
      doctor.includes("Milestone consistency") &&
      workflowControl.includes("Milestone artifact policy") &&
      milestoneTemplate.includes("## Scope"),
    "runtime-policy.md + commands/milestone.md + specs/templates/project commands",
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
      policy.includes("Autonomous invocation rule") &&
      policy.includes("Subagent skipped: <why inline handling is sufficient>") &&
      provider.includes("Provider stance") &&
      provider.includes("Subagent Preference Gate") &&
      provider.includes("Preferred subagent invocation is one bounded round by default") &&
      provider.includes("Provider outcome: used") &&
      provider.includes("Subagent skipped: <why inline handling is sufficient>") &&
      classify.includes("provider stance as `preferred`") &&
      classify.includes("Provider: <inline|preferred|forced>") &&
      plan.includes("provider stance as") &&
      plan.includes("Provider outcome: used") &&
      plan.includes("`skipped` is an outcome, not a provider stance") &&
      plan.includes("Subagent skipped: <reason>") &&
      review.includes("Provider stance should be reported") &&
      review.includes("Provider outcome: used") &&
      review.includes("reported separately from stance") &&
      operatingRules.includes("Subagent Preference Gate") &&
      operatingRules.includes("one bounded read-only subagent check") &&
      rolesSpec.includes("Provider stance should be classified") &&
      rolesSpec.includes("Preferred subagent selection") &&
      rolesSpec.includes("Provider outcome: used") &&
      globalAdapter.includes("Prefer current-tool subagent") &&
      projectAdapter.includes("Prefer current-tool subagent"),
    "runtime-policy.md + commands/provider.md + classify/plan/review + specs/08-operating-rules.md + specs/09-roles.md + adapter snippets",
  );
  record(
    `${rootLabel} adversarial review guidance`,
    policy.includes("Adversarial Review") &&
      policy.includes("root problem and binding constraints") &&
      plan.includes("root problem and binding constraints") &&
      review.includes("Mode: none | light | adversarial | formal") &&
      review.includes("Adversarial Checks") &&
      provider.includes("Adversarial review") &&
      operatingRules.includes("Adversarial Review") &&
      rolesSpec.includes("Adversarial review summaries") &&
      planTemplate.includes("root problem and binding constraints") &&
      reviewTemplate.includes("Adversarial Checks") &&
      qaStrategist.includes("Adversarial cases") &&
      (await readText(path.join(root, "roles", "security-reviewer.md"))).includes("adversarial tests") &&
      (await readText(path.join(root, "roles", "performance-reviewer.md"))).includes("Adversarial workloads") &&
      (await readText(path.join(root, "roles", "debugging-advisor.md"))).includes("Challenge\nthe first plausible answer"),
    "runtime-policy.md + plan/review/provider + roles + templates",
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
      planTemplate.includes("Provider outcome") &&
      planTemplate.includes("Subagent skipped") &&
      reviewTemplate.includes("Provider stance") &&
      reviewTemplate.includes("Provider outcome") &&
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

async function verifySlimmingGuardrails(rootLabel, root) {
  const targets = [
    ["runtime-policy.md", 380],
    ["commands/provider.md", 470],
    ["specs/08-operating-rules.md", 270],
    ["specs/09-roles.md", 310],
    ["CHANGELOG.md", 300],
  ];

  for (const [relativePath, maxLines] of targets) {
    const target = path.join(root, relativePath);
    if (!(await pathExists(target))) continue;
    const lines = lineCount(await readText(target));
    record(
      `${rootLabel} slimming line budget ${relativePath}`,
      lines <= maxLines,
      `${lines}/${maxLines}`,
    );
  }

  const rolesDir = path.join(root, "roles");
  if (await pathExists(rolesDir)) {
    let roleLines = 0;
    for (const fileName of await readdir(rolesDir)) {
      if (!fileName.endsWith(".md")) continue;
      roleLines += lineCount(await readText(path.join(rolesDir, fileName)));
    }
    record(
      `${rootLabel} slimming line budget roles/`,
      roleLines <= 660,
      `${roleLines}/660`,
    );
  }

  const policy = await readText(path.join(root, "runtime-policy.md"));
  const provider = await readText(path.join(root, "commands", "provider.md"));
  const workflow = await readText(path.join(root, "specs", "13-workflow-control-model.md"));
  const operatingRules = await readText(path.join(root, "specs", "08-operating-rules.md"));
  const roles = await readText(path.join(root, "specs", "09-roles.md"));

  record(
    `${rootLabel} slimming preserves core workflow vocabulary`,
    ["L0", "L1", "L2", "L3"].every((level) =>
      policy.includes(level) && workflow.includes(level),
    ),
    "runtime-policy.md + specs/13-workflow-control-model.md",
  );
  record(
    `${rootLabel} slimming preserves provider gates`,
    provider.includes("Forced Provider Gate") &&
      provider.includes("Subagent Preference Gate") &&
      provider.includes("Capability fallback ladder") &&
      operatingRules.includes("Provider Availability"),
    "commands/provider.md + specs/08-operating-rules.md",
  );
  record(
    `${rootLabel} slimming preserves stance/outcome terms`,
    ["`inline`", "`preferred`", "`forced`"].every((term) =>
      provider.includes(term) && operatingRules.includes(term),
    ) &&
      ["`used`", "`skipped`", "`unavailable`", "`gap`"].every((term) =>
        operatingRules.includes(term),
      ),
    "commands/provider.md + specs/08-operating-rules.md",
  );
  record(
    `${rootLabel} slimming preserves role routing`,
    policy.includes("Lifecycle role routing") &&
      roles.includes("Lifecycle Role Orchestration") &&
      roles.includes("Provider Selection"),
    "runtime-policy.md + specs/09-roles.md",
  );
  record(
    `${rootLabel} slimming preserves safety gates`,
    policy.includes("External actions require explicit user confirmation") &&
      operatingRules.includes("External actions require explicit user confirmation") &&
      provider.includes("Do not send secrets") &&
      operatingRules.includes("Observable mode does not authorize writes"),
    "runtime-policy.md + commands/provider.md + specs/08-operating-rules.md",
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
  await verifySlimmingGuardrails("source", sourceRoot);
  await verifySlimmingGuardrails("dist", distRoot);
  await verifySlimmingGuardrails("installed", installedRoot);

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
