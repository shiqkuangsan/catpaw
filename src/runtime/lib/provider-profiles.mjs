import { createHash } from "node:crypto";
import path from "node:path";

const DIRECT_ALIASES = new Map([
  ["cc", "cc"],
  ["claude", "cc"],
  ["claude-code", "cc"],
  ["cx", "cx"],
  ["codex", "cx"],
]);
const RECIPROCAL_ALIASES = new Set([
  "laoer",
  "老二",
  "second-opinion",
  "second-reviewer",
]);

function aliasText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a nonempty string.`);
  }
  return value.trim().toLowerCase();
}

function directAgentKey(value) {
  return DIRECT_ALIASES.get(aliasText(value, "agent")) ?? null;
}

export function resolveAgentKey(value, { host } = {}) {
  const alias = aliasText(value, "agent");
  const direct = DIRECT_ALIASES.get(alias);
  if (direct) return direct;
  if (RECIPROCAL_ALIASES.has(alias)) {
    if (host === undefined || host === null || String(host).trim() === "") {
      throw new TypeError("Laoer routing requires current host cc or cx.");
    }
    const hostKey = directAgentKey(host);
    if (!hostKey) {
      throw new TypeError("Laoer routing requires current host cc or cx.");
    }
    return hostKey === "cc" ? "cx" : "cc";
  }
  throw new TypeError(
    `CatPaw callable Agents support only cc and cx; unsupported alias: ${value}`,
  );
}

function resolvedProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || projectRoot.length === 0) {
    throw new TypeError("projectRoot must be a nonempty path string.");
  }
  return path.resolve(projectRoot);
}

export function getAgentProfile(value, { projectRoot = process.cwd() } = {}) {
  const key = resolveAgentKey(value);
  const root = resolvedProjectRoot(projectRoot);
  if (key === "cc") {
    return Object.freeze({
      key,
      name: "Claude Code",
      command: "claude",
      readOnly: true,
      interactiveArgs: Object.freeze([
        "--safe-mode",
        "--permission-mode",
        "plan",
        "--tools",
        "Read,Glob,Grep",
        "--disallowedTools",
        "Edit,Write,NotebookEdit",
      ]),
      nonInteractiveArgs: Object.freeze([
        "-p",
        "--no-session-persistence",
        "--safe-mode",
        "--permission-mode",
        "plan",
        "--tools",
        "Read,Glob,Grep",
        "--disallowedTools",
        "Edit,Write,NotebookEdit",
      ]),
    });
  }
  return Object.freeze({
    key,
    name: "Codex",
    command: "codex",
    readOnly: true,
    interactiveArgs: Object.freeze([
      "-C",
      root,
      "--sandbox",
      "read-only",
      "--ask-for-approval",
      "never",
      "--no-alt-screen",
    ]),
    nonInteractiveArgs: Object.freeze([
      "-C",
      root,
      "--sandbox",
      "read-only",
      "--ask-for-approval",
      "never",
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "-",
    ]),
  });
}

function safeLabel(label) {
  if (typeof label !== "string" || label.trim() === "") {
    throw new TypeError("label must be a nonempty string.");
  }
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "session";
}

export function agentSessionName({ agent, projectRoot, label = "default" }) {
  const key = resolveAgentKey(agent);
  const root = resolvedProjectRoot(projectRoot);
  const labelPart = safeLabel(label);
  const digest = createHash("sha256")
    .update(`${key}\0${root}\0${label}`)
    .digest("hex")
    .slice(0, 12);
  return `catpaw-${key}-${labelPart}-${digest}`;
}
