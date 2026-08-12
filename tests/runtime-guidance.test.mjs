import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RUNTIME = fileURLToPath(new URL("../src/runtime/", import.meta.url));
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

test("runtime exposes exactly five concise Lens cards and no role-card tree", async () => {
  const files = (await readdir(path.join(RUNTIME, "lenses"))).sort();
  assert.deepEqual(files, ["README.md", ...LENS_FILES].sort());
  assert.equal(await exists(path.join(RUNTIME, "roles")), false);

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

test("workflow guidance owns the seven lifecycle stages and three modes", async () => {
  const text = await runtimeText("guidance/workflow.md");
  assert.match(
    text,
    /Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect/,
  );
  for (const mode of ["Direct", "Tracked", "Gated"]) {
    assert.match(text, new RegExp(`^### ${mode}$`, "m"));
  }
  for (const stage of ["Think", "Plan", "Build", "Review", "Test", "Ship", "Reflect"]) {
    assert.match(text, new RegExp(`^### ${stage}$`, "m"));
  }
  assert.match(text, /Direct[\s\S]*不创建 durable Work Item/i);
  assert.match(text, /Tracked[\s\S]*Work Item[\s\S]*Plan/i);
  assert.match(text, /Gated[\s\S]*independent check[\s\S]*Evidence/i);
  assert.match(text, /root cause/i);
  assert.match(text, /verification evidence/i);
  assert.match(text, /local Git/i);
  assert.match(text, /push[\s\S]*PR[\s\S]*explicit/i);
});

test("workflow selects optional execution methods by trigger without ceding orchestration", async () => {
  const text = await runtimeText("guidance/workflow.md");
  assert.match(text, /^## Optional Execution Methods$/m);
  assert.match(text, /specific method[\s\S]*trigger/i);
  assert.match(text, /meta-skill/i);
  assert.match(text, /same lifecycle stage[\s\S]*do not reload/i);
  assert.match(text, /cannot choose[\s\S]*artifact path[\s\S]*authorization/i);
  assert.match(text, /cannot choose CatPaw Mode[\s\S]*branch\/worktree[\s\S]*commit[\s\S]*authorization/i);
  assert.match(text, /invocation count[\s\S]*review[\s\S]*token/i);
  assert.match(text, /不创建独立 method ledger[\s\S]*provider-specific artifact/i);
});

test("Agent dispatch uses temporary capabilities and bounded Task Envelopes", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  assert.match(text, /^# Agent Dispatch$/m);
  for (const heading of [
    "Separation",
    "Temporary Capabilities",
    "Task Envelope",
    "Dispatch Triggers",
    "Parallelism Gate",
    "Delivery And Adoption",
  ]) {
    assert.match(text, new RegExp(`^## ${heading}$`, "m"));
  }
  for (const capability of ["Scout", "Builder", "Reviewer", "Verifier"]) {
    assert.match(text, new RegExp(`^### ${capability}$`, "m"));
  }
  for (const field of [
    "objective",
    "capability",
    "facts",
    "read scope",
    "write scope",
    "constraints",
    "deliverable",
    "verification",
    "dependency",
    "budget",
    "stop condition",
    "authority",
  ]) {
    assert.match(text, new RegExp(field, "i"));
  }
  assert.match(text, /temporary[\s\S]*(?:per-call|每次调用)/i);
  assert.match(text, /one primary capability|一个 primary capability/i);
  assert.match(text, /Lens[\s\S]*(?:不是|not)[\s\S]*(?:role|capability)/i);
  assert.match(text, /transport[\s\S]*(?:不是|not)[\s\S]*(?:role|capability)/i);
  assert.match(text, /Task Envelope[\s\S]*(?:不是|not)[\s\S]*board artifact/i);
  assert.match(text, /authority[\s\S]*(?:只能收窄|can only narrow)[\s\S]*(?:不能|cannot)[\s\S]*(?:扩张|expand)/i);
  assert.doesNotMatch(text, /persistent persona|永久 persona|role-card tree|Expert Council/);
});

test("Agent dispatch is risk-based, lifecycle-aware, and serial by default on overlap", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  assert.match(text, /Direct[\s\S]*(?:inline|不委派)/i);
  assert.match(text, /Direct[^\n]*material unknown[^\n]*Scout/i);
  assert.match(text, /Direct[^\n]*Independent Check trigger[^\n]*(?:Reviewer|Verifier|升级 Mode)/i);
  assert.doesNotMatch(text, /(?:Independent Check (?:trigger|risk)|独立检查风险)[^\n]*Scout/i);
  assert.match(text, /Tracked[\s\S]*(?:material unknown|实质未知)[\s\S]*(?:bounded|边界明确)/i);
  assert.match(text, /Gated[\s\S]*(?:Reviewer|Verifier)[\s\S]*(?:required|必须)/i);
  for (const stage of ["Think", "Plan", "Build", "Review", "Test", "Ship", "Reflect"]) {
    assert.match(text, new RegExp(stage));
  }
  assert.match(text, /available slots|空闲槽位/i);
  assert.match(text, /no shared mutable|不共享可变/i);
  assert.match(text, /order dependency|顺序依赖/i);
  assert.match(text, /composable|可独立采用|可组合/i);
  assert.match(text, /otherwise[\s\S]*serial|否则[\s\S]*串行/i);
});

test("Agent dispatch preserves one integration owner and independent review", async () => {
  const text = await runtimeText("guidance/agent-dispatch.md");
  assert.match(text, /one primary integration owner|唯一 primary integration owner/i);
  assert.match(text, /Builder[\s\S]*(?:must not|不得)[\s\S]*(?:stage|commit)/i);
  assert.match(text, /Reviewer[\s\S]*Verifier[\s\S]*(?:non-primary|非 Primary)/i);
  assert.match(text, /(?:must not|不得)[\s\S]*(?:same Builder|同一 Builder)/i);
  assert.match(text, /Primary[\s\S]*(?:reproduce|复现)[\s\S]*(?:adopt|采用)[\s\S]*(?:reject|拒绝)/i);
  assert.match(text, /Evidence[\s\S]*(?:does not|不能)[\s\S]*authoriz/i);
});

test("engineering methods keep debugging and RED/GREEN useful without universal ritual", async () => {
  const text = await runtimeText("guidance/engineering-methods.md");
  assert.match(text, /^# Engineering Methods$/m);
  assert.match(text, /^## Debugging$/m);
  assert.match(text, /reproduce[\s\S]*root cause[\s\S]*hypothesis[\s\S]*verify/i);
  assert.match(text, /^## RED\/GREEN$/m);
  assert.match(text, /behavior-sensitive|regression risk/i);
  assert.match(text, /observe[\s\S]*(?:fail|RED)[\s\S]*(?:minimal|smallest)[\s\S]*(?:pass|GREEN)/i);
  assert.match(text, /generated|documentation|configuration|explor/i);
  assert.doesNotMatch(text, /delete.*start over|every conversation|user approval after each/i);
  assert.match(text, /CatPaw Mode[\s\S]*authorization[\s\S]*artifact/i);
});

test("workflow delegates local Git safely and keeps remote or destructive actions gated", async () => {
  const text = await runtimeText("guidance/workflow.md");
  assert.match(text, /authorized task[\s\S]*local(?: task)? branch[\s\S]*worktree[\s\S]*commit/i);
  assert.match(text, /primary integration owner[\s\S]*stage[\s\S]*unrelated/i);
  assert.match(text, /non-protected[\s\S]*task branch/i);
  assert.match(text, /subagent[\s\S]*external Agent[\s\S]*(?:must not|不得)[\s\S]*(?:stage|commit)/i);
  assert.doesNotMatch(text, /primary\/current owner/i);
  assert.match(text, /credentials|secret/i);
  assert.match(text, /push[\s\S]*PR[\s\S]*protected[\s\S]*explicit/i);
  assert.match(text, /direct commit[\s\S]*merge[\s\S]*cherry-pick[\s\S]*fast-forward/i);
  assert.match(text, /amend|rebase|history rewrite/i);
  assert.match(text, /clean[\s\S]*unique commit|unique commit[\s\S]*clean/i);
});

test("Independent Check guidance separates Lens, Agent, and Evidence", async () => {
  const text = await runtimeText("guidance/independent-checks.md");
  assert.match(text, /^# Independent Checks$/m);
  assert.match(text, /^## Lens$/m);
  assert.match(text, /^## Agent$/m);
  assert.match(text, /^## Evidence$/m);
  assert.match(text, /Gated[\s\S]*required/i);
  assert.match(text, /Tracked[\s\S]*(preferred|recommended)/i);
  assert.match(text, /current-tool subagent/i);
  assert.match(text, /agent-dispatch\.md/);
  assert.match(text, /skipped because/i);
  assert.match(text, /no usable output/i);
  assert.match(text, /accepted gap/i);
  assert.doesNotMatch(text, /Provider Stance|Provider Outcome|Expert Council/);
});

test("Independent Checks require usable delivery and enforce read-only at the tool boundary", async () => {
  const text = await runtimeText("guidance/independent-checks.md");
  for (const outcome of ["usable", "partial", "empty", "failed"]) {
    assert.match(text, new RegExp(outcome, "i"));
  }
  for (const adoption of ["accepted", "rejected", "superseded"]) {
    assert.match(text, new RegExp(adoption, "i"));
  }
  assert.match(text, /^delivery: usable \| partial \| empty \| failed$/m);
  assert.match(text, /^adoption: accepted \| rejected \| superseded$/m);
  assert.doesNotMatch(text, /^adoption:.*(?:unreviewed|conflict)/m);
  assert.match(text, /delivery[\s\S]*Agent output[\s\S]*adoption[\s\S]*Primary Agent/i);
  assert.match(text, /review pending[\s\S]*(?:omit|省略)[\s\S]*adoption/i);
  assert.match(text, /conflict[\s\S]*(?:finding|待决)[\s\S]*(?:不增加|not add)/i);
  assert.match(text, /ACK[\s\S]*task_complete[\s\S]*not[\s\S]*usable/i);
  assert.match(text, /partial\/empty\/failed[\s\S]*fallback[\s\S]*不能[\s\S]*Independent Check/i);
  assert.match(text, /Primary Agent[\s\S]*(?:复现|verify)[\s\S]*finding/i);
  assert.match(text, /prompt-only[\s\S]*not[\s\S]*read-only/i);
  assert.match(text, /任何[\s\S]*read-only[\s\S]*(?:阻断|prevent)[\s\S]*(?:write|delete|rename)/i);
  assert.match(text, /filesystem sandbox/i);
  assert.match(text, /tool allowlist/i);
  assert.match(text, /read-only SQLite URI/i);
  assert.match(text, /不能[\s\S]*阻断写入[\s\S]*no-write requested \+ audited/i);
  assert.match(text, /no-write requested \+ audited[\s\S]*不能[\s\S]*read-only gate/i);
  assert.match(text, /调用前[\s\S]*exact protected scope[\s\S]*结束后[\s\S]*side-effect\s+audit/i);
  assert.match(text, /发现\s*意外修改[\s\S]*停止[\s\S]*保留现场[\s\S]*报告/i);
});

test("Agent guidance protects sensitive state and audits observable side effects", async () => {
  const text = await runtimeText("providers/README.md");
  assert.match(text, /agent-dispatch\.md/);
  assert.match(text, /Task Envelope/);
  assert.match(text, /cc\/cx[\s\S]*read-only[\s\S]*external[\s\S]*Builder unavailable/i);
  assert.match(text, /sensitive state/i);
  assert.match(text, /task scope/i);
  assert.match(text, /side-effect\s+audit/i);
  assert.match(text, /prompt-only read-only/i);
  assert.match(text, /sandbox[\s\S]*read-only[\s\S]*tool allowlist/i);
  assert.match(text, /环境不能阻断写入[\s\S]*不委派/i);
  assert.match(text, /read-only[\s\S]*预防性[\s\S]*(?:write|delete|rename)/i);
  assert.match(text, /no-write requested \+ audited[\s\S]*不能[\s\S]*read-only/i);
  assert.match(text, /副作用[\s\S]*delivery 标为 failed/i);
  assert.match(text, /^adoption: accepted \| rejected \| superseded$/m);
  assert.match(text, /review pending[\s\S]*(?:omit|省略)[\s\S]*adoption/i);
  assert.match(text, /conflict[\s\S]*(?:finding|待决)[\s\S]*(?:不增加|not add)/i);
  assert.doesNotMatch(text, /accepted、rejected 或 conflict/i);
});

test("guidance keeps Agent evidence separate from Git and external authority", async () => {
  const texts = await Promise.all([
    runtimeText("guidance/workflow.md"),
    runtimeText("guidance/independent-checks.md"),
    runtimeText("providers/README.md"),
    ...LENS_FILES.map((file) => runtimeText(`lenses/${file}`)),
  ]);
  const combined = texts.join("\n");
  for (const action of ["commit", "push", "PR", "deploy", "destructive"]) {
    assert.match(combined, new RegExp(action, "i"));
  }
  assert.match(
    combined,
    /Agent output[\s\S]*(?:does not|不能)[\s\S]*authorize/i,
  );
  assert.match(combined, /push[\s\S]*PR[\s\S]*deploy[\s\S]*explicit/i);
});
