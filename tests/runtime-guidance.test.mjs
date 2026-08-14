import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RUNTIME = fileURLToPath(new URL("../src/runtime/", import.meta.url));
const REPO = fileURLToPath(new URL("../", import.meta.url));
const LENS_FILES = [
  "experience.md",
  "performance.md",
  "security.md",
  "system-contracts.md",
  "value-scope.md",
];

async function runtimeText(relativePath) {
  return readFile(path.join(RUNTIME, relativePath), "utf8");
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

test("runtime keeps five internal checklists without exposing a role tree", async () => {
  const files = (await readdir(path.join(RUNTIME, "lenses"))).sort();
  assert.deepEqual(files, ["README.md", ...LENS_FILES].sort());
  assert.equal(await exists(path.join(RUNTIME, "roles")), false);
  assert.equal(await exists(path.join(RUNTIME, "catalog", "roles.json")), false);

  for (const file of LENS_FILES) {
    const text = await runtimeText(`lenses/${file}`);
    assert.match(text, /^# .+ Lens\n/);
    assert.match(text, /^## Use When$/m);
    assert.match(text, /^## Questions$/m);
    assert.match(text, /^## Evidence$/m);
    assert.doesNotMatch(
      text,
      /Expert Council|Provider Stance|Provider Outcome|L0|L1|L2|L3/,
    );
  }
});

test("runtime policy exposes only Work, Proof, and Approval as parallel user concerns", async () => {
  const text = await runtimeText("runtime-policy.md");
  assert.match(text, /Work[\s\S]*Proof[\s\S]*Approval/);
  assert.match(text, /parallel concerns[\s\S]*not mandatory sequential stages/i);
  assert.match(text, /Understand -> Execute -> Check -> Finish/);
  assert.match(text, /Approval[\s\S]*not a board artifact/i);
  assert.match(text, /Proof[\s\S]*(?:never|cannot)[\s\S]*(?:Approval|authority)/i);
  assert.match(text, /explore[\s\S]*build[\s\S]*check/);
  assert.doesNotMatch(text, /Role Catalog|Task Envelope|Agent Executor/);
});

test("workflow maps the visible flow to compatible internal modes and stages", async () => {
  const text = await runtimeText("guidance/workflow.md");
  assert.match(text, /Understand -> Execute -> Check -> Finish/);
  assert.match(text, /routing metadata[\s\S]*not concepts a\s+user must select or learn/i);
  for (const mode of ["Direct", "Tracked", "Gated"]) {
    assert.match(text, new RegExp(`^### ${mode}$`, "m"));
  }
  for (const stage of ["think", "plan", "build", "review", "test", "ship", "reflect"]) {
    assert.match(text, new RegExp(`\\b${stage}\\b`, "i"));
  }
  assert.match(text, /Gated[\s\S]*independent Proof/i);
  assert.match(text, /Proof stored through `proof add`[\s\S]*typed schema 2 Evidence/i);
  assert.match(text, /push[\s\S]*PR[\s\S]*explicit[\s\S]*Approval/i);
});

test("Agent collaboration defines exactly three composable intents", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  assert.match(text, /^# Agent Collaboration$/m);
  assert.match(text, /primary agent chooses Agents, models, transports, intent/i);
  assert.match(text, /`explore`[\s\S]*`build`[\s\S]*`check`/i);
  assert.match(text, /One Agent may carry several intents[\s\S]*same intent/i);
  assert.match(text, /review and verification remain distinct `check` methods/i);
  assert.match(text, /different from the actor that built/i);
  assert.match(text, /catalog\/intents\.json/);
  assert.match(text, /intent list[\s\S]*intent show --intent <id>/i);
  assert.doesNotMatch(text, /Role Catalog|Task Envelope|Agent Executor/);
});

test("bounded delegation preserves authority, isolation, and candidate boundaries", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  for (const field of [
    "outcome",
    "facts",
    "read scope",
    "write scope",
    "constraints",
    "output",
    "verification",
    "dependencies",
    "stop conditions",
    "allowed actions",
  ]) {
    assert.match(text, new RegExp(field, "i"));
  }
  assert.match(text, /not a board artifact or source of[\s\S]*Approval/i);
  assert.match(text, /must not concurrently write one mutable surface/i);
  assert.match(text, /same logical files[\s\S]*isolated[\s\S]*worktrees/i);
  assert.match(text, /one accountable writer/i);
  assert.match(text, /usable \| partial \| empty \| failed/);
  assert.match(text, /accepted \| rejected \| superseded/);
  assert.match(text, /No Agent[\s\S]*can accept its\s+own output/i);
});

test("scoped local Git permits bounded build commits without transferring adoption", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  assert.match(text, /current-tool `build` actor[\s\S]*bounded local commits/i);
  assert.match(text, /exclusive worktree[\s\S]*non-protected branch\/base/i);
  assert.match(text, /clean baseline[\s\S]*exact write scope/i);
  assert.match(text, /verification[\s\S]*diff review[\s\S]*credential scan/i);
  assert.match(text, /must not[\s\S]*push[\s\S]*amend[\s\S]*rebase[\s\S]*reset\/clean/i);
  assert.match(text, /primary agent accepts exact commits[\s\S]*fast-forward or cherry-pick/i);
  assert.match(text, /conflict[\s\S]*requires a new bounded build decision and grant/i);
  assert.match(text, /`explore`, `check`[\s\S]*must not stage[\s\S]*commit/i);
});

test("engineering methods stay trigger-based and produce Proof without new user concepts", async () => {
  const text = await runtimeText("guidance/engineering-methods.md");
  assert.match(text, /^# Engineering Methods$/m);
  assert.match(text, /^## Debugging$/m);
  assert.match(text, /Reproduce[\s\S]*Trace[\s\S]*Hypothesis[\s\S]*Probe[\s\S]*Fix[\s\S]*Verify/i);
  assert.match(text, /^## RED\/GREEN$/m);
  assert.match(text, /behavior-sensitive|regression risk/i);
  assert.match(text, /RED[\s\S]*expected fail[\s\S]*GREEN[\s\S]*pass/i);
  assert.match(text, /pure documentation|configuration|exploratory spike/i);
  assert.match(text, /^## Proof And Handoff$/m);
  assert.doesNotMatch(text, /delete.*start over|every conversation|user approval after each/i);
});

test("independent Proof requires another actor and cannot manufacture Approval", async () => {
  const text = await runtimeText("guidance/independent-checks.md");
  assert.match(text, /^# Independent Proof$/m);
  assert.match(text, /actor different from the actor that built/i);
  assert.match(text, /typed Evidence/);
  assert.match(text, /output: usable \| partial \| empty \| failed/);
  assert.match(text, /candidate: accepted \| rejected \| superseded \| review pending/);
  assert.match(text, /Gated\/high-risk Work/i);
  assert.match(text, /If a recommended check[\s\S]*record why it was skipped/i);
  assert.match(text, /required independence cannot be replaced with primary self-review/i);
  assert.match(text, /prompt-only [“\"]read-only[”\"][\s\S]*not a permission boundary/i);
  assert.match(text, /no-write requested \+ audited/);
  assert.match(text, /Independent Proof never supplies Approval/i);
});

test("managed Agent transports remain read-only options with observable evidence", async () => {
  const text = await runtimeText("providers/README.md");
  assert.match(text, /`cc`[\s\S]*`cx`/);
  assert.match(text, /not the complete\s+Agent roster/i);
  assert.match(text, /read-only[\s\S]*cannot carry a\s+writable `build` task/i);
  assert.match(text, /fallback[\s\S]*primary-agent/i);
  assert.match(text, /zero exit[\s\S]*does not prove completion/i);
  assert.match(text, /complete bounded delegation facts/i);
  assert.match(text, /sensitive state[\s\S]*credentials[\s\S]*production data/i);
  assert.match(text, /Unexpected mutation makes the output failed/i);
  assert.match(text, /neither output nor Proof grants Approval/i);
});

test("primary public docs stay within the concept budget", async () => {
  const paths = [
    path.join(REPO, "README.md"),
    path.join(REPO, "README.zh-CN.md"),
    path.join(RUNTIME, "README.md"),
  ];
  for (const file of paths) {
    const text = await readFile(file, "utf8");
    assert.match(text, /Work[\s\S]*Proof[\s\S]*Approval/);
    assert.match(text, /Understand -> Execute -> Check -> Finish/);
    assert.match(text, /explore[\s\S]*build[\s\S]*check/i);
    assert.doesNotMatch(text, /Role Catalog|Task Envelope|Agent Executor/);
  }
});

test("Proof remains separate from Git and external authority", async () => {
  const texts = await Promise.all([
    runtimeText("runtime-policy.md"),
    runtimeText("guidance/workflow.md"),
    runtimeText("guidance/independent-checks.md"),
    runtimeText("providers/README.md"),
  ]);
  const combined = texts.join("\n");
  for (const action of ["commit", "push", "PR", "deploy", "destructive"]) {
    assert.match(combined, new RegExp(action, "i"));
  }
  assert.match(combined, /Proof[\s\S]*(?:never|cannot|does not)[\s\S]*(?:Approval|authority)/i);
  assert.match(combined, /push[\s\S]*PR[\s\S]*deploy[\s\S]*explicit user Approval/i);
});
