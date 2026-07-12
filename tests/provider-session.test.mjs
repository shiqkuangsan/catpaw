import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  agentSessionName,
  getAgentProfile,
  resolveAgentKey,
} from "../src/runtime/lib/provider-profiles.mjs";

const CLI = fileURLToPath(
  new URL("../src/runtime/bin/catpaw.mjs", import.meta.url),
);
const RUNTIME = fileURLToPath(new URL("../src/runtime/", import.meta.url));

const FAKE_TMUX = String.raw`#!__NODE__
const fs = require("node:fs");
const statePath = process.env.FAKE_TMUX_STATE;
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { sessions: {}, buffers: {}, calls: [] };
const argv = process.argv.slice(2);
const command = argv.shift();
state.calls.push([command, ...argv]);
const value = (flag) => argv[argv.indexOf(flag) + 1];
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

if (command === "has-session") {
  const name = value("-t");
  if (state.hasSessionDenied === name) {
    process.stderr.write("permission denied\n");
    process.exit(1);
  }
  process.exit(state.sessions[name] ? 0 : 1);
}
if (command === "new-session") {
  const name = value("-s");
  const cwd = value("-c");
  const commandStart = argv.indexOf("-c") + 2;
  const launchedCommand = argv.slice(commandStart);
  const launchedProvider = launchedCommand.length > 0;
  state.sessions[name] = {
    cwd,
    command: launchedCommand,
    output: "SESSION READY\n",
    pending: "",
    options: {},
    dead: launchedProvider && state.nextDeadStatus !== undefined,
    deadStatus: launchedProvider ? state.nextDeadStatus ?? null : null,
  };
  if (launchedProvider) delete state.nextDeadStatus;
  save();
  process.exit(0);
}
if (command === "respawn-pane") {
  const name = value("-t").split(":")[0];
  const cwd = value("-c");
  const commandStart = argv.indexOf("-c") + 2;
  const session = state.sessions[name];
  session.cwd = cwd;
  session.command = argv.slice(commandStart);
  session.output = state.nextDeadStatus === undefined
    ? "SESSION READY\n"
    : "provider failed during startup\n";
  session.dead = state.nextDeadStatus !== undefined;
  session.deadStatus = state.nextDeadStatus ?? null;
  delete state.nextDeadStatus;
  save();
  process.exit(0);
}
if (command === "display-message") {
  const name = value("-t").split(":")[0];
  const session = state.sessions[name];
  if (!session) process.exit(1);
  process.stdout.write(
    (session.dead ? "1" : "0") + "\t" + (session.deadStatus ?? "") + "\n",
  );
  process.exit(0);
}
if (command === "load-buffer") {
  state.buffers[value("-b")] = fs.readFileSync(0, "utf8");
  save();
  process.exit(0);
}
if (command === "paste-buffer") {
  const name = value("-t");
  const buffer = value("-b");
  state.sessions[name].pending = state.buffers[buffer] || "";
  if (argv.includes("-d")) delete state.buffers[buffer];
  save();
  process.exit(0);
}
if (command === "send-keys") {
  const session = state.sessions[value("-t")];
  session.output += session.pending + "\n";
  session.pending = "";
  save();
  process.exit(0);
}
if (command === "capture-pane") {
  const name = value("-t");
  if (state.capturePaneDenied === name) {
    process.stderr.write("permission denied\n");
    process.exit(1);
  }
  const session = state.sessions[name];
  if (!session) process.exit(1);
  process.stdout.write(session.output);
  process.exit(0);
}
if (command === "set-option") {
  const session = state.sessions[value("-t").split(":")[0]];
  const targetIndex = argv.indexOf("-t");
  session.options[argv[targetIndex + 2]] = argv[targetIndex + 3];
  save();
  process.exit(0);
}
if (command === "show-options") {
  const name = value("-t");
  if (state.showOptionsDenied === name) {
    process.stderr.write("permission denied\n");
    process.exit(1);
  }
  const session = state.sessions[name];
  const option = argv.at(-1);
  if (!session || session.options[option] === undefined) process.exit(1);
  process.stdout.write(session.options[option] + "\n");
  process.exit(0);
}
if (command === "kill-session") {
  const name = value("-t");
  if (state.closeDenied === name) {
    process.stderr.write("permission denied\n");
    process.exit(1);
  }
  if (state.closeRace === name) {
    delete state.sessions[name];
    delete state.closeRace;
    save();
    process.exit(1);
  }
  if (!state.sessions[name]) process.exit(1);
  delete state.sessions[name];
  save();
  process.exit(0);
}
process.stderr.write("unsupported fake tmux command: " + command + "\n");
process.exit(2);
`;

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeExecutable(target, content) {
  await writeFile(target, content, "utf8");
  await chmod(target, 0o755);
}

async function sandbox(t, { tmux = true, cc = true, cx = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-agent-session-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  await mkdir(bin);
  const statePath = path.join(root, "tmux-state.json");
  if (tmux) {
    await writeExecutable(
      path.join(bin, "tmux"),
      FAKE_TMUX.replace("__NODE__", process.execPath),
    );
  }
  const providerCallsPath = path.join(root, "provider-calls.jsonl");
  const stub = `#!${process.execPath}
const fs = require("node:fs");
fs.appendFileSync(
  process.env.FAKE_PROVIDER_CALLS,
  JSON.stringify({ executable: process.argv[1], args: process.argv.slice(2) }) + "\\n",
);
process.exit(0);
`;
  if (cc) await writeExecutable(path.join(bin, "claude"), stub);
  if (cx) await writeExecutable(path.join(bin, "codex"), stub);
  return {
    root,
    bin,
    statePath,
    providerCallsPath,
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      FAKE_TMUX_STATE: statePath,
      FAKE_PROVIDER_CALLS: providerCallsPath,
      CATPAW_TMUX: "tmux",
      CATPAW_HOME: path.join(root, "catpaw-home"),
    },
  };
}

function runCli(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({
      code,
      signal,
      stdout,
      stderr,
    }));
  });
}

async function readState(statePath) {
  return JSON.parse(await readFile(statePath, "utf8"));
}

async function updateState(statePath, update) {
  const state = await readState(statePath);
  update(state);
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

async function readProviderCalls(target) {
  if (!(await exists(target))) return [];
  const content = (await readFile(target, "utf8")).trim();
  return content === ""
    ? []
    : content.split("\n").map((line) => JSON.parse(line));
}

test("profiles expose only reciprocal cc/cx read-only Agents", () => {
  assert.equal(resolveAgentKey("cc"), "cc");
  assert.equal(resolveAgentKey("Claude"), "cc");
  assert.equal(resolveAgentKey("cx"), "cx");
  assert.equal(resolveAgentKey("Codex"), "cx");
  assert.equal(resolveAgentKey("老二", { host: "cx" }), "cc");
  assert.equal(resolveAgentKey("laoer", { host: "cc" }), "cx");
  assert.throws(() => resolveAgentKey("laoer"), /requires current host/i);
  for (const unsupported of ["gemini", "laosan", "老三", "opencode", "oc"]) {
    assert.throws(() => resolveAgentKey(unsupported), /only cc and cx/i);
  }

  const claude = getAgentProfile("cc", { projectRoot: "/tmp/work" });
  assert.equal(claude.command, "claude");
  assert.deepEqual(claude.interactiveArgs, [
    "--safe-mode",
    "--permission-mode",
    "plan",
    "--tools",
    "Read,Glob,Grep",
    "--disallowedTools",
    "Edit,Write,NotebookEdit",
  ]);
  assert.deepEqual(claude.nonInteractiveArgs, [
    "-p",
    "--no-session-persistence",
    "--safe-mode",
    "--permission-mode",
    "plan",
    "--tools",
    "Read,Glob,Grep",
    "--disallowedTools",
    "Edit,Write,NotebookEdit",
  ]);
  const codex = getAgentProfile("cx", { projectRoot: "/tmp/work" });
  assert.equal(codex.command, "codex");
  assert.deepEqual(codex.interactiveArgs, [
    "-C",
    "/tmp/work",
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "never",
    "--no-alt-screen",
  ]);
  assert.deepEqual(codex.nonInteractiveArgs, [
    "-C",
    "/tmp/work",
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "never",
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "-",
  ]);
});

test("session names are stable, safe, and scoped by Agent, project, and label", () => {
  const first = agentSessionName({
    agent: "cc",
    projectRoot: "/tmp/project-a",
    label: "Architecture Review",
  });
  assert.match(first, /^catpaw-cc-architecture-review-[a-f0-9]{12}$/);
  assert.equal(first, agentSessionName({
    agent: "cc",
    projectRoot: "/tmp/project-a",
    label: "Architecture Review",
  }));
  assert.notEqual(first, agentSessionName({
    agent: "cc",
    projectRoot: "/tmp/project-b",
    label: "Architecture Review",
  }));
  assert.notEqual(first, agentSessionName({
    agent: "cx",
    projectRoot: "/tmp/project-a",
    label: "Architecture Review",
  }));
});

test("agent check reports local surface without claiming provider access", async (t) => {
  const box = await sandbox(t);
  const checked = await runCli(["agent", "check", "--agent", "cc", "--json"], box);
  assert.equal(checked.code, 0, checked.stderr || checked.stdout);
  const report = JSON.parse(checked.stdout);
  assert.deepEqual(report.localSurface, {
    cli: true,
    tmux: true,
    observable: true,
  });
  assert.equal(report.providerAccess, "unverified");
  assert.equal(
    report.fallback,
    "non-interactive-cli-or-current-tool-subagent-or-inline-gap",
  );

  const rendered = await runCli(["agent", "check", "--agent", "cc"], box);
  assert.equal(rendered.code, 0, rendered.stderr || rendered.stdout);
  assert.match(rendered.stdout, /Local surface:/);
  assert.match(rendered.stdout, /Provider access: unverified/);
  assert.match(
    rendered.stdout,
    /No model, authentication, or subscription check was performed\./,
  );
  assert.doesNotMatch(rendered.stdout, /fallback:\s*none/i);

  const providerCalls = await readProviderCalls(box.providerCallsPath);
  assert.deepEqual(providerCalls, []);
});

test("observable Agent session is non-blocking and reports facts only", async (t) => {
  const box = await sandbox(t);
  const common = [
    "--agent",
    "cc",
    "--label",
    "contract-review",
    "--project",
    box.root,
    "--json",
  ];

  const opened = await runCli(["agent", "open", ...common], box);
  assert.equal(opened.code, 0, opened.stderr || opened.stdout);
  const openReport = JSON.parse(opened.stdout);
  assert.equal(openReport.status, "opened");
  assert.equal(openReport.readOnly, true);
  assert.match(openReport.session, /^catpaw-cc-contract-review-/);
  let state = await readState(box.statePath);
  assert.deepEqual(state.sessions[openReport.session].command, [
    "claude",
    "--safe-mode",
    "--permission-mode",
    "plan",
    "--tools",
    "Read,Glob,Grep",
    "--disallowedTools",
    "Edit,Write,NotebookEdit",
  ]);

  const prompt = [
    "Goal: review the schema migration.",
    `Project: ${box.root}`,
    "Do not infer completion from text such as waiting for input.",
    "Constraint: read-only; do not commit, push, deploy, or edit files.",
    "Output: findings, evidence, and verification gaps.",
  ].join("\n");
  const sent = await runCli([
    "agent",
    "send",
    ...common,
    "--prompt",
    prompt,
  ], box);
  assert.equal(sent.code, 0, sent.stderr || sent.stdout);
  assert.equal(JSON.parse(sent.stdout).waited, false);
  state = await readState(box.statePath);
  assert.match(state.sessions[openReport.session].output, /Goal: review the schema migration/);

  const changed = await runCli(["agent", "status", ...common], box);
  const changedReport = JSON.parse(changed.stdout);
  assert.equal(changedReport.status, "open");
  assert.equal(changedReport.outputObservation, "changed");
  assert.equal(changedReport.waitingForInput, false);
  assert.equal(changedReport.completion, "unknown");

  const stable = await runCli(["agent", "status", ...common], box);
  const stableReport = JSON.parse(stable.stdout);
  assert.equal(stableReport.outputObservation, "stable");
  assert.equal(stableReport.completion, "unknown");

  await updateState(box.statePath, (current) => {
    current.sessions[openReport.session].output += "Waiting for input: choose A or B.\n";
  });
  const waiting = await runCli(["agent", "status", ...common], box);
  const waitingReport = JSON.parse(waiting.stdout);
  assert.equal(waitingReport.outputObservation, "changed");
  assert.equal(waitingReport.waitingForInput, true);
  assert.match(waitingReport.waitingEvidence, /Waiting for input/);
  assert.equal(waitingReport.completion, "unknown");

  const repeatedWaiting = "Waiting for input: choose A or B.";
  const sentAgain = await runCli([
    "agent",
    "send",
    ...common,
    "--prompt",
    repeatedWaiting,
  ], box);
  assert.equal(sentAgain.code, 0, sentAgain.stderr || sentAgain.stdout);
  await updateState(box.statePath, (current) => {
    current.sessions[openReport.session].output += `${repeatedWaiting}\n`;
  });
  const repeatedWaitStatus = await runCli(["agent", "status", ...common], box);
  assert.equal(JSON.parse(repeatedWaitStatus.stdout).waitingForInput, true);

  const read = await runCli(["agent", "read", ...common, "--lines", "20"], box);
  assert.equal(read.code, 0, read.stderr || read.stdout);
  assert.match(JSON.parse(read.stdout).output, /choose A or B/);

  const closed = await runCli(["agent", "close", ...common], box);
  assert.equal(JSON.parse(closed.stdout).status, "closed");
  const repeated = await runCli(["agent", "close", ...common], box);
  assert.equal(JSON.parse(repeated.stdout).status, "not-found");

  const raceCommon = common.map((item) =>
    item === "contract-review" ? "close-race" : item
  );
  const raceOpen = await runCli(["agent", "open", ...raceCommon], box);
  const raceSession = JSON.parse(raceOpen.stdout).session;
  await updateState(box.statePath, (current) => {
    current.closeRace = raceSession;
  });
  const raced = await runCli(["agent", "close", ...raceCommon], box);
  assert.equal(raced.code, 0, raced.stderr || raced.stdout);
  assert.equal(JSON.parse(raced.stdout).status, "not-found");

  const deniedCommon = common.map((item) =>
    item === "contract-review" ? "close-denied" : item
  );
  const deniedOpen = await runCli(["agent", "open", ...deniedCommon], box);
  const deniedSession = JSON.parse(deniedOpen.stdout).session;
  await updateState(box.statePath, (current) => {
    current.closeDenied = deniedSession;
  });
  const denied = await runCli(["agent", "close", ...deniedCommon], box);
  assert.equal(denied.code, 1);
  assert.equal(denied.stderr, "");
  assert.deepEqual(JSON.parse(denied.stdout), {
    error: {
      code: "ERR_AGENT_TMUX",
      message: "tmux kill-session failed: permission denied",
    },
  });

  await updateState(box.statePath, (current) => {
    delete current.closeDenied;
    current.hasSessionDenied = deniedSession;
  });
  const inspectDenied = await runCli(["agent", "close", ...deniedCommon], box);
  assert.equal(inspectDenied.code, 1);
  assert.equal(inspectDenied.stderr, "");
  assert.deepEqual(JSON.parse(inspectDenied.stdout), {
    error: {
      code: "ERR_AGENT_TMUX",
      message: "tmux has-session failed: permission denied",
    },
  });
});

test("show-options permission failure is not treated as a missing option", async (t) => {
  const box = await sandbox(t);
  const common = [
    "--agent",
    "cc",
    "--label",
    "show-options-denied",
    "--project",
    box.root,
    "--json",
  ];
  const opened = await runCli(["agent", "open", ...common], box);
  assert.equal(opened.code, 0, opened.stderr || opened.stdout);
  const session = JSON.parse(opened.stdout).session;
  await updateState(box.statePath, (current) => {
    current.showOptionsDenied = session;
  });

  const denied = await runCli(["agent", "status", ...common], box);
  assert.equal(denied.code, 1);
  assert.equal(denied.stderr, "");
  assert.deepEqual(JSON.parse(denied.stdout), {
    error: {
      code: "ERR_AGENT_TMUX",
      message: "tmux show-options failed: permission denied",
    },
  });
});

test("provider startup failure remains observable with reason and fallback", async (t) => {
  const box = await sandbox(t);
  await writeFile(box.statePath, JSON.stringify({
    sessions: {},
    buffers: {},
    calls: [],
    nextDeadStatus: 23,
  }));
  const common = [
    "--agent",
    "cc",
    "--label",
    "startup-failure",
    "--project",
    box.root,
    "--json",
  ];

  const opened = await runCli(["agent", "open", ...common], box);
  assert.equal(opened.code, 1, opened.stderr || opened.stdout);
  const openReport = JSON.parse(opened.stdout);
  assert.equal(openReport.status, "failed");
  assert.equal(openReport.providerExitCode, 23);
  assert.match(openReport.reason, /status 23/);
  assert.equal(
    openReport.fallback,
    "non-interactive-cli-or-current-tool-subagent-or-inline-gap",
  );

  const status = await runCli(["agent", "status", ...common], box);
  assert.equal(status.code, 1, status.stderr || status.stdout);
  const statusReport = JSON.parse(status.stdout);
  assert.equal(statusReport.status, "failed");
  assert.equal(statusReport.providerExitCode, 23);
  assert.match(statusReport.reason, /status 23/);
  assert.equal(statusReport.fallback, openReport.fallback);
});

test("tmux operational failures do not leak as process errors", async (t) => {
  const box = await sandbox(t);
  const common = [
    "--agent",
    "cc",
    "--label",
    "capture-denied",
    "--project",
    box.root,
    "--json",
  ];
  const opened = await runCli(["agent", "open", ...common], box);
  assert.equal(opened.code, 0, opened.stderr || opened.stdout);
  const session = JSON.parse(opened.stdout).session;
  await updateState(box.statePath, (current) => {
    current.capturePaneDenied = session;
  });

  const denied = await runCli(["agent", "read", ...common], box);
  assert.equal(denied.code, 1);
  assert.equal(denied.stderr, "");
  assert.deepEqual(JSON.parse(denied.stdout), {
    error: {
      code: "ERR_AGENT_TMUX",
      message: "tmux capture-pane failed: permission denied",
    },
  });
});

test("Codex sessions use the read-only profile and Laoer routes reciprocally", async (t) => {
  const box = await sandbox(t);
  const opened = await runCli([
    "agent",
    "open",
    "--agent",
    "laoer",
    "--host",
    "cc",
    "--label",
    "second-opinion",
    "--project",
    box.root,
    "--json",
  ], box);
  assert.equal(opened.code, 0, opened.stderr || opened.stdout);
  const report = JSON.parse(opened.stdout);
  assert.equal(report.agent, "cx");
  const state = await readState(box.statePath);
  assert.deepEqual(state.sessions[report.session].command, [
    "codex",
    "-C",
    box.root,
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "never",
    "--no-alt-screen",
  ]);
});

test("capability gaps are reported without requiring tmux or another subscription", async (t) => {
  const cliOnly = await sandbox(t, { tmux: false, cc: true, cx: false });
  const noTmux = await runCli(
    ["agent", "check", "--agent", "cc", "--json"],
    cliOnly,
  );
  const noTmuxReport = JSON.parse(noTmux.stdout);
  assert.deepEqual(noTmuxReport.localSurface, {
    cli: true,
    tmux: false,
    observable: false,
  });
  assert.equal(noTmuxReport.providerAccess, "unverified");
  assert.equal(noTmuxReport.fallback, "non-interactive-cli");
  const noTmuxOpen = await runCli([
    "agent",
    "open",
    "--agent",
    "cc",
    "--project",
    cliOnly.root,
    "--json",
  ], cliOnly);
  assert.equal(noTmuxOpen.code, 1);
  assert.equal(JSON.parse(noTmuxOpen.stdout).fallback, "non-interactive-cli");

  const tmuxOnly = await sandbox(t, { tmux: true, cc: false, cx: false });
  const noCli = await runCli(
    ["agent", "check", "--agent", "cc", "--json"],
    tmuxOnly,
  );
  const noCliReport = JSON.parse(noCli.stdout);
  assert.deepEqual(noCliReport.localSurface, {
    cli: false,
    tmux: true,
    observable: false,
  });
  assert.equal(noCliReport.providerAccess, "unverified");
  assert.equal(
    noCliReport.fallback,
    "current-tool-subagent-or-inline-gap",
  );
  const noCliOpen = await runCli([
    "agent",
    "open",
    "--agent",
    "cc",
    "--project",
    tmuxOnly.root,
    "--json",
  ], tmuxOnly);
  assert.equal(noCliOpen.code, 1);
  assert.equal(
    JSON.parse(noCliOpen.stdout).fallback,
    "current-tool-subagent-or-inline-gap",
  );
});

test("unsupported Agent aliases and the removed wait command are usage errors", async (t) => {
  const box = await sandbox(t);
  for (const args of [
    ["agent", "check", "--agent", "gemini"],
    ["agent", "check", "--agent", "opencode"],
    ["agent", "check", "--agent", "laosan"],
    ["agent", "wait", "--agent", "cc"],
  ]) {
    const result = await runCli(args, box);
    assert.equal(result.code, 2, `${args.join(" ")}\n${result.stdout}${result.stderr}`);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^catpaw: .+\n$/);
  }
});

test("provider recipes are self-contained, read-only, and authority-bounded", async () => {
  const [readme, claude, codex] = await Promise.all([
    readFile(path.join(RUNTIME, "providers/README.md"), "utf8"),
    readFile(path.join(RUNTIME, "providers/claude.md"), "utf8"),
    readFile(path.join(RUNTIME, "providers/codex.md"), "utf8"),
  ]);
  const combined = `${readme}\n${claude}\n${codex}`;
  assert.match(combined, /self-contained prompt/i);
  assert.match(combined, /does not authorize[\s\S]*commit[\s\S]*push[\s\S]*deploy/i);
  assert.doesNotMatch(combined, /Gemini|Laosan|老三|gemini\s+-p/i);
  assert.match(claude, /printf '%s\\n' "\$PROMPT"[\s\S]*claude -p/);
  assert.match(claude, /--safe-mode/);
  assert.match(claude, /--tools Read,Glob,Grep/);
  assert.match(claude, /--disallowedTools Edit,Write,NotebookEdit/);
  assert.match(codex, /codex[\s\S]*--sandbox read-only[\s\S]*exec/);
  assert.match(codex, /--ignore-user-config/);
  assert.match(combined, /stable[\s\S]*not completion/i);
  assert.match(readme, /local surface/i);
  assert.match(readme, /provider access[\s\S]*(?:unknown|unverified)/i);
  assert.match(
    readme,
    /does not invoke[\s\S]*model[\s\S]*authentication[\s\S]*subscription/i,
  );
  assert.equal(await exists(path.join(RUNTIME, "tools/provider-session.sh")), false);
});
