import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants } from "node:fs";
import path from "node:path";

import {
  agentSessionName,
  getAgentProfile,
} from "../provider-profiles.mjs";

const OUTPUT_HASH_OPTION = "@catpaw-output-hash";
const BASELINE_LINES_OPTION = "@catpaw-baseline-line-hashes";
const PROMPT_LINES_OPTION = "@catpaw-prompt-line-hashes";
const DEFAULT_STATUS_LINES = 500;
const STARTUP_GRACE_MS = 750;
const STARTUP_POLL_MS = 50;
const MAX_BUFFER = 16 * 1024 * 1024;

function agentError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function executableAvailable(command, env = process.env) {
  const candidates = command.includes(path.sep)
    ? [command]
    : (env.PATH ?? "").split(path.delimiter).filter(Boolean).map(
        (directory) => path.join(directory, command),
      );
  return candidates.some((candidate) => {
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function runProcess(command, args, {
  input,
  allowFailure = false,
  errorCode = "ERR_AGENT_PROCESS",
  operation = command,
} = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  if (result.error) {
    throw agentError(
      errorCode,
      `Failed to run ${operation}: ${result.error.message}`,
      result.error,
    );
  }
  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw agentError(errorCode, `${operation} failed: ${detail}`);
  }
  return result;
}

function tmuxCommand() {
  return process.env.CATPAW_TMUX || "tmux";
}

function runTmux(args, options = {}) {
  return runProcess(tmuxCommand(), args, {
    ...options,
    errorCode: "ERR_AGENT_TMUX",
    operation: `tmux ${args[0]}`,
  });
}

function tmuxSessionNotFound(detail) {
  return /(?:can't find|no such) session|session (?:not found|does not exist)|no server running/i
    .test(detail);
}

function tmuxOptionNotFound(detail) {
  return /(?:unknown|invalid|no such) option|option .+ (?:not found|does not exist)/i
    .test(detail);
}

function hasSession(session) {
  const result = runTmux(["has-session", "-t", session], {
    allowFailure: true,
  });
  if (result.status === 0) return true;
  const detail = (result.stderr || result.stdout).trim();
  if (
    result.status === 1 &&
    (detail === "" || tmuxSessionNotFound(detail))
  ) {
    return false;
  }
  throw agentError(
    "ERR_AGENT_TMUX",
    `tmux has-session failed: ${detail || `exit ${result.status}`}`,
  );
}

function capturePane(session, lines) {
  return runTmux([
    "capture-pane",
    "-t",
    session,
    "-p",
    "-S",
    `-${lines}`,
  ]).stdout;
}

function readSessionOption(session, option) {
  const result = runTmux([
    "show-options",
    "-v",
    "-t",
    session,
    option,
  ], { allowFailure: true });
  if (result.status === 0) return result.stdout.trim() || null;
  const detail = (result.stderr || result.stdout).trim();
  if (
    result.status === 1 &&
    (detail === "" || tmuxSessionNotFound(detail) || tmuxOptionNotFound(detail))
  ) {
    return null;
  }
  throw agentError(
    "ERR_AGENT_TMUX",
    `tmux show-options failed: ${detail || `exit ${result.status}`}`,
  );
}

function writeSessionOption(session, option, value) {
  runTmux([
    "set-option",
    "-q",
    "-t",
    session,
    option,
    value,
  ]);
}

function paneProcessState(session) {
  const result = runTmux([
    "display-message",
    "-p",
    "-t",
    `${session}:0.0`,
    "#{pane_dead}\t#{pane_dead_status}",
  ]);
  const match = result.stdout.trim().match(/^([01])(?:\t(-?\d+))?$/);
  if (!match) {
    throw agentError(
      "ERR_AGENT_TMUX",
      `tmux returned an invalid pane state for ${session}`,
    );
  }
  return {
    dead: match[1] === "1",
    exitCode: match[2] === undefined ? null : Number(match[2]),
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function observeStartup(session) {
  const deadline = Date.now() + STARTUP_GRACE_MS;
  let state = paneProcessState(session);
  while (!state.dead && Date.now() < deadline) {
    await delay(Math.min(STARTUP_POLL_MS, Math.max(0, deadline - Date.now())));
    if (!hasSession(session)) return null;
    state = paneProcessState(session);
  }
  return state;
}

function readObservedHash(session) {
  return readSessionOption(session, OUTPUT_HASH_OPTION);
}

function writeObservedHash(session, digest) {
  writeSessionOption(session, OUTPUT_HASH_OPTION, digest);
}

function lineHashList(text) {
  return text.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => sha256(line).slice(0, 16))
    .sort()
    .join(",");
}

function excludedLineHashCounts(session) {
  const encoded = [
    readSessionOption(session, BASELINE_LINES_OPTION),
    readSessionOption(session, PROMPT_LINES_OPTION),
  ].filter(Boolean).join(",");
  const counts = new Map();
  for (const digest of encoded.split(",").filter(Boolean)) {
    counts.set(digest, (counts.get(digest) ?? 0) + 1);
  }
  return counts;
}

function detectLocalSurface(profile) {
  const cli = executableAvailable(profile.command);
  const tmux = executableAvailable(tmuxCommand());
  return {
    cli,
    tmux,
    observable: cli && tmux,
  };
}

function invocationFallback(localSurface) {
  if (!localSurface.cli) return "current-tool-subagent-or-inline-gap";
  if (!localSurface.tmux) return "non-interactive-cli";
  return "non-interactive-cli-or-current-tool-subagent-or-inline-gap";
}

function baseReport(options, profile) {
  return {
    command: `agent ${options.command}`,
    agent: profile.key,
    provider: profile.name,
    projectRoot: options.projectRoot,
  };
}

function unavailable(options, profile, reason) {
  const localSurface = detectLocalSurface(profile);
  const fallback = invocationFallback(localSurface);
  return {
    exitCode: 1,
    report: {
      ...baseReport(options, profile),
      localSurface,
      providerAccess: "unverified",
      fallback,
      label: options.label,
      session: agentSessionName({
        agent: profile.key,
        projectRoot: options.projectRoot,
        label: options.label,
      }),
      status: "unavailable",
      reason,
      completion: "unknown",
      nextAction: `Use ${fallback}.`,
    },
  };
}

function endedSession(options, profile, session, state, output = null) {
  const localSurface = detectLocalSurface(profile);
  const fallback = invocationFallback(localSurface);
  const failed = state.exitCode !== 0;
  const status = failed ? "failed" : "exited";
  const reason = state.exitCode === null
    ? "Provider process exited without an observable status."
    : `Provider process exited with status ${state.exitCode}.`;
  return {
    exitCode: 1,
    report: {
      ...baseReport(options, profile),
      localSurface,
      providerAccess: failed ? "failed" : "unverified",
      fallback,
      label: options.label,
      session,
      status,
      providerExitCode: state.exitCode,
      reason,
      ...(output === null
        ? {}
        : {
          outputBytes: Buffer.byteLength(output),
          outputSha256: sha256(output),
        }),
      completion: "unknown",
      nextAction: `Inspect retained output with agent read, then close/reopen or use ${fallback}.`,
    },
  };
}

function runCheck(options, profile) {
  const localSurface = detectLocalSurface(profile);
  const fallback = invocationFallback(localSurface);
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      localSurface,
      providerAccess: "unverified",
      fallback,
      nextAction: localSurface.observable
        ? `Local observable session surface is available; provider access remains unverified. If invocation fails, use ${fallback}.`
        : `Provider access remains unverified. Use ${fallback}.`,
    },
  };
}

async function runOpen(options, profile) {
  const localSurface = detectLocalSurface(profile);
  if (!localSurface.tmux) return unavailable(options, profile, "tmux is unavailable");
  if (!localSurface.cli) {
    return unavailable(options, profile, `${profile.command} is unavailable`);
  }
  const session = agentSessionName({
    agent: profile.key,
    projectRoot: options.projectRoot,
    label: options.label,
  });
  if (hasSession(session)) {
    const state = paneProcessState(session);
    if (state.dead) return endedSession(options, profile, session, state);
    return {
      exitCode: 0,
      report: {
        ...baseReport(options, profile),
        label: options.label,
        session,
        status: "exists",
        readOnly: profile.readOnly,
        completion: "unknown",
        nextAction: "Use agent status, read, or send.",
      },
    };
  }
  runTmux([
    "new-session",
    "-d",
    "-s",
    session,
    "-x",
    "200",
    "-y",
    "50",
    "-c",
    options.projectRoot,
  ]);
  runTmux([
    "set-option",
    "-w",
    "-t",
    `${session}:0`,
    "remain-on-exit",
    "on",
  ]);
  runTmux([
    "respawn-pane",
    "-k",
    "-t",
    `${session}:0.0`,
    "-c",
    options.projectRoot,
    profile.command,
    ...profile.interactiveArgs,
  ]);
  const startup = await observeStartup(session);
  if (startup === null) {
    return unavailable(
      options,
      profile,
      "provider session closed before its exit status could be observed",
    );
  }
  if (startup.dead) {
    return endedSession(
      options,
      profile,
      session,
      startup,
      capturePane(session, DEFAULT_STATUS_LINES),
    );
  }
  const initial = capturePane(session, DEFAULT_STATUS_LINES);
  writeObservedHash(session, sha256(initial));
  writeSessionOption(session, BASELINE_LINES_OPTION, lineHashList(initial));
  writeSessionOption(session, PROMPT_LINES_OPTION, "");
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      label: options.label,
      session,
      status: "opened",
      readOnly: profile.readOnly,
      completion: "unknown",
      nextAction: "Send a self-contained prompt with agent send.",
    },
  };
}

function sessionOrReport(options, profile) {
  if (!executableAvailable(tmuxCommand())) {
    return { result: unavailable(options, profile, "tmux is unavailable") };
  }
  const session = agentSessionName({
    agent: profile.key,
    projectRoot: options.projectRoot,
    label: options.label,
  });
  if (!hasSession(session)) {
    const localSurface = detectLocalSurface(profile);
    const fallback = invocationFallback(localSurface);
    return {
      result: {
        exitCode: 1,
        report: {
          ...baseReport(options, profile),
          label: options.label,
          session,
          status: "closed",
          localSurface,
          providerAccess: "unverified",
          fallback,
          reason: "Observable session does not exist; provider exit status is unavailable.",
          completion: "unknown",
          nextAction: `Run agent open first or use ${fallback}.`,
        },
      },
    };
  }
  const state = paneProcessState(session);
  return {
    session,
    ...(state.dead ? { result: endedSession(options, profile, session, state) } : {}),
  };
}

function runSend(options, profile) {
  const resolved = sessionOrReport(options, profile);
  if (resolved.result) return resolved.result;
  const { session } = resolved;
  const baseline = capturePane(session, DEFAULT_STATUS_LINES);
  writeObservedHash(session, sha256(baseline));
  writeSessionOption(session, BASELINE_LINES_OPTION, lineHashList(baseline));
  writeSessionOption(session, PROMPT_LINES_OPTION, lineHashList(options.prompt));
  const buffer = `catpaw-${sha256(`${session}\0${options.prompt}`).slice(0, 16)}`;
  runTmux(["load-buffer", "-b", buffer, "-"], { input: options.prompt });
  runTmux([
    "paste-buffer",
    "-d",
    "-p",
    "-b",
    buffer,
    "-t",
    session,
  ]);
  runTmux(["send-keys", "-t", session, "Enter"]);
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      label: options.label,
      session,
      status: "sent",
      promptBytes: Buffer.byteLength(options.prompt),
      waited: false,
      completion: "unknown",
      nextAction: "Inspect progress with agent status or agent read.",
    },
  };
}

function explicitWaiting(output, excludedCounts) {
  const patterns = [
    /waiting for (?:input|approval)/i,
    /awaiting (?:input|approval)/i,
    /press (?:enter|return) to/i,
    /permission (?:required|requested)/i,
    /do you want to (?:continue|proceed)/i,
  ];
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  let evidence = null;
  for (const line of lines) {
    const digest = sha256(line).slice(0, 16);
    const excluded = excludedCounts.get(digest) ?? 0;
    if (excluded > 0) {
      excludedCounts.set(digest, excluded - 1);
    } else if (patterns.some((pattern) => pattern.test(line))) {
      evidence = line;
    }
  }
  return evidence;
}

function runStatus(options, profile) {
  const resolved = sessionOrReport(options, profile);
  if (resolved.result) {
    if (!["failed", "exited"].includes(resolved.result.report.status)) {
      return resolved.result;
    }
    return endedSession(
      options,
      profile,
      resolved.result.report.session,
      {
        dead: true,
        exitCode: resolved.result.report.providerExitCode,
      },
      capturePane(resolved.result.report.session, DEFAULT_STATUS_LINES),
    );
  }
  const { session } = resolved;
  const output = capturePane(session, DEFAULT_STATUS_LINES);
  const digest = sha256(output);
  const previous = readObservedHash(session);
  const observation = previous === null
    ? "unobserved"
    : previous === digest
      ? "stable"
      : "changed";
  writeObservedHash(session, digest);
  const waitingEvidence = explicitWaiting(
    output,
    excludedLineHashCounts(session),
  );
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      label: options.label,
      session,
      status: "open",
      outputObservation: observation,
      outputBytes: Buffer.byteLength(output),
      outputSha256: digest,
      waitingForInput: waitingEvidence !== null,
      waitingEvidence,
      completion: "unknown",
      nextAction: waitingEvidence
        ? "Inspect the explicit input request before responding."
        : "Continue observing or read recent output.",
    },
  };
}

function runRead(options, profile) {
  const resolved = sessionOrReport(options, profile);
  if (
    resolved.result &&
    !["failed", "exited"].includes(resolved.result.report.status)
  ) {
    return resolved.result;
  }
  const session = resolved.result?.report.session ?? resolved.session;
  const output = capturePane(session, options.lines);
  const ended = resolved.result?.report ?? null;
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      label: options.label,
      session,
      status: ended?.status ?? "open",
      ...(ended === null
        ? {}
        : {
          providerExitCode: ended.providerExitCode,
          reason: ended.reason,
          fallback: ended.fallback,
        }),
      linesRequested: options.lines,
      output,
      outputBytes: Buffer.byteLength(output),
      outputSha256: sha256(output),
      completion: "unknown",
      nextAction: ended === null
        ? "Evaluate the output; do not infer completion from stability."
        : "Evaluate retained output, then close/reopen or use the reported fallback.",
    },
  };
}

function runClose(options, profile) {
  if (!executableAvailable(tmuxCommand())) {
    return unavailable(options, profile, "tmux is unavailable");
  }
  const session = agentSessionName({
    agent: profile.key,
    projectRoot: options.projectRoot,
    label: options.label,
  });
  if (!hasSession(session)) {
    return {
      exitCode: 0,
      report: {
        ...baseReport(options, profile),
        label: options.label,
        session,
        status: "not-found",
        completion: "unknown",
        nextAction: "No action required.",
      },
    };
  }
  const killed = runTmux(["kill-session", "-t", session], {
    allowFailure: true,
  });
  if (killed.status === 1) {
    const detail = (killed.stderr || killed.stdout).trim();
    if (
      detail !== "" &&
      !/(?:can't find session|no server running|session not found)/i.test(detail)
    ) {
      throw agentError("ERR_AGENT_TMUX", `tmux kill-session failed: ${detail}`);
    }
    if (hasSession(session)) {
      throw agentError(
        "ERR_AGENT_TMUX",
        `tmux kill-session failed while session remains open: ${session}`,
      );
    }
    return {
      exitCode: 0,
      report: {
        ...baseReport(options, profile),
        label: options.label,
        session,
        status: "not-found",
        completion: "unknown",
        nextAction: "No action required.",
      },
    };
  }
  if (killed.status !== 0) {
    throw agentError(
      "ERR_AGENT_TMUX",
      `tmux kill-session failed: ${(killed.stderr || killed.stdout).trim()}`,
    );
  }
  return {
    exitCode: 0,
    report: {
      ...baseReport(options, profile),
      label: options.label,
      session,
      status: "closed",
      completion: "unknown",
      nextAction: "No action required.",
    },
  };
}

export async function runAgentCommand(options) {
  const profile = getAgentProfile(options.agent, {
    projectRoot: options.projectRoot,
  });
  if (options.command === "check") return runCheck(options, profile);
  if (options.command === "open") return runOpen(options, profile);
  if (options.command === "send") return runSend(options, profile);
  if (options.command === "status") return runStatus(options, profile);
  if (options.command === "read") return runRead(options, profile);
  if (options.command === "close") return runClose(options, profile);
  throw new TypeError(`Unsupported agent command: ${options.command}`);
}

export function renderAgentReport(report) {
  if (report.command === "agent check") {
    const localSurface = report.localSurface;
    return [
      "Agent check",
      `Agent: ${report.agent} (${report.provider})`,
      "Local surface:",
      `CLI: ${localSurface.cli ? "available" : "missing"}`,
      `tmux: ${localSurface.tmux ? "available" : "missing"}`,
      `Observable session: ${localSurface.observable ? "available" : "unavailable"}`,
      `Provider access: ${report.providerAccess}`,
      "No model, authentication, or subscription check was performed.",
      `Invocation fallback: ${report.fallback}`,
      `Next: ${report.nextAction}`,
      "",
    ].join("\n");
  }
  const lines = [
    report.command,
    `Agent: ${report.agent} (${report.provider})`,
    `Session: ${report.session}`,
    `Status: ${report.status}`,
  ];
  if (report.outputObservation) {
    lines.push(`Output: ${report.outputObservation}`);
  }
  if (report.waitingForInput !== undefined) {
    lines.push(`Waiting for input: ${report.waitingForInput ? "yes" : "no"}`);
  }
  if (report.reason) lines.push(`Reason: ${report.reason}`);
  if (report.providerExitCode !== undefined) {
    lines.push(`Provider exit: ${report.providerExitCode ?? "unknown"}`);
  }
  if (report.fallback) lines.push(`Fallback: ${report.fallback}`);
  if (report.output !== undefined) lines.push("--- output ---", report.output);
  lines.push(`Completion: ${report.completion}`, `Next: ${report.nextAction}`, "");
  return lines.join("\n");
}
