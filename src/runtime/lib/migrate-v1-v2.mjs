import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.mjs";
import { completionEvidenceState } from "./completion-evidence.mjs";
import {
  hasMilestoneScopeMarkers,
  parseMilestoneScope,
} from "./milestone-scope.mjs";
import { validateMetadata } from "./schema.mjs";
import {
  managedTableCell,
  rebuildDashboard,
} from "./commands/workflow.mjs";

const WORK_ORDER = [
  "id",
  "type",
  "mode",
  "status",
  "stage",
  "created",
  "updated",
  "closed",
];
const MILESTONE_ORDER = [
  "id",
  "status",
  "created",
  "updated",
  "closed",
  "target",
];
const EVIDENCE_ORDER = [
  "type",
  "work",
  "stage",
  "created",
  "updated",
  "independent",
  "agent",
  "lens",
];
const PLAN_ORDER = ["work", "updated"];
const REQUIRED_DIRECTORIES = [
  "milestones",
  "work",
  "plans",
  "evidence",
  "evidence/topics",
];
const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const ACTIVE_STATUSES = new Set(["active", "blocked"]);
const WORK_STAGES = new Set(["think", "plan", "build", "review", "test", "ship", "reflect"]);
const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
const ISO_DATE_PATTERN = /\b(?:19|20)[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])\b/g;
const LEGACY_ARCHIVE_ROOT = "legacy/schema-1";
const LEGACY_ROOTS = [
  "reqs",
  "plans",
  "milestones",
  "tests",
  "reviews",
  "research",
  "work",
  "evidence",
];
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF8_ARCHIVE_DECODER = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

function compareText(left, right) {
  return left.localeCompare(right, "en");
}

function reportSort(left, right) {
  return compareText(
    `${left.path ?? left.from ?? ""}\0${left.code ?? left.kind ?? ""}\0${left.message ?? left.to ?? ""}`,
    `${right.path ?? right.from ?? ""}\0${right.code ?? right.kind ?? ""}\0${right.message ?? right.to ?? ""}`,
  );
}

function finding(code, artifactPath, message) {
  return { code, path: artifactPath, message };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function warning(code, artifactPath, message) {
  return finding(code, artifactPath, message);
}

function canonicalWorkId(value) {
  if (typeof value !== "string") return null;
  const match = path.posix
    .basename(value.trim(), ".md")
    .match(/^(FR|BUG|CHORE)-([0-9]+)(?:-.+)?$/i);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  const digits = match[2].padStart(3, "0");
  const id = `${prefix}-${digits}`;
  return WORK_ID_PATTERN.test(id) ? id : null;
}

function workIdsInPath(value) {
  return new Set(
    String(value ?? "")
      .split("/")
      .map(canonicalWorkId)
      .filter(Boolean),
  );
}

function workType(id) {
  if (id?.startsWith("FR-")) return "feature";
  if (id?.startsWith("BUG-")) return "bug";
  if (id?.startsWith("CHORE-")) return "chore";
  return null;
}

function canonicalMilestoneId(value) {
  if (typeof value !== "string") return null;
  const match = path.posix
    .basename(value.trim(), ".md")
    .match(/^(?:MS-|M)([0-9]+)(?:-.+)?$/i);
  if (!match) return null;
  return `MS-${match[1].padStart(3, "0")}`;
}

function normalizedMilestoneStatus(value) {
  if (typeof value !== "string") return null;
  const status = value.trim().toLowerCase();
  if (["done", "completed", "closed"].includes(status)) return "done";
  if (["active", "blocked", "cancelled"].includes(status)) return status;
  return null;
}

function normalizedWorkStatus(value, activeSignal) {
  if (typeof value !== "string") return null;
  const status = value.trim().toLowerCase();
  if (["done", "completed", "closed"].includes(status)) return "done";
  if (status === "cancelled") return "cancelled";
  if (status === "active") return "active";
  if (["blocked", "paused"].includes(status)) return "blocked";
  if (
    activeSignal &&
    ["draft", "todo", "backlog", "proposed", "framed"].includes(status)
  ) {
    return "active";
  }
  return null;
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function datesIn(...values) {
  return [...new Set(
    values
      .filter((value) => typeof value === "string")
      .flatMap((value) => [...value.matchAll(ISO_DATE_PATTERN)].map((match) => match[0]))
      .filter(isCalendarDate),
  )].sort(compareText);
}

function migrationDateFrom(value, markdown) {
  if (typeof value === "string" && datesIn(value).includes(value)) return value;
  return datesIn(...markdown.values()).at(-1) ?? new Date().toISOString().slice(0, 10);
}

function sectionText(body, headings) {
  const names = new Set(headings.map((item) => item.toLowerCase()));
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => {
    const match = line.trim().match(/^##\s+(.+)$/);
    return match && names.has(match[1].trim().toLowerCase());
  });
  if (start === -1) return "";
  const end = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line.trim()),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

function statusFromText(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const original = value.toLowerCase();
  const hasNegatedTerminal = /\b(?:not|never)\s+(?:yet\s+)?(?:done|complete|completed|closed|cancelled|canceled)\b|(?:尚未|还未|未曾|未|没有|并未|不是|并非)(?:已)?(?:完成|关闭|取消|废弃|终结|收口)/.test(original);
  const hasTerminalTransition = /\b(?:now|finally)\s+(?:done|complete|completed|closed|cancelled|canceled)\b|(?:现(?:在)?|如今|最终)(?:已经|已)(?:完成|关闭|取消|废弃|终结|收口)/.test(original);
  const suppressTerminal = hasNegatedTerminal && !hasTerminalTransition;
  const text = original
    .replace(
      /\b(?:not|never)\s+(?:yet\s+)?(?:done|complete|completed|closed|cancelled|canceled|active|blocked|paused|deferred)\b/g,
      "",
    )
    .replace(
      /(?:尚未|还未|未曾|未|没有|并未|不是|并非)(?:已)?(?:完成|关闭|取消|废弃|终结|收口|进行中|推进|暂停|阻塞|后置|延后)/g,
      "",
    );
  const first = text
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .find(Boolean) ?? "";
  if (!suppressTerminal && /^(?:done|completed|closed|已完成|历史完成|完成(?:[，。.]|$))/.test(first)) {
    return "done";
  }
  if (!suppressTerminal && /^(?:cancelled|canceled|superseded|已取消|取消|废弃)/.test(first)) {
    return "cancelled";
  }
  if (/^(?:active|in[_ -]?progress|进行中|正在|当前推进|本周优先)/.test(first)) {
    return "active";
  }
  if (/^(?:blocked|paused|deferred|backlog|暂停|后置|延后|后续|尚未启动|下一阶段|待启动|待推进|计划中)/.test(first)) {
    return "blocked";
  }
  if (
    !suppressTerminal &&
    /(?:^|\|)\s*(?:(?:done|completed|closed)\s*(?:\||$)|(?:已完成|历史完成)\s*(?:[:：，。;；|]|$))/.test(text)
  ) {
    return "done";
  }
  if (
    !suppressTerminal &&
    /(?:^|\|)\s*(?:(?:cancelled|canceled|superseded)\s*(?:\||$)|(?:已取消|取消|废弃)\s*(?:[:：，。;；|]|$))/.test(text)
  ) {
    return "cancelled";
  }
  if (!suppressTerminal && /(?:cancelled|canceled|superseded|废弃|取消|取代|不再推进)/.test(text)) {
    return "cancelled";
  }
  if (/(?:\bactive\b|in[_ -]?progress|进行中|实施中|正在(?:推进|收口|实施)|当前推进|本周优先)/.test(text)) {
    return "active";
  }
  if (/(?:blocked|paused|deferred|backlog|暂停|后置|延后|后续|候选|尚未启动|下一阶段|待启动|待推进|计划中)/.test(text)) {
    return "blocked";
  }
  if (!suppressTerminal && /(?:\bdone\b|completed|closed|已完成|历史完成|已收口|已交付|已补|已实现|已新增|已接入|已合入|完成[（(]|完成[。.]?$)/m.test(text)) {
    return "done";
  }
  return null;
}

function statusNearId(body, id) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const matching = lines.filter((line) => {
    const ids = [...workIdsInText(line)];
    if (!ids.includes(id)) return false;
    if (ids.length <= 1) return true;
    const sharedSequence = workIdGroupsInText(line).some((group) =>
      group.has(id) && group.size === ids.length
    );
    if (sharedSequence) return true;
    const firstToken = line.match(/\b(?:FR|BUG|CHORE)-[0-9]+\b/i)?.[0] ?? null;
    return canonicalWorkId(firstToken) === id;
  });
  return statusFromText(matching.join("\n"));
}

function artifactDates(data, body, status, fallback) {
  const sourceDates = datesIn(body);
  const created = datesIn(data.created ?? "").at(0) ?? sourceDates.at(0) ?? fallback;
  const updated = datesIn(data.updated ?? "").at(-1) ?? sourceDates.at(-1) ?? created;
  const closed = TERMINAL_STATUSES.has(status)
    ? datesIn(data.closed ?? "").at(-1) ?? updated
    : null;
  return { created, updated, closed };
}

function artifactStatus(data, body) {
  return normalizedWorkStatus(data.status, false) ??
    statusFromText(sectionText(body, ["status", "状态"]));
}

function hasCompletedTestSignal(data, body) {
  if (artifactStatus(data, body) === "done") return true;
  const results = String(body ?? "")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => /^\|.*\|$/.test(line.trim()) && !/^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim()))
    .map((line) => line.trim().match(/\|\s*([^|]+?)\s*\|$/)?.[1]?.trim() ?? "")
    .filter((value) => value !== "" && !/^(?:result|status|结果|状态)$/i.test(value));
  if (results.length === 0) return false;
  return results.every((value) => {
    const text = value
      .toLowerCase()
      .replace(/\b(?:0|no)\s+(?:failed|failures?)\b/g, "")
      .replace(/(?:没有|无)失败/g, "");
    const unresolved = /\b(?:pending|failed?|failure|not\s+run|skipped|todo)\b|失败|未通过|待执行|待验证|未执行|阻塞/.test(text);
    const completed = /\b(?:passed|successful|success)\b|\bpass\s*[:=]?\s*[0-9]+\b|通过|成功/.test(text);
    return completed && !unresolved;
  });
}

function inferredMode(data, status) {
  if (data.mode === "gated" || data.level === "L3") return "gated";
  if (data.mode === "tracked" || data.level === "L2") return "tracked";
  return TERMINAL_STATUSES.has(status) ? "tracked" : "gated";
}

function inferredStage(data, status, { hasPlan = false, hasTest = false, hasReview = false } = {}) {
  if (WORK_STAGES.has(data.stage)) return data.stage;
  if (TERMINAL_STATUSES.has(status)) return "reflect";
  if (hasReview) return "review";
  if (hasTest) return "test";
  if (hasPlan) return "plan";
  return "think";
}

function inferredWarning(artifactPath, fields, details = "") {
  const suffix = details === "" ? "" : ` ${details}`;
  return warning(
    "inferred-metadata",
    artifactPath,
    `Inferred schema 2 metadata: ${[...new Set(fields)].sort(compareText).join(", ")}.${suffix}`,
  );
}

function workIdsInText(value) {
  const ids = new Set();
  const text = String(value ?? "");
  for (const token of text.matchAll(/\b(?:FR|BUG|CHORE)-[0-9]+\b/gi)) {
    const id = canonicalWorkId(token[0]);
    if (id) ids.add(id);
  }
  for (const group of workIdGroupsInText(text)) {
    for (const id of group) ids.add(id);
  }
  return ids;
}

function workIdGroupsInText(value) {
  const groups = [];
  const text = String(value ?? "");
  for (const sequence of text.matchAll(
    /\b(FR|BUG|CHORE)-([0-9]+)((?:\s*[/、,，]\s*[0-9]+)+)/gi,
  )) {
    const group = new Set();
    const first = canonicalWorkId(`${sequence[1]}-${sequence[2]}`);
    if (first) group.add(first);
    for (const suffix of sequence[3].matchAll(/[0-9]+/g)) {
      const id = canonicalWorkId(`${sequence[1]}-${suffix[0]}`);
      if (id) group.add(id);
    }
    if (group.size > 1) groups.push(group);
  }
  return groups;
}

function workIdFromHeading(body) {
  const heading = String(body ?? "").match(/^#\s+(.+)$/m)?.[1] ?? "";
  const ids = workIdsInText(heading);
  return ids.size === 1 ? [...ids][0] : null;
}

function inferredWorkId(data, source, body) {
  return canonicalWorkId(data.id) ??
    canonicalWorkId(source) ??
    workIdFromHeading(body);
}

function inferredMilestoneId(data, source, body) {
  const heading = String(body ?? "").match(/^#\s+(.+)$/m)?.[1] ?? "";
  return canonicalMilestoneId(data.id) ??
    canonicalMilestoneId(source) ??
    canonicalMilestoneId(heading.match(/\b(?:MS-|M)\d+\b/i)?.[0] ?? "");
}

function milestoneWorkIds(body) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const scopedIds = new Set();
  let foundScope = false;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].trim().match(/^##\s+(.+)$/);
    if (!match) continue;
    if (negativeScopeHeading(match[1])) {
      foundScope = true;
      continue;
    }
    if (!positiveScopeHeading(match[1])) continue;
    foundScope = true;
    const end = lines.findIndex(
      (line, lineIndex) => lineIndex > index && /^##\s+/.test(line.trim()),
    );
    const ids = workIdsInText(lines.slice(index + 1, end === -1 ? undefined : end).join("\n"));
    for (const id of ids) scopedIds.add(id);
  }
  if (foundScope) return scopedIds;
  return workIdsInText(body);
}

function negativeScopeHeading(value) {
  return /^(?:out\s+of\s+scope|not\s+in\s+scope|non-?goals?|excluded?|非目标|范围外|排除|不包含)$/i.test(
    String(value ?? "").trim(),
  );
}

function positiveScopeHeading(value) {
  const heading = String(value ?? "").trim();
  return /^(?:managed\s+scope|scope|in\s+scope|work\s+items?|frs?|included?\s+(?:frs?|work\s+items?)|candidate\s+(?:frs?|work\s+items?)|范围|包含\s*fr|候选\s*fr)$/i.test(heading);
}

function appendManagedScope(body, ids, workById) {
  if (hasMilestoneScopeMarkers(body)) return body;
  const rows = [...ids]
    .filter((id) => workById.has(id))
    .sort(compareText)
    .map((id) => {
      const work = workById.get(id);
      return `| ${id} | ${managedTableCell(work.title)} | ${work.metadata.status} |  |`;
    });
  const block = [
    "## Managed Scope",
    "",
    "<!-- catpaw:milestone-scope:start -->",
    "| Work Item ID | Title | Status | Notes |",
    "|---|---|---|---|",
    ...rows,
    "<!-- catpaw:milestone-scope:end -->",
  ].join("\n");
  return `${String(body ?? "").trimEnd()}\n\n${block}\n`;
}

function sectionIds(body, heading) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase(),
  );
  if (start === -1) return new Set();
  const end = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line.trim()),
  );
  const section = lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
  const ids = new Set();
  for (const token of section.matchAll(/\b(?:FR|BUG|CHORE)-[0-9]+\b/gi)) {
    const id = canonicalWorkId(token[0]);
    if (id) ids.add(id);
  }
  return ids;
}

function milestoneSectionIds(body) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === "## active milestones",
  );
  if (start === -1) return new Set();
  const end = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line.trim()),
  );
  const section = lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
  const ids = new Set();
  for (const token of section.matchAll(/\b(?:MS-|M)[0-9]+\b/gi)) {
    const id = canonicalMilestoneId(token[0]);
    if (id) ids.add(id);
  }
  return ids;
}

function normalizedBinding(data, artifactPath, artifactKind) {
  const hasWork = Object.hasOwn(data ?? {}, "work") && data.work !== null;
  const hasReq = Object.hasOwn(data ?? {}, "req") && data.req !== null;
  const rawWork = hasWork ? data.work : null;
  const rawReq = hasReq ? data.req : null;
  const work = canonicalWorkId(rawWork);
  const req = canonicalWorkId(rawReq);
  const invalid = [
    ...(hasWork && work === null ? ["work"] : []),
    ...(hasReq && req === null ? ["req"] : []),
  ];
  if (invalid.length > 0) {
    return {
      value: null,
      error: `Invalid legacy Work binding fields: ${invalid.join(", ")}.`,
      code: "invalid-legacy-identity",
      path: artifactPath,
    };
  }
  if (work !== null && req !== null && work !== req) {
    return {
      value: null,
      error: `Conflicting legacy Work bindings: work=${rawWork}, req=${rawReq}.`,
      code: `conflicting-${artifactKind}-work`,
      path: artifactPath,
    };
  }
  const sourceIds = workIdsInPath(artifactPath);
  if (sourceIds.size > 1) {
    return {
      value: null,
      error: `Conflicting Work identities in path: ${[...sourceIds].join(", ")}.`,
      code: `conflicting-${artifactKind}-work`,
      path: artifactPath,
    };
  }
  const source = [...sourceIds][0] ?? null;
  const explicit = work ?? req;
  if (explicit !== null && source !== null && explicit !== source) {
    return {
      value: null,
      error: `Conflicting Work identity: metadata=${explicit}, filename=${source}.`,
      code: `conflicting-${artifactKind}-work`,
      path: artifactPath,
    };
  }
  const value = explicit ?? source;
  return {
    value,
    normalized: value !== null && ![rawWork, rawReq].includes(value),
    inferredFields: [
      ...(rawWork !== null && work === null ? ["work"] : []),
      ...(rawReq !== null && req === null ? ["req"] : []),
      ...(explicit === null && source !== null ? ["work"] : []),
    ],
  };
}

function metadataIssueFields(kind, metadata) {
  return [
    ...new Set(
      validateMetadata(kind, metadata).map((issue) =>
        issue.path.split(".")[0]
      ),
    ),
  ].sort(compareText);
}

function isLegacySourcePath(relativePath) {
  if (relativePath === "index.md" || relativePath === "lessons.md") return true;
  const root = relativePath.split("/", 1)[0];
  return LEGACY_ROOTS.includes(root);
}

function decodeKnownMarkdown(bytes, artifactPath, blockers) {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    blockers.push(
      finding(
        "non-utf8-known-markdown",
        artifactPath,
        "Known schema 1 .md file is not valid UTF-8 and cannot be migrated losslessly.",
      ),
    );
    return null;
  }
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function asciiSlug(value, fallback = "item") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || fallback;
}

async function inventoryTree(root) {
  const entries = new Map();

  async function visit(relativePath) {
    const absolutePath = path.join(root, relativePath);
    const stats = await lstat(absolutePath);
    const normalized = slash(relativePath);
    if (stats.isDirectory()) {
      const names = await readdir(absolutePath);
      names.sort(compareText);
      entries.set(normalized, {
        type: "directory",
        empty: names.length === 0,
        mode: stats.mode & 0o7777,
      });
      for (const name of names) {
        await visit(path.join(relativePath, name));
      }
      return;
    }
    const type = stats.isFile()
      ? "file"
      : stats.isSymbolicLink()
        ? "symlink"
        : "special";
    let symlinkFacts = {};
    if (type === "symlink") {
      const targetBytes = await readlink(absolutePath, { encoding: "buffer" });
      let target = null;
      try {
        target = UTF8_ARCHIVE_DECODER.decode(targetBytes);
      } catch {
        // The caller turns a non-UTF-8 target into a deterministic blocker.
      }
      symlinkFacts = { target, targetBytes };
    }
    entries.set(normalized, {
      type,
      empty: false,
      mode: stats.mode & 0o7777,
      ...symlinkFacts,
    });
  }

  await visit("");
  return entries;
}

function parseText(text, artifactPath, blockers) {
  try {
    return parseFrontmatter(text);
  } catch (error) {
    blockers.push(finding("invalid-frontmatter", artifactPath, error.message));
    return null;
  }
}

function recoverLegacyFrontmatter(text) {
  const opening = text.match(/^---(?:\r?\n|$)/);
  if (!opening) {
    return {
      data: {},
      body: text,
      conflicts: [],
      ignoredFields: [],
      unterminated: false,
    };
  }

  const closingPattern = /^---\r?$/gm;
  closingPattern.lastIndex = opening[0].length;
  const closing = closingPattern.exec(text);
  if (!closing) {
    return {
      data: {},
      body: text,
      conflicts: [],
      ignoredFields: ["unterminated-frontmatter"],
      unterminated: true,
    };
  }

  let bodyStart = closing.index + closing[0].length;
  if (text[bodyStart] === "\n") bodyStart += 1;
  const body = text.slice(bodyStart);
  const raw = text.slice(opening[0].length, closing.index);
  const data = {};
  const conflicts = new Set();
  const ignoredFields = new Set();

  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "" || /^\s/.test(line)) continue;
    const matched = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(.*)$/);
    if (!matched) {
      const authoritative = line.match(
        /^(?:["']?)(id|work|req)(?:["']?)\s*:/i,
      )?.[1];
      ignoredFields.add(authoritative?.toLowerCase() ?? "invalid-entry");
      continue;
    }
    const key = matched[1];
    const value = matched[2].trim();
    if (value === "") {
      ignoredFields.add(key);
      continue;
    }
    let parsed;
    try {
      parsed = parseFrontmatter(`---\n${key}: ${value}\n---\n`).data[key];
    } catch {
      ignoredFields.add(key);
      continue;
    }
    if (Object.hasOwn(data, key)) {
      if (data[key] !== parsed) conflicts.add(key);
      continue;
    }
    data[key] = parsed;
  }

  return {
    data,
    body,
    conflicts: [...conflicts].sort(compareText),
    ignoredFields: [...ignoredFields].sort(compareText),
    unterminated: false,
  };
}

function authoritativeLegacyFields(artifactPath) {
  const fields = new Set(["work", "req"]);
  if (/^(?:reqs|milestones)\/[^/]+\.md$/.test(artifactPath)) fields.add("id");
  return fields;
}

function malformedLegacyIdentityKeys(data, artifactPath) {
  const authoritative = authoritativeLegacyFields(artifactPath);
  return Object.keys(data).filter((key) => {
    const normalized = key.toLowerCase();
    return authoritative.has(normalized) && key !== normalized;
  }).sort(compareText);
}

function parseLegacyArtifact(text, artifactPath, report) {
  try {
    const parsed = parseFrontmatter(text);
    const malformedKeys = malformedLegacyIdentityKeys(parsed.data, artifactPath);
    if (malformedKeys.length > 0) {
      report.blockers.push(
        finding(
          "invalid-legacy-identity",
          artifactPath,
          `Authoritative legacy fields must use canonical keys: ${malformedKeys.join(", ")}.`,
        ),
      );
      return null;
    }
    return { text, ...parsed };
  } catch (error) {
    const recovered = recoverLegacyFrontmatter(text);
    if (recovered.unterminated) {
      report.blockers.push(
        finding(
          "unterminated-frontmatter",
          artifactPath,
          "Legacy frontmatter has no closing delimiter.",
        ),
      );
      return null;
    }
    const authoritative = authoritativeLegacyFields(artifactPath);
    const malformedKeys = malformedLegacyIdentityKeys(
      recovered.data,
      artifactPath,
    );
    if (malformedKeys.length > 0) {
      report.blockers.push(
        finding(
          "invalid-legacy-identity",
          artifactPath,
          `Authoritative legacy fields must use canonical keys: ${malformedKeys.join(", ")}.`,
        ),
      );
      return null;
    }
    const invalidIdentity = recovered.ignoredFields.filter((field) =>
      authoritative.has(field)
    );
    if (invalidIdentity.length > 0) {
      report.blockers.push(
        finding(
          "invalid-legacy-identity",
          artifactPath,
          `Could not safely parse authoritative legacy fields: ${invalidIdentity.join(", ")}.`,
        ),
      );
      return null;
    }
    if (recovered.conflicts.length > 0) {
      report.blockers.push(
        finding(
          "conflicting-legacy-frontmatter",
          artifactPath,
          `Conflicting duplicate scalar fields: ${recovered.conflicts.join(", ")}.`,
        ),
      );
      return null;
    }
    const ignored = recovered.ignoredFields.length > 0
      ? ` Ignored structured or invalid fields: ${recovered.ignoredFields.join(", ")}.`
      : "";
    report.warnings.push(
      warning(
        "recovered-frontmatter",
        artifactPath,
        `Recovered safe scalar metadata after legacy frontmatter parse failure: ${error.message}.${ignored}`,
      ),
    );
    return { text, data: recovered.data, body: recovered.body };
  }
}

function headingTitle(body, prefixes = []) {
  let title = body?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  for (const prefix of prefixes) {
    title = title.replace(prefix, "").trim();
  }
  if (title === "" || /^(?:\[?title\]?|\.\.\.)$/i.test(title)) return null;
  return title;
}

function titleFromPath(relativePath, id = null) {
  let title = path.posix.basename(relativePath, ".md");
  if (id) title = title.replace(new RegExp(`^${id}-?`, "i"), "");
  title = title.replace(/[-_]+/g, " ").trim();
  return title === "" ? id ?? "Legacy artifact" : title;
}

function splitDestination(raw) {
  const leading = raw.match(/^\s*/)?.[0] ?? "";
  const trailing = raw.match(/\s*$/)?.[0] ?? "";
  const content = raw.slice(leading.length, raw.length - trailing.length);
  if (content.startsWith("<")) {
    const close = content.indexOf(">");
    if (close === -1) return null;
    return {
      leading,
      url: content.slice(1, close),
      suffix: content.slice(close + 1),
      trailing,
      angled: true,
    };
  }
  const matched = content.match(/^(\S+)([\s\S]*)$/);
  if (!matched) return null;
  return {
    leading,
    url: matched[1],
    suffix: matched[2],
    trailing,
    angled: false,
  };
}

function urlParts(url) {
  const markerIndexes = [url.indexOf("?"), url.indexOf("#")].filter(
    (index) => index >= 0,
  );
  const marker = markerIndexes.length === 0 ? -1 : Math.min(...markerIndexes);
  return marker === -1
    ? { pathname: url, suffix: "" }
    : { pathname: url.slice(0, marker), suffix: url.slice(marker) };
}

function isExternalTarget(url) {
  return (
    url === "" ||
    url.startsWith("#") ||
    url.startsWith("/") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)
  );
}

function isContainedPath(root, target) {
  return target === root || target.startsWith(root + path.sep);
}

function validateProjectLink({
  projectRoot,
  projectPhysicalRoot,
  projectTarget,
  source,
  url,
  blockers,
}) {
  const absoluteTarget = path.resolve(projectRoot, projectTarget);
  let physicalTarget;
  try {
    physicalTarget = realpathSync(absoluteTarget);
  } catch {
    blockers.push(
      finding(
        "broken-project-link",
        source,
        "Project-local link target does not exist: " + url,
      ),
    );
    return false;
  }
  if (!isContainedPath(projectPhysicalRoot, physicalTarget)) {
    blockers.push(
      finding(
        "link-escapes-project",
        source,
        "Project-local link resolves outside the project: " + url,
      ),
    );
    return false;
  }
  return true;
}

function rewriteDestination({
  raw,
  source,
  target,
  projectRoot,
  projectPhysicalRoot,
  inventory,
  moveMap,
  blockers,
  warnings,
  linkRewrites,
  allowBrokenLocalLinks = false,
}) {
  const parsed = splitDestination(raw);
  if (!parsed || isExternalTarget(parsed.url)) return raw;
  const { pathname, suffix } = urlParts(parsed.url);
  if (pathname === "") return raw;
  const oldTarget = path.posix.normalize(path.posix.join(path.posix.dirname(source), pathname));
  if (oldTarget === ".." || oldTarget.startsWith("../")) {
    const projectTarget = path.posix.normalize(
      path.posix.join(".catpaw", path.posix.dirname(source), pathname),
    );
    if (projectTarget === ".." || projectTarget.startsWith("../")) {
      blockers.push(
        finding(
          "link-escapes-project",
          source,
          `Local link escapes the project: ${parsed.url}`,
        ),
      );
      return raw;
    }
    if (!validateProjectLink({
      projectRoot,
      projectPhysicalRoot,
      projectTarget,
      source,
      url: parsed.url,
      blockers,
    })) {
      return raw;
    }
    const targetProjectDirectory = path.posix.normalize(
      path.posix.join(".catpaw", path.posix.dirname(target)),
    );
    let relative = path.posix.relative(targetProjectDirectory, projectTarget);
    if (relative === "") relative = path.posix.basename(projectTarget);
    const nextUrl = `${relative}${suffix}`;
    if (nextUrl !== parsed.url) {
      linkRewrites.push({
        from: source,
        to: target,
        oldTarget: parsed.url,
        newTarget: nextUrl,
      });
    }
    const renderedUrl = parsed.angled ? `<${nextUrl}>` : nextUrl;
    return `${parsed.leading}${renderedUrl}${parsed.suffix}${parsed.trailing}`;
  }
  if (!inventory.has(oldTarget)) {
    const unresolved = allowBrokenLocalLinks ? warning : finding;
    const destination = allowBrokenLocalLinks ? warnings : blockers;
    destination.push(
      unresolved(
        "broken-local-link",
        source,
        allowBrokenLocalLinks
          ? `Preserved unresolved historical local link target: ${parsed.url}`
          : `Local link target does not exist: ${parsed.url}`,
      ),
    );
    return raw;
  }
  const mappedTarget = moveMap.get(oldTarget) ?? oldTarget;
  let relative = path.posix.relative(path.posix.dirname(target), mappedTarget);
  if (relative === "") relative = path.posix.basename(mappedTarget);
  const nextUrl = `${relative}${suffix}`;
  if (nextUrl !== parsed.url) {
    linkRewrites.push({
      from: source,
      to: target,
      oldTarget: parsed.url,
      newTarget: nextUrl,
    });
  }
  const renderedUrl = parsed.angled ? `<${nextUrl}>` : nextUrl;
  return `${parsed.leading}${renderedUrl}${parsed.suffix}${parsed.trailing}`;
}

function rewriteMarkdownLinks(context, text) {
  const lines = text.split("\n");
  let fence = null;
  return lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const token = fenceMatch[1];
      if (fence === null) {
        fence = { character: token[0], length: token.length };
      } else if (
        fence.character === token[0] &&
        token.length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = null;
      }
      return line;
    }
    if (fence !== null) return line;

    return mapOutsideCodeSpans(line, (segment) => {
      let rewritten = rewriteInlineLinkDestinations(
        segment,
        (destination) =>
          rewriteDestination({ ...context, raw: destination }),
      );
      rewritten = rewritten.replace(
        /^(\s*\[[^\]]+]:\s*)(\S+)(.*)$/,
        (whole, start, destination, end) =>
          `${start}${rewriteDestination({ ...context, raw: destination })}${end}`,
      );
      return rewritten;
    });
  }).join("\n");
}

function closingLinkParen(text, start) {
  let depth = 1;
  let quote = null;
  let angled = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (angled) {
      if (character === ">") angled = false;
      continue;
    }
    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "<" && text.slice(start, index).trim() === "") {
      angled = true;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function rewriteInlineLinkDestinations(segment, rewrite) {
  const output = [];
  let cursor = 0;
  let searchFrom = 0;
  while (searchFrom < segment.length) {
    const marker = segment.indexOf("](", searchFrom);
    if (marker === -1) break;
    const labelStart = segment.lastIndexOf("[", marker);
    if (labelStart === -1) {
      searchFrom = marker + 2;
      continue;
    }
    const destinationStart = marker + 2;
    const close = closingLinkParen(segment, destinationStart);
    if (close === -1) break;
    output.push(
      segment.slice(cursor, destinationStart),
      rewrite(segment.slice(destinationStart, close)),
      ")",
    );
    cursor = close + 1;
    searchFrom = cursor;
  }
  output.push(segment.slice(cursor));
  return output.join("");
}

function backtickRunLength(text, start) {
  let end = start;
  while (text[end] === "`") end += 1;
  return end - start;
}

function matchingBacktickRun(text, start, length) {
  for (let index = start; index < text.length;) {
    if (text[index] !== "`") {
      index += 1;
      continue;
    }
    const runLength = backtickRunLength(text, index);
    if (runLength === length) return index;
    index += runLength;
  }
  return -1;
}

function mapOutsideCodeSpans(line, transform) {
  const output = [];
  let plainStart = 0;
  let cursor = 0;
  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const runLength = backtickRunLength(line, cursor);
    const close = matchingBacktickRun(line, cursor + runLength, runLength);
    if (close === -1) {
      cursor += runLength;
      continue;
    }
    output.push(transform(line.slice(plainStart, cursor)));
    const codeEnd = close + runLength;
    output.push(line.slice(cursor, codeEnd));
    cursor = codeEnd;
    plainStart = codeEnd;
  }
  output.push(transform(line.slice(plainStart)));
  return output.join("");
}

function knownSource(relativePath) {
  return (
    relativePath === "index.md" ||
    relativePath === "lessons.md" ||
    /^reqs\/[^/]+\.md$/.test(relativePath) ||
    /^plans\/(?:active|archive)\/[^/]+\.md$/.test(relativePath) ||
    /^milestones\/[^/]+\.md$/.test(relativePath) ||
    /^tests\/matrices\/[^/]+\.md$/.test(relativePath) ||
    /^reviews\/.+\.md$/.test(relativePath) ||
    /^research\/.+\.md$/.test(relativePath)
  );
}

function knownDirectory(relativePath) {
  return new Set([
    "",
    ...LEGACY_ROOTS,
    "plans/active",
    "plans/archive",
    "tests/matrices",
    "evidence/topics",
  ]).has(relativePath);
}

function operationSort(left, right) {
  const phases = new Map([
    ["ensure-dir", 0],
    ["move-file", 1],
    ["write-file", 2],
    ["remove-file", 3],
    ["remove-symlink", 3],
    ["remove-dir", 4],
  ]);
  const phase = phases.get(left.type) - phases.get(right.type);
  if (phase !== 0) return phase;
  if (left.type === "remove-dir") {
    const depth = right.path.split("/").length - left.path.split("/").length;
    if (depth !== 0) return depth;
  }
  return compareText(left.path ?? left.from ?? "", right.path ?? right.from ?? "");
}

function baseReport(fromSchema) {
  return {
    status: "ready",
    fromSchema,
    toSchema: 2,
    operations: [],
    mappings: [],
    blockers: [],
    warnings: [],
    preservedLegacy: [],
    preservedUnknown: [],
    linkRewrites: [],
  };
}

export async function analyzeV1ToV2Migration({
  projectRoot = process.cwd(),
  boardPath = path.join(projectRoot, ".catpaw"),
  migrationDate = null,
} = {}) {
  const root = path.resolve(boardPath);
  const projectRootPath = path.resolve(projectRoot);
  const report = baseReport(null);
  let inventory;
  try {
    inventory = await inventoryTree(root);
  } catch (error) {
    report.status = "blocked";
    report.blockers = [finding("invalid-board-root", ".", error.message)];
    return report;
  }
  let projectPhysicalRoot;
  try {
    projectPhysicalRoot = realpathSync(projectRootPath);
  } catch (error) {
    report.status = "blocked";
    report.blockers = [finding("invalid-project-root", ".", error.message)];
    return report;
  }

  const indexEntry = inventory.get("index.md");
  if (indexEntry?.type !== "file") {
    report.status = "blocked";
    report.blockers = [finding("missing-index", "index.md", "Board index.md is missing.")];
    return report;
  }
  const knownBytes = new Map();
  const knownMarkdown = new Map();
  const indexBytes = await readFile(path.join(root, "index.md"));
  knownBytes.set("index.md", indexBytes);
  const indexText = decodeKnownMarkdown(
    indexBytes,
    "index.md",
    report.blockers,
  );
  if (indexText === null) {
    report.status = "blocked";
    report.blockers.sort(reportSort);
    return report;
  }
  knownMarkdown.set("index.md", indexText);
  const indexParsed = parseText(indexText, "index.md", report.blockers);
  if (!indexParsed) {
    report.status = "blocked";
    report.blockers.sort(reportSort);
    return report;
  }
  const declaredSchema = Object.hasOwn(indexParsed.data, "schema")
    ? indexParsed.data.schema
    : 1;
  report.fromSchema = declaredSchema;
  if (declaredSchema === 2) {
    return {
      status: "noop",
      fromSchema: 2,
      toSchema: 2,
      operations: [],
      mappings: [],
      blockers: [],
      warnings: [],
      preservedLegacy: [],
      preservedUnknown: [],
      linkRewrites: [],
    };
  }
  if (declaredSchema !== 1) {
    report.status = "blocked";
    report.blockers.push(
      finding("unsupported-board-schema", "index.md", `Unsupported board schema: ${declaredSchema}`),
    );
    return report;
  }

  const knownPaths = [...inventory.entries()]
    .filter(([relativePath, entry]) =>
      relativePath !== "index.md" &&
      entry.type === "file" &&
      knownSource(relativePath)
    )
    .map(([relativePath]) => relativePath)
    .sort(compareText);
  for (const relativePath of knownPaths) {
    const bytes = await readFile(path.join(root, relativePath));
    knownBytes.set(relativePath, bytes);
    const text = decodeKnownMarkdown(
      bytes,
      relativePath,
      report.blockers,
    );
    if (text !== null) knownMarkdown.set(relativePath, text);
  }
  if (report.blockers.length > 0) {
    report.status = "blocked";
    report.blockers.sort(reportSort);
    return report;
  }

  for (const [relativePath, entry] of inventory) {
    if (
      entry.type === "symlink" &&
      isLegacySourcePath(relativePath) &&
      entry.target === null
    ) {
      report.blockers.push(
        finding(
          "non-utf8-symlink-target",
          relativePath,
          "Legacy symlink target is not valid UTF-8 and cannot be archived losslessly.",
        ),
      );
    }
    if (entry.type === "special" || (
      entry.type === "symlink" && !isLegacySourcePath(relativePath)
    )) {
      report.blockers.push(
        finding(
          "unsupported-board-entry",
          relativePath || ".",
          `Migration does not follow ${entry.type} entries.`,
        ),
      );
    }
    if (entry.type === "file" && !knownSource(relativePath)) {
      report.preservedUnknown.push(relativePath);
    } else if (
      entry.type === "directory" &&
      entry.empty &&
      !knownDirectory(relativePath)
    ) {
      report.preservedUnknown.push(`${relativePath}/`);
    }
  }

  const candidates = [];
  const moveMap = new Map();
  const targetOwners = new Map();
  const workById = new Map();
  const workIdSources = new Map();
  const milestoneIdSources = new Map();

  function registerCandidate(candidate) {
    candidates.push(candidate);
  }

  function registerCandidateTarget(candidate) {
    report.mappings.push({
      kind: candidate.kind,
      from: candidate.source,
      to: candidate.target,
      ...(candidate.id ? { id: candidate.id } : {}),
    });
    moveMap.set(candidate.source, candidate.target);
    const owner = targetOwners.get(candidate.target);
    if (owner && owner.source !== candidate.source) {
      const code = candidate.kind === "plan" && owner.kind === "plan"
        ? "plan-target-collision"
        : candidate.artifactKind === "evidence" && owner.artifactKind === "evidence"
          ? "evidence-target-collision"
          : "migration-target-collision";
      report.blockers.push(
        finding(
          code,
          candidate.target,
          `Multiple sources map to ${candidate.target}: ${owner.source}, ${candidate.source}`,
        ),
      );
    } else {
      targetOwners.set(candidate.target, candidate);
    }
    if (
      candidate.target !== candidate.source &&
      inventory.has(candidate.target)
    ) {
      report.blockers.push(
        finding(
          "migration-target-occupied",
          candidate.target,
          `Migration target already exists: ${candidate.target}`,
        ),
      );
    }
  }

  const workPaths = [...inventory.keys()]
    .filter((item) => /^reqs\/[^/]+\.md$/.test(item))
    .sort(compareText);
  const planPaths = [...inventory.keys()]
    .filter((item) => /^plans\/(?:active|archive)\/[^/]+\.md$/.test(item))
    .sort(compareText);
  const milestonePaths = [...inventory.keys()]
    .filter((item) => /^milestones\/[^/]+\.md$/.test(item))
    .sort(compareText);
  const parsedCache = new Map();
  for (const [relativePath, text] of knownMarkdown) {
    if (relativePath === "index.md" || relativePath === "lessons.md") continue;
    parsedCache.set(relativePath, parseLegacyArtifact(text, relativePath, report));
  }
  function parsedFile(relativePath) {
    const cached = parsedCache.get(relativePath);
    return cached ?? null;
  }
  const inferenceDate = migrationDateFrom(migrationDate, knownMarkdown);

  const testPaths = [...inventory.keys()]
    .filter((item) => /^tests\/matrices\/[^/]+\.md$/.test(item))
    .sort(compareText);
  const reviewPaths = [...inventory.keys()]
    .filter((item) => /^reviews\/.+\.md$/.test(item))
    .sort(compareText);
  const researchPaths = [...inventory.keys()]
    .filter((item) => /^research\/.+\.md$/.test(item))
    .sort(compareText);
  function boundWorkIds(paths, artifactKind) {
    const ids = new Set();
    for (const source of paths) {
      const parsed = parsedFile(source);
      if (!parsed) continue;
      const binding = normalizedBinding(parsed.data, source, artifactKind);
      if (!binding.error && binding.value !== null) ids.add(binding.value);
    }
    return ids;
  }
  const planWorkIds = boundWorkIds(planPaths, "plan");
  const activePlanPathIds = boundWorkIds(
    planPaths.filter((item) => item.startsWith("plans/active/")),
    "plan",
  );
  const testWorkIds = boundWorkIds(testPaths, "evidence");
  const reviewWorkIds = boundWorkIds(reviewPaths, "evidence");
  const planStatusesByWork = new Map();
  for (const source of planPaths) {
    const parsed = parsedFile(source);
    if (!parsed) continue;
    const binding = normalizedBinding(parsed.data, source, "plan");
    const status = artifactStatus(parsed.data, parsed.body);
    if (binding.error || binding.value === null || status === null) continue;
    const statuses = planStatusesByWork.get(binding.value) ?? new Set();
    statuses.add(status);
    planStatusesByWork.set(binding.value, statuses);
  }
  const completedTestWorkIds = new Set();
  for (const source of testPaths) {
    const parsed = parsedFile(source);
    if (!parsed || !hasCompletedTestSignal(parsed.data, parsed.body)) continue;
    const binding = normalizedBinding(parsed.data, source, "evidence");
    if (!binding.error && binding.value !== null) completedTestWorkIds.add(binding.value);
  }

  const activeIndexWorkIds = sectionIds(indexParsed.body, "Active Work");
  const activeIndexMilestoneIds = milestoneSectionIds(indexParsed.body);
  const activePlanWorkIds = new Set();
  for (const source of planPaths.filter((item) => item.startsWith("plans/active/"))) {
    const parsed = parsedFile(source);
    if (!parsed) continue;
    const binding = normalizedBinding(parsed.data, source, "plan");
    if (binding.value) activePlanWorkIds.add(binding.value);
  }
  const activeMilestoneWorkIds = new Set();
  const inferredMilestones = [];
  const inferredMilestoneBySource = new Map();
  for (const source of milestonePaths) {
    const parsed = parsedFile(source);
    if (!parsed) continue;
    const sourceId = canonicalMilestoneId(source);
    const explicitId = canonicalMilestoneId(parsed.data.id);
    const id = explicitId ?? sourceId;
    const status = normalizedMilestoneStatus(parsed.data.status) ??
      statusNearId(indexParsed.body, id) ??
      statusFromText(sectionText(parsed.body, ["status", "状态"])) ??
      "blocked";
    let workIds;
    if (hasMilestoneScopeMarkers(parsed.body)) {
      try {
        workIds = new Set(parseMilestoneScope(parsed.body).rows.map((row) => row.id));
      } catch (error) {
        report.blockers.push(
          finding("malformed-milestone-scope", source, error.message),
        );
        workIds = new Set();
      }
    } else {
      workIds = milestoneWorkIds(parsed.body);
    }
    const inferred = { source, parsed, sourceId, explicitId, id, status, workIds };
    inferredMilestones.push(inferred);
    inferredMilestoneBySource.set(source, inferred);
    const routedActive =
      (sourceId !== null && activeIndexMilestoneIds.has(sourceId)) ||
      (explicitId !== null && activeIndexMilestoneIds.has(explicitId));
    if (!routedActive && !ACTIVE_STATUSES.has(status)) continue;
    for (const workId of workIds) {
      activeMilestoneWorkIds.add(workId);
    }
  }
  inferredMilestones.sort((left, right) => compareText(left.id ?? "", right.id ?? ""));
  const milestoneStatusesByWork = new Map();
  for (const milestone of inferredMilestones) {
    for (const id of milestone.workIds) {
      const status = statusNearId(milestone.parsed.body, id) ?? milestone.status;
      const statuses = milestoneStatusesByWork.get(id) ?? new Set();
      statuses.add(status);
      milestoneStatusesByWork.set(id, statuses);
    }
  }
  const blockedActiveWorkIds = new Set();

  function markBlockedWork(...ids) {
    for (const id of ids) {
      if (typeof id === "string" && WORK_ID_PATTERN.test(id)) {
        blockedActiveWorkIds.add(id);
      }
    }
  }

  for (const source of workPaths) {
    const sourceId = canonicalWorkId(source);
    const parsed = parsedFile(source);
    const sourceRoutedActive = sourceId !== null &&
      (
        activeIndexWorkIds.has(sourceId) ||
        activePlanWorkIds.has(sourceId)
      );
    const sourceDependency = sourceId !== null &&
      activeMilestoneWorkIds.has(sourceId);
    if (!parsed) continue;
    const data = parsed.data;
    if (
      Object.hasOwn(data, "id") &&
      data.id !== null &&
      canonicalWorkId(data.id) === null
    ) {
      report.blockers.push(
        finding(
          "invalid-legacy-identity",
          source,
          `Invalid explicit Work ID: ${String(data.id)}.`,
        ),
      );
      continue;
    }
    const explicitId = canonicalWorkId(data.id);
    const headingId = workIdFromHeading(parsed.body);
    const identityIds = new Set([explicitId, sourceId, headingId].filter(Boolean));
    const id = inferredWorkId(data, source, parsed.body);
    const activeSignal = id !== null &&
      (
        activeIndexWorkIds.has(id) ||
        activePlanWorkIds.has(id)
      );
    const dependencySignal = id !== null && activeMilestoneWorkIds.has(id);
    const routedActive = sourceRoutedActive || activeSignal;
    const required = routedActive || sourceDependency || dependencySignal;
    const explicitStatus = normalizedWorkStatus(data.status, activeSignal);
    const bodyStatus = statusFromText(sectionText(parsed.body, ["status", "状态"]));
    const indexStatus = id === null ? null : statusNearId(indexParsed.body, id);
    const milestoneStatuses = id === null
      ? new Set()
      : milestoneStatusesByWork.get(id) ?? new Set();
    const milestoneStatus = ["blocked", "active", "cancelled", "done"]
      .find((item) => milestoneStatuses.has(item)) ?? null;
    const planStatuses = id === null
      ? new Set()
      : planStatusesByWork.get(id) ?? new Set();
    const artifactGraphStatus = planStatuses.has("cancelled")
      ? "cancelled"
      : planStatuses.has("done") && completedTestWorkIds.has(id)
        ? "done"
        : null;
    const graphStatus = id !== null && activePlanPathIds.has(id) ? "active" : null;
    const status = explicitStatus ??
      (TERMINAL_STATUSES.has(bodyStatus) ? bodyStatus : null) ??
      (TERMINAL_STATUSES.has(indexStatus) ? indexStatus : null) ??
      bodyStatus ??
      indexStatus ??
      milestoneStatus ??
      artifactGraphStatus ??
      graphStatus ??
      (required ? "active" : "blocked");
    if (identityIds.size > 1) {
      markBlockedWork(...identityIds);
      report.blockers.push(
        finding(
          "work-identity-conflict",
          source,
          `Work Item identity conflicts across metadata, filename, or heading: ${[...identityIds].join(", ")}.`,
        ),
      );
      continue;
    }
    if (milestoneStatuses.size > 1) {
      report.warnings.push(
        warning(
          "conflicting-milestone-status",
          source,
          `Milestones disagree on ${id} status (${[...milestoneStatuses].sort(compareText).join(", ")}); inferred ${milestoneStatus} conservatively.`,
        ),
      );
    }
    if (routedActive && TERMINAL_STATUSES.has(status)) {
      report.warnings.push(
        warning(
          "stale-active-routing",
          source,
          `Ignored stale schema 1 active routing because Work Item ${id} resolves to ${status}.`,
        ),
      );
    }
    const type = workType(id);
    const mode = inferredMode(data, status);
    const stage = inferredStage(data, status, {
      hasPlan: id !== null && planWorkIds.has(id),
      hasTest: id !== null && testWorkIds.has(id),
      hasReview: id !== null && reviewWorkIds.has(id),
    });
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::|\\s+-)?\\s*`),
    ]) ?? titleFromPath(source, id);
    const dates = artifactDates(data, parsed.body, status, inferenceDate);
    const metadata = {
      id,
      type,
      mode,
      status,
      stage,
      ...dates,
    };
    const invalidFields = metadataIssueFields("workItem", metadata);
    const fields = [...new Set(invalidFields)].sort(compareText);
    if (fields.length > 0) {
      markBlockedWork(sourceId, id);
      report.blockers.push(
        finding(
          "invalid-inferred-work-metadata",
          source,
          `Could not produce valid Work metadata after inference: ${fields.join(", ")}.`,
        ),
      );
      continue;
    }
    if (workIdSources.has(id)) {
      report.blockers.push(
        finding(
          "duplicate-work-id",
          source,
          `Work Item ${id} also appears at ${workIdSources.get(id)}.`,
        ),
      );
      continue;
    }
    workIdSources.set(id, source);
    const inferredFields = [
      ...(data.id !== id ? ["id"] : []),
      ...(data.type !== type ? ["type"] : []),
      ...(data.mode !== mode && !["L2", "L3"].includes(data.level) ? ["mode"] : []),
      ...(explicitStatus === null ? ["status"] : []),
      ...(!WORK_STAGES.has(data.stage) ? ["stage"] : []),
      ...(!isCalendarDate(data.created) ? ["created"] : []),
      ...(!isCalendarDate(data.updated) ? ["updated"] : []),
      ...(TERMINAL_STATUSES.has(status) && !isCalendarDate(data.closed) ? ["closed"] : []),
    ];
    if (inferredFields.length > 0) {
      report.warnings.push(inferredWarning(source, inferredFields));
    }
    if (data.id !== undefined && data.id !== id) {
      report.warnings.push(
        warning("normalized-work-id", source, `Normalized Work ID ${data.id ?? "<missing>"} -> ${id}.`),
      );
    }
    if (data.type !== undefined && data.type !== type) {
      report.warnings.push(
        warning("normalized-work-type", source, `Normalized Work type ${data.type ?? "<missing>"} -> ${type} from ${id}.`),
      );
    }
    if (data.status !== undefined && data.status !== status) {
      report.warnings.push(
        warning("normalized-work-status", source, `Normalized Work status ${data.status ?? "<missing>"} -> ${status}.`),
      );
    }
    if (data.stage !== undefined && data.stage !== stage) {
      report.warnings.push(
        warning("normalized-work-stage", source, `Normalized Work stage ${data.stage ?? "<missing>"} -> ${stage}.`),
      );
    }
    if (Object.hasOwn(data, "priority")) {
      report.warnings.push(
        finding("dropped-field", source, "Dropped schema 1 field: priority."),
      );
    }
    const target = `work/${path.posix.basename(source)}`;
    const work = {
      kind: "work",
      artifactKind: "workItem",
      source,
      target,
      id,
      title,
      metadata,
      body: parsed.body,
      required,
    };
    if (typeof id === "string" && !workById.has(id)) workById.set(id, work);
    registerCandidate(work);
  }

  for (const source of planPaths) {
    const parsed = parsedFile(source);
    if (!parsed) {
      continue;
    }
    const binding = normalizedBinding(parsed.data, source, "plan");
    if (binding.error) {
      report.blockers.push(
        finding(
          binding.code ?? "conflicting-plan-work",
          source,
          binding.error,
        ),
      );
      continue;
    }
    const work = binding.value;
    if (work === null || !workById.has(work)) {
      report.blockers.push(
        finding(
          "plan-work-unresolved",
          source,
          "Plan identity could not be bound to a migrated Work Item.",
        ),
      );
      continue;
    }
    const updated = artifactDates(parsed.data, parsed.body, "active", inferenceDate).updated;
    const metadata = { work, updated };
    const fields = metadataIssueFields("plan", metadata);
    const invalidFields = [...new Set(fields)].sort(compareText);
    if (invalidFields.length > 0) {
      report.blockers.push(
        finding(
          "invalid-inferred-plan-metadata",
          source,
          `Could not produce valid Plan metadata after inference: ${invalidFields.join(", ")}.`,
        ),
      );
      continue;
    }
    if (work !== null && blockedActiveWorkIds.has(work)) continue;
    const inferredFields = [
      ...(binding.inferredFields ?? []),
      ...(!isCalendarDate(parsed.data.updated) ? ["updated"] : []),
    ];
    if (inferredFields.length > 0) {
      report.warnings.push(inferredWarning(source, inferredFields));
    }
    if (binding.normalized) {
      report.warnings.push(
        warning(
          "normalized-plan-binding",
          source,
          `Normalized legacy Plan binding to ${work}.`,
        ),
      );
    }
    for (const field of ["status", "closed"]) {
      if (Object.hasOwn(parsed.data, field)) {
        report.warnings.push(
          finding("dropped-field", source, `Dropped schema 1 Plan field: ${field}.`),
        );
      }
    }
    registerCandidate({
      kind: "plan",
      artifactKind: "plan",
      source,
      target: `plans/${path.posix.basename(source)}`,
      id: typeof work === "string" ? work : null,
      metadata,
      body: parsed.body,
    });
  }

  for (const source of milestonePaths) {
    const sourceId = canonicalMilestoneId(source);
    const parsed = parsedFile(source);
    const sourceActive = sourceId !== null && activeIndexMilestoneIds.has(sourceId);
    if (!parsed) continue;

    if (
      Object.hasOwn(parsed.data, "id") &&
      parsed.data.id !== null &&
      canonicalMilestoneId(parsed.data.id) === null
    ) {
      report.blockers.push(
        finding(
          "invalid-legacy-identity",
          source,
          `Invalid explicit Milestone ID: ${String(parsed.data.id)}.`,
        ),
      );
      continue;
    }

    const explicitId = canonicalMilestoneId(parsed.data.id);
    const headingToken = String(parsed.body ?? "")
      .match(/^#\s+.*?\b((?:MS-|M)\d+)\b/im)?.[1] ?? null;
    const headingId = canonicalMilestoneId(headingToken);
    const identityIds = new Set([explicitId, sourceId, headingId].filter(Boolean));
    const id = inferredMilestoneId(parsed.data, source, parsed.body);
    const activeSignal = activeIndexMilestoneIds.has(id);
    const explicitStatus = normalizedMilestoneStatus(parsed.data.status);
    const status = explicitStatus ??
      statusNearId(indexParsed.body, id) ??
      statusFromText(sectionText(parsed.body, ["status", "状态"])) ??
      "blocked";
    const routedActive = sourceActive || activeSignal;

    if (identityIds.size > 1) {
      report.blockers.push(
        finding(
          "milestone-identity-conflict",
          source,
          `Milestone identity conflicts across metadata, filename, or heading: ${[...identityIds].join(", ")}.`,
        ),
      );
      continue;
    }
    if (routedActive && TERMINAL_STATUSES.has(status)) {
      report.warnings.push(
        warning(
          "stale-active-routing",
          source,
          `Ignored stale schema 1 active routing because Milestone ${id} resolves to ${status}.`,
        ),
      );
    }

    const dates = artifactDates(parsed.data, parsed.body, status, inferenceDate);
    const metadata = {
      id,
      status,
      ...dates,
      target: parsed.data.target ?? null,
    };
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`),
    ]) ?? titleFromPath(source, id);
    const invalidFields = metadataIssueFields("milestone", metadata);
    if (invalidFields.length > 0) {
      report.blockers.push(
        finding(
          "invalid-inferred-milestone-metadata",
          source,
          `Could not produce valid Milestone metadata after inference: ${invalidFields.join(", ")}.`,
        ),
      );
      continue;
    }
    if (milestoneIdSources.has(id)) {
      report.blockers.push(
        finding(
          "duplicate-milestone-id",
          source,
          `Milestone ${id} also appears at ${milestoneIdSources.get(id)}.`,
        ),
      );
      continue;
    }

    const scopeIds = inferredMilestoneBySource.get(source)?.workIds ?? new Set();
    const unresolvedScopeIds = [...scopeIds].filter((workId) => !workById.has(workId));
    if (unresolvedScopeIds.length > 0) {
      report.warnings.push(
        warning(
          "unresolved-milestone-reference",
          source,
          `Preserved unresolved historical Work references outside managed Scope: ${unresolvedScopeIds.join(", ")}.`,
        ),
      );
    }
    const inferredFields = [
      ...(parsed.data.id !== id ? ["id"] : []),
      ...(explicitStatus === null ? ["status"] : []),
      ...(!isCalendarDate(parsed.data.created) ? ["created"] : []),
      ...(!isCalendarDate(parsed.data.updated) ? ["updated"] : []),
      ...(TERMINAL_STATUSES.has(status) && !isCalendarDate(parsed.data.closed) ? ["closed"] : []),
      ...(!Object.hasOwn(parsed.data, "target") ? ["target"] : []),
      ...(scopeIds.size > 0 ? ["scope"] : []),
    ];
    if (inferredFields.length > 0) {
      report.warnings.push(inferredWarning(source, inferredFields));
    }

    milestoneIdSources.set(id, source);
    registerCandidate({
      kind: "milestone",
      artifactKind: "milestone",
      source,
      target: source,
      id: metadata.id,
      title,
      metadata,
      body: appendManagedScope(parsed.body, scopeIds, workById),
    });
  }

  const evidenceTargets = new Set();

  async function addEvidence(source, type, stage, bindingRequired) {
    const parsed = parsedFile(source);
    if (!parsed) return;
    const binding = normalizedBinding(parsed.data, source, "evidence");
    if (binding.error) {
      report.blockers.push(
        finding(binding.code ?? "conflicting-evidence-work", source, binding.error),
      );
      return;
    }
    const unresolvedWork = binding.value !== null && !workById.has(binding.value)
      ? binding.value
      : null;
    const work = unresolvedWork === null ? binding.value : null;
    const title = headingTitle(parsed.body, [
      /^Test Matrix:\s*/i,
      /^Review:\s*/i,
      /^Provider Dialogue:\s*/i,
    ]) ?? titleFromPath(source, work);
    const requestedIndependent = parsed.data.independent === true;
    const agent = typeof parsed.data.agent === "string" && parsed.data.agent.trim() !== ""
      ? parsed.data.agent
      : null;
    const independent = requestedIndependent && agent !== null;
    const lens = [
      "value-scope",
      "system-contracts",
      "experience",
      "security",
      "performance",
    ].includes(parsed.data.lens)
      ? parsed.data.lens
      : null;
    const dates = artifactDates(parsed.data, parsed.body, "active", inferenceDate);
    const metadata = {
      type,
      work,
      stage,
      created: dates.created,
      updated: dates.updated,
      independent,
      agent,
      lens,
    };
    const fields = metadataIssueFields("evidence", metadata);
    if (fields.length > 0) {
      report.blockers.push(
        finding(
          "invalid-inferred-evidence-metadata",
          source,
          `Could not produce valid Evidence metadata after inference: ${fields.join(", ")}.`,
        ),
      );
      return;
    }
    const inferredFields = [
      ...(binding.inferredFields ?? []),
      ...(unresolvedWork !== null || (bindingRequired && work === null) ? ["work"] : []),
      ...(!isCalendarDate(parsed.data.created) ? ["created"] : []),
      ...(!isCalendarDate(parsed.data.updated) ? ["updated"] : []),
      ...(!Object.hasOwn(parsed.data, "independent") ||
          typeof parsed.data.independent !== "boolean" ||
          requestedIndependent !== independent
        ? ["independent"]
        : []),
      ...(requestedIndependent && agent === null ? ["agent"] : []),
      ...(parsed.data.lens !== undefined && parsed.data.lens !== lens ? ["lens"] : []),
    ];
    if (inferredFields.length > 0) {
      const detail = unresolvedWork === null
        ? ""
        : `Unresolved binding ${unresolvedWork} was retained as topic Evidence.`;
      report.warnings.push(inferredWarning(source, inferredFields, detail));
    }
    if (binding.normalized) {
      report.warnings.push(
        warning(
          "normalized-evidence-binding",
          source,
          `Normalized legacy Evidence binding to ${work}.`,
        ),
      );
    }
    const directory = work === null ? "evidence/topics" : `evidence/${work}`;
    const baseTarget = `${directory}/${dates.created}-${type}-${asciiSlug(title)}.md`;
    const target = evidenceTargets.has(baseTarget)
      ? baseTarget.replace(/\.md$/, `-${sha256(source).slice(0, 8)}.md`)
      : baseTarget;
    evidenceTargets.add(target);
    const known = new Set(["work", "req", "created", "updated", "independent", "agent", "lens"]);
    const dropped = Object.keys(parsed.data).filter((field) => !known.has(field));
    if (dropped.length > 0) {
      report.warnings.push(
        finding("dropped-field", source, `Dropped schema 1 Evidence fields: ${dropped.sort(compareText).join(", ")}.`),
      );
    }
    registerCandidate({
      kind: type,
      artifactKind: "evidence",
      source,
      target,
      id: typeof work === "string" ? work : null,
      title,
      metadata,
      body: parsed.body,
    });
  }

  for (const source of testPaths) await addEvidence(source, "test", "test", true);

  for (const source of reviewPaths) await addEvidence(source, "review", "review", true);

  for (const source of researchPaths) {
    const provider = path.posix.basename(source) === "provider-dialogue.md";
    await addEvidence(source, provider ? "provider" : "research", provider ? "review" : "think", false);
  }

  const evidence = candidates
    .filter((item) => item.artifactKind === "evidence")
    .map((item) => ({ ...item.metadata, path: item.target, body: item.body }));
  for (const work of candidates.filter((item) => item.artifactKind === "workItem")) {
    if (work.metadata.mode !== "gated" || work.metadata.status !== "done") continue;
    const state = completionEvidenceState({ evidence }, work.id);
    if (state.missing.length === 0 || state.acceptedGap) continue;
    const date = work.metadata.closed ?? work.metadata.updated;
    const target = `evidence/${work.id}/${date}-reflection-accepted-gap.md`;
    const body = [
      "# Legacy migration completion Evidence gap",
      "",
      "## Record",
      "",
      "Accepted reason: Zero-touch migration preserves the schema 1 terminal status; historical completion gates were unavailable.",
      "Missing gates:",
      ...state.missing.map((item) => `- ${item}`),
      "",
    ].join("\n");
    const metadata = {
      type: "reflection",
      work: work.id,
      stage: "reflect",
      created: date,
      updated: date,
      independent: false,
      agent: null,
      lens: null,
    };
    registerCandidate({
      kind: "reflection",
      artifactKind: "evidence",
      source: `generated/accepted-gap/${work.id}.md`,
      target,
      id: work.id,
      title: "Legacy migration completion Evidence gap",
      metadata,
      body,
      generated: true,
    });
    report.warnings.push(
      warning(
        "inferred-completion-gap",
        work.source,
        `Recorded an accepted migration gap for historical Gated Work ${work.id}: ${state.missing.join(", ")}.`,
      ),
    );
  }

  for (const candidate of candidates) registerCandidateTarget(candidate);

  if (
    inventory.has(LEGACY_ARCHIVE_ROOT) ||
    [...inventory.keys()].some((item) => item.startsWith(`${LEGACY_ARCHIVE_ROOT}/`))
  ) {
    report.blockers.push(
      finding(
        "legacy-archive-occupied",
        LEGACY_ARCHIVE_ROOT,
        `Migration archive target already exists: ${LEGACY_ARCHIVE_ROOT}.`,
      ),
    );
  }

  const candidateBySource = new Map(candidates.map((item) => [item.source, item]));
  const candidateSources = new Set(candidateBySource.keys());
  const legacyArchiveContent = new Map();
  const legacyFiles = [...inventory.entries()]
    .filter(([relativePath, entry]) =>
      relativePath !== "" && entry.type === "file" && isLegacySourcePath(relativePath)
    )
    .map(([relativePath]) => relativePath)
    .sort(compareText);
  for (const source of legacyFiles) {
    const bytes = knownBytes.get(source) ?? await readFile(path.join(root, source));
    const target = `${LEGACY_ARCHIVE_ROOT}/${source}`;
    report.preservedLegacy.push({
      from: source,
      to: target,
      disposition: source === "index.md" || candidateSources.has(source)
        ? "converted"
        : "preserved",
      bytes: bytes.length,
      sha256: sha256(bytes),
      mode: inventory.get(source).mode,
    });
    if (
      source === "index.md" ||
      candidateBySource.get(source)?.target === source
    ) {
      legacyArchiveContent.set(source, UTF8_ARCHIVE_DECODER.decode(bytes));
    }
    if (!candidateSources.has(source) && source !== "index.md") {
      moveMap.set(source, target);
    }
  }
  const legacyAliases = [...inventory.entries()]
    .filter(([relativePath, entry]) =>
      relativePath !== "" &&
      entry.type === "symlink" &&
      isLegacySourcePath(relativePath) &&
      entry.target !== null
    )
    .sort(([left], [right]) => compareText(left, right));
  const archiveTargets = new Set(report.preservedLegacy.map((item) => item.to));
  for (const [source, entry] of legacyAliases) {
    const target = `${LEGACY_ARCHIVE_ROOT}/${source}.symlink-target`;
    if (archiveTargets.has(target)) {
      report.blockers.push(
        finding(
          "legacy-archive-target-collision",
          target,
          `Multiple legacy entries map to archive target: ${target}`,
        ),
      );
      continue;
    }
    archiveTargets.add(target);
    const bytes = entry.targetBytes;
    report.preservedLegacy.push({
      from: source,
      to: target,
      disposition: "preserved-alias",
      sourceType: "symlink",
      linkTarget: entry.target,
      bytes: bytes.length,
      sha256: sha256(bytes),
      sourceMode: entry.mode,
      mode: 0o644,
    });
    legacyArchiveContent.set(source, entry.target);
    moveMap.set(source, target);
    report.warnings.push(
      warning(
        "preserved-symlink-alias",
        source,
        `Archived symlink target text without following or recreating the alias: ${entry.target}`,
      ),
    );
  }
  report.preservedLegacy.sort((left, right) => compareText(left.from, right.from));
  const legacyManifestContent = `${JSON.stringify({
    format: 1,
    schema: 1,
    root: LEGACY_ARCHIVE_ROOT,
    entries: report.preservedLegacy,
  }, null, 2)}\n`;
  report.preservedUnknown = report.preservedUnknown.filter((item) =>
    !isLegacySourcePath(item.replace(/\/$/, ""))
  );

  const targetDirectories = new Set(REQUIRED_DIRECTORIES);
  const targetDirectoryModes = new Map([
    [LEGACY_ARCHIVE_ROOT, inventory.get("").mode],
  ]);
  targetDirectories.add(LEGACY_ARCHIVE_ROOT);
  for (const [relativePath, entry] of inventory) {
    if (
      relativePath !== "" &&
      entry.type === "directory" &&
      isLegacySourcePath(relativePath)
    ) {
      const target = `${LEGACY_ARCHIVE_ROOT}/${relativePath}`;
      targetDirectories.add(target);
      targetDirectoryModes.set(target, entry.mode);
    }
  }
  for (const candidate of candidates) {
    let directory = path.posix.dirname(candidate.target);
    while (directory !== ".") {
      targetDirectories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  for (const directory of targetDirectories) {
    const entry = inventory.get(directory);
    if (entry && entry.type !== "directory") {
      report.blockers.push(
        finding(
          "migration-target-occupied",
          directory,
          `Required schema 2 directory is occupied by a ${entry.type}.`,
        ),
      );
    }
  }

  const preservedMarkdownRewrites = new Map();
  for (const source of report.preservedUnknown) {
    if (!source.endsWith(".md") || inventory.get(source)?.type !== "file") continue;
    const bytes = await readFile(path.join(root, source));
    let original;
    try {
      original = UTF8_DECODER.decode(bytes);
    } catch {
      report.blockers.push(
        finding(
          "non-utf8-unknown-markdown",
          source,
          "Unknown .md file is not valid UTF-8 and cannot be rewritten losslessly.",
        ),
      );
      continue;
    }
    const rewritten = rewriteMarkdownLinks(
      {
        source,
        target: source,
        projectRoot: projectRootPath,
        projectPhysicalRoot,
        inventory,
        moveMap,
        blockers: report.blockers,
        warnings: report.warnings,
        linkRewrites: report.linkRewrites,
        allowBrokenLocalLinks: true,
      },
      original,
    );
    if (rewritten !== original) preservedMarkdownRewrites.set(source, rewritten);
  }

  const rendered = new Map();
  const rewriteContext = (candidate) => ({
    source: candidate.source,
    target: candidate.target,
    projectRoot: projectRootPath,
    projectPhysicalRoot,
    inventory,
    moveMap,
    blockers: report.blockers,
    warnings: report.warnings,
    linkRewrites: report.linkRewrites,
    allowBrokenLocalLinks: ["research", "provider"].includes(candidate.kind),
  });
  for (const candidate of candidates) {
    const body = rewriteMarkdownLinks(rewriteContext(candidate), candidate.body);
    const order = candidate.artifactKind === "workItem"
      ? WORK_ORDER
      : candidate.artifactKind === "plan"
        ? PLAN_ORDER
        : candidate.artifactKind === "milestone"
          ? MILESTONE_ORDER
          : EVIDENCE_ORDER;
    try {
      rendered.set(
        candidate.source,
        `${stringifyFrontmatter(candidate.metadata, order)}${body}`,
      );
    } catch (error) {
      report.blockers.push(
        finding("invalid-generated-frontmatter", candidate.source, error.message),
      );
    }
  }

  report.mappings.push({ kind: "index", from: "index.md", to: "index.md" });
  moveMap.set("index.md", "index.md");
  const workItems = candidates
    .filter((item) => item.artifactKind === "workItem")
    .map((item) => ({ ...item.metadata, title: item.title, boardRelativePath: item.target }));
  const milestones = candidates
    .filter((item) => item.artifactKind === "milestone")
    .map((item) => ({ ...item.metadata, title: item.title, boardRelativePath: item.target }));
  const plans = candidates
    .filter((item) => item.artifactKind === "plan")
    .map((item) => ({ ...item.metadata, boardRelativePath: item.target }));
  let indexBody = indexParsed.body.trimEnd();
  if (!/^#\s+/m.test(indexBody)) indexBody = `# CatPaw Work Board\n\n${indexBody}`.trimEnd();
  indexBody = rewriteMarkdownLinks(
    {
      source: "index.md",
      target: "index.md",
      projectRoot: projectRootPath,
      projectPhysicalRoot,
      inventory,
      moveMap,
      blockers: report.blockers,
      warnings: report.warnings,
      linkRewrites: report.linkRewrites,
    },
    `${indexBody}\n`,
  );
  if (!indexBody.includes(`${LEGACY_ARCHIVE_ROOT}/manifest.json`)) {
    indexBody = [
      indexBody.trimEnd(),
      "",
      "## Legacy Material",
      "",
      `- [Schema 1 manifest](${LEGACY_ARCHIVE_ROOT}/manifest.json)`,
      "",
    ].join("\n");
  }
  let indexContent = `${stringifyFrontmatter({ schema: 2 }, ["schema"])}${indexBody}`;
  try {
    indexContent = rebuildDashboard(indexContent, { workItems, milestones, plans });
  } catch (error) {
    report.blockers.push(
      finding("invalid-dashboard-markers", "index.md", error.message),
    );
  }
  rendered.set("index.md", indexContent);

  report.blockers.sort(reportSort);
  report.warnings.sort(reportSort);
  report.mappings.sort(reportSort);
  report.preservedUnknown = [...new Set(report.preservedUnknown)].sort(compareText);
  report.linkRewrites.sort(reportSort);
  if (report.blockers.length > 0) {
    report.status = "blocked";
    report.operations = [];
    return report;
  }

  const operations = [...targetDirectories].sort(compareText).map((directory) => ({
    type: "ensure-dir",
    path: directory,
    ...(targetDirectoryModes.has(directory)
      ? { dirMode: targetDirectoryModes.get(directory) }
      : {}),
  }));
  for (const entry of report.preservedLegacy) {
    if (entry.sourceType === "symlink") {
      operations.push({
        type: "write-file",
        path: entry.to,
        content: legacyArchiveContent.get(entry.from),
        mode: "create",
        fileMode: 0o644,
      });
      continue;
    }
    const inPlaceReplacement = entry.from === "index.md" ||
      candidateBySource.get(entry.from)?.target === entry.from;
    if (inPlaceReplacement) {
      operations.push({
        type: "write-file",
        path: entry.to,
        content: legacyArchiveContent.get(entry.from),
        mode: "create",
        fileMode: entry.mode,
      });
    } else {
      operations.push({ type: "move-file", from: entry.from, to: entry.to });
    }
  }
  for (const candidate of candidates) {
    operations.push({
      type: "write-file",
      path: candidate.target,
      content: rendered.get(candidate.source),
      mode: candidate.target === candidate.source ? "replace" : "create",
      fileMode: inventory.get(candidate.source)?.mode ?? 0o644,
    });
  }
  operations.push({
    type: "write-file",
    path: `${LEGACY_ARCHIVE_ROOT}/manifest.json`,
    content: legacyManifestContent,
    mode: "create",
    fileMode: 0o644,
  });
  for (const [relativePath, content] of [...preservedMarkdownRewrites].sort(
    ([left], [right]) => compareText(left, right),
  )) {
    operations.push({
      type: "write-file",
      path: relativePath,
      content,
      mode: "replace",
      fileMode: inventory.get(relativePath).mode,
    });
  }
  operations.push({
    type: "write-file",
    path: "index.md",
    content: rendered.get("index.md"),
    mode: "replace",
    fileMode: inventory.get("index.md").mode,
  });
  for (const [relativePath] of legacyAliases) {
    operations.push({ type: "remove-symlink", path: relativePath });
  }
  for (const [relativePath, entry] of inventory) {
    if (entry.type !== "directory") continue;
    if (
      relativePath === "reqs" || relativePath.startsWith("reqs/") ||
      relativePath === "tests" || relativePath.startsWith("tests/") ||
      relativePath === "reviews" || relativePath.startsWith("reviews/") ||
      relativePath === "research" || relativePath.startsWith("research/") ||
      relativePath === "plans/active" || relativePath.startsWith("plans/active/") ||
      relativePath === "plans/archive" || relativePath.startsWith("plans/archive/")
    ) {
      operations.push({ type: "remove-dir", path: relativePath });
    }
  }
  report.operations = operations.sort(operationSort);
  return report;
}
