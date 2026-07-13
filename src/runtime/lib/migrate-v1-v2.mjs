import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.mjs";
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
const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
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

function normalizedClosed(value, status) {
  if (!TERMINAL_STATUSES.has(status)) {
    return value === undefined || value === null || value === "" ? null : value;
  }
  return value;
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
  const rawWork = data?.work ?? null;
  const rawReq = data?.req ?? null;
  const work = canonicalWorkId(rawWork);
  const req = canonicalWorkId(rawReq);
  if (rawWork !== null && work === null) {
    return { value: null, error: `work=${rawWork} is not a canonical Work reference.` };
  }
  if (rawReq !== null && req === null) {
    return { value: null, error: `req=${rawReq} is not a canonical Work reference.` };
  }
  if (work !== null && req !== null && work !== req) {
    return {
      value: null,
      error: `Conflicting legacy Work bindings: work=${rawWork}, req=${rawReq}.`,
      code: `conflicting-${artifactKind}-work`,
      path: artifactPath,
    };
  }
  const value = work ?? req;
  return {
    value,
    normalized: value !== null && ![rawWork, rawReq].includes(value),
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
    entries.set(normalized, {
      type,
      empty: false,
      mode: stats.mode & 0o7777,
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

function headingTitle(body, prefixes = []) {
  let title = body?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  for (const prefix of prefixes) {
    title = title.replace(prefix, "").trim();
  }
  if (title === "" || /^(?:\[?title\]?|\.\.\.)$/i.test(title)) return null;
  return title;
}

function parseTableRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return null;
  const cells = [];
  let cell = "";
  for (let index = 1; index < line.length - 1; index += 1) {
    const character = line[index];
    if (character === "\\" && index + 1 < line.length - 1) {
      const escaped = line[index + 1];
      cell += escaped === "|" || escaped === "\\" ? escaped : `\\${escaped}`;
      index += 1;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells.length === 4 ? cells : null;
}

function scopeWorkIds(body) {
  const lines = String(body ?? "").replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === "## scope",
  );
  if (start === -1) return new Set();
  const end = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line.trim()),
  );
  const ids = new Set();
  for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
    const id = parseTableRow(line.trim())?.[0];
    if (WORK_ID_PATTERN.test(id ?? "")) ids.add(id);
  }
  return ids;
}

function transformLegacyScope(
  body,
  workById,
  blockedWorkIds,
  artifactPath,
  blockers,
) {
  if (/<!-- catpaw:milestone-scope:(?:start|end) -->/.test(body)) {
    blockers.push(
      finding(
        "ambiguous-milestone-scope",
        artifactPath,
        "Schema 1 Milestone already contains managed Scope markers.",
      ),
    );
    return body;
  }
  const scopeHeading = body.match(/^## Scope[ \t]*$/m);
  if (!scopeHeading) {
    blockers.push(
      finding("missing-milestone-scope", artifactPath, "Milestone has no ## Scope section."),
    );
    return body;
  }
  const sectionStart = scopeHeading.index + scopeHeading[0].length;
  const remaining = body.slice(sectionStart);
  const nextHeading = remaining.match(/^##\s+/m);
  const sectionEnd = nextHeading
    ? sectionStart + nextHeading.index
    : body.length;
  const section = body.slice(sectionStart, sectionEnd);
  const lines = section.split("\n");
  const tableStart = lines.findIndex((line) => line.trimStart().startsWith("|"));
  if (tableStart === -1) {
    blockers.push(
      finding("missing-milestone-scope", artifactPath, "Milestone Scope has no table."),
    );
    return body;
  }
  let tableEnd = tableStart;
  while (tableEnd < lines.length && lines[tableEnd].trimStart().startsWith("|")) {
    tableEnd += 1;
  }
  const tableLines = lines.slice(tableStart, tableEnd).map((line) => line.trim());
  const header = parseTableRow(tableLines[0] ?? "");
  if (
    !header ||
    !["req", "work item id"].includes(header[0].toLowerCase()) ||
    header[1].toLowerCase() !== "title" ||
    header[2].toLowerCase() !== "status" ||
    header[3].toLowerCase() !== "notes" ||
    !/^\|\s*:?-+/.test(tableLines[1] ?? "")
  ) {
    blockers.push(
      finding("malformed-milestone-scope", artifactPath, "Milestone Scope table is malformed."),
    );
    return body;
  }

  const rows = [];
  const seen = new Set();
  for (const line of tableLines.slice(2)) {
    const parsed = parseTableRow(line);
    const id = parsed?.[0];
    if (!parsed || !WORK_ID_PATTERN.test(id) || seen.has(id)) {
      blockers.push(
        finding("malformed-milestone-scope", artifactPath, "Milestone Scope row is invalid."),
      );
      continue;
    }
    seen.add(id);
    const work = workById.get(id);
    if (!work) {
      if (blockedWorkIds.has(id)) continue;
      blockers.push(
        finding(
          "missing-milestone-work",
          artifactPath,
          `Milestone Scope references missing Work Item ${id}.`,
        ),
      );
      continue;
    }
    rows.push({ id, notes: parsed[3], work });
  }
  rows.sort((left, right) => compareText(left.id, right.id));
  const replacement = [
    "<!-- catpaw:milestone-scope:start -->",
    "| Work Item ID | Title | Status | Notes |",
    "|---|---|---|---|",
    ...rows.map(({ id, notes, work }) =>
      `| ${id} | ${managedTableCell(work.title)} | ${work.metadata.status} | ${managedTableCell(notes)} |`
    ),
    "<!-- catpaw:milestone-scope:end -->",
  ];
  const nextLines = [
    ...lines.slice(0, tableStart),
    ...replacement,
    ...lines.slice(tableEnd),
  ];
  return `${body.slice(0, sectionStart)}${nextLines.join("\n")}${body.slice(sectionEnd)}`;
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
  linkRewrites,
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
    blockers.push(
      finding("broken-local-link", source, `Local link target does not exist: ${parsed.url}`),
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
    if (entry.type === "symlink" || entry.type === "special") {
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
    try {
      parsedCache.set(relativePath, { text, ...parseFrontmatter(text) });
    } catch (error) {
      parsedCache.set(relativePath, { text, error });
    }
  }
  function parsedFile(relativePath) {
    const cached = parsedCache.get(relativePath);
    return cached?.error ? null : cached ?? null;
  }
  function parseError(relativePath) {
    return parsedCache.get(relativePath)?.error ?? null;
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
  for (const source of milestonePaths) {
    const parsed = parsedFile(source);
    if (!parsed) continue;
    const sourceId = canonicalMilestoneId(source);
    const explicitId = canonicalMilestoneId(parsed.data.id);
    const status = normalizedMilestoneStatus(parsed.data.status);
    const routedActive =
      (sourceId !== null && activeIndexMilestoneIds.has(sourceId)) ||
      (explicitId !== null && activeIndexMilestoneIds.has(explicitId));
    if (!routedActive && !ACTIVE_STATUSES.has(status)) continue;
    for (const id of scopeWorkIds(parsed.body)) {
      activeMilestoneWorkIds.add(id);
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
    const sourceRequired = sourceRoutedActive || sourceDependency;
    if (!parsed) {
      if (sourceRequired) {
        markBlockedWork(sourceId);
        report.blockers.push(
          finding(
            "active-work-incomplete",
            source,
            `Active Work Item ${sourceId} requires valid frontmatter: ${parseError(source)?.message ?? "unknown parse error"}.`,
          ),
        );
      }
      continue;
    }
    const data = parsed.data;
    const explicitId = canonicalWorkId(data.id);
    const id = explicitId ?? sourceId;
    const activeSignal = id !== null &&
      (
        activeIndexWorkIds.has(id) ||
        activePlanWorkIds.has(id)
      );
    const dependencySignal = id !== null && activeMilestoneWorkIds.has(id);
    const status = normalizedWorkStatus(data.status, activeSignal);
    const routedActive = sourceRoutedActive || activeSignal;
    const required = routedActive || sourceDependency || dependencySignal;
    const active = required || ACTIVE_STATUSES.has(status);
    if (explicitId !== null && sourceId !== null && explicitId !== sourceId) {
      if (active) {
        markBlockedWork(sourceId, explicitId);
        report.blockers.push(
          finding(
            "active-work-identity-conflict",
            source,
            `Active Work Item identity conflicts: frontmatter=${explicitId}, filename=${sourceId}.`,
          ),
        );
      }
      continue;
    }
    if (routedActive && TERMINAL_STATUSES.has(status)) {
      markBlockedWork(sourceId, id);
      report.blockers.push(
        finding(
          "active-work-status-conflict",
          source,
          `Work Item ${id} is terminal in frontmatter but active in canonical schema 1 routing.`,
        ),
      );
      continue;
    }
    const type = workType(id);
    const mode = data.level === "L2" ? "tracked" : data.level === "L3" ? "gated" : null;
    const stage = data.stage === undefined && TERMINAL_STATUSES.has(status)
      ? "reflect"
      : data.stage;
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`),
    ]);
    const metadata = {
      id,
      type,
      mode,
      status,
      stage,
      created: data.created,
      updated: data.updated,
      closed: normalizedClosed(data.closed, status),
    };
    const invalidFields = metadataIssueFields("workItem", metadata);
    if (!title) invalidFields.push("title");
    const fields = [...new Set(invalidFields)].sort(compareText);
    if (fields.length > 0) {
      if (active) {
        markBlockedWork(sourceId, id);
        report.blockers.push(
          finding(
            "active-work-incomplete",
            source,
            `Active Work Item ${id ?? sourceId ?? "unknown"} requires explicit valid fields: ${fields.join(", ")}.`,
          ),
        );
      }
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
    if (data.id !== id) {
      report.warnings.push(
        warning("normalized-work-id", source, `Normalized Work ID ${data.id ?? "<missing>"} -> ${id}.`),
      );
    }
    if (data.type !== type) {
      report.warnings.push(
        warning("normalized-work-type", source, `Normalized Work type ${data.type ?? "<missing>"} -> ${type} from ${id}.`),
      );
    }
    if (data.status !== status) {
      report.warnings.push(
        warning("normalized-work-status", source, `Normalized Work status ${data.status ?? "<missing>"} -> ${status}.`),
      );
    }
    if (data.stage !== stage) {
      report.warnings.push(
        warning("normalized-work-stage", source, `Normalized terminal Work stage ${data.stage ?? "<missing>"} -> ${stage}.`),
      );
    }
    if (Object.hasOwn(data, "priority")) {
      report.warnings.push(
        finding("dropped-field", source, "Dropped schema 1 field: priority."),
      );
    }
    const target = `work/${path.posix.basename(source)}`;
    const work = { kind: "work", artifactKind: "workItem", source, target, id, title, metadata, body: parsed.body };
    if (typeof id === "string" && !workById.has(id)) workById.set(id, work);
    registerCandidate(work);
  }

  for (const source of planPaths) {
    const parsed = parsedFile(source);
    const active = source.startsWith("plans/active/");
    if (!parsed) {
      if (active) {
        report.blockers.push(
          finding(
            "active-plan-incomplete",
            source,
            `Active Plan requires valid frontmatter: ${parseError(source)?.message ?? "unknown parse error"}.`,
          ),
        );
      }
      continue;
    }
    const binding = normalizedBinding(parsed.data, source, "plan");
    if (binding.error) {
      if (active) {
        report.blockers.push(
          finding(
            binding.code ?? "active-plan-incomplete",
            source,
            binding.error,
          ),
        );
      }
      continue;
    }
    const work = binding.value;
    const metadata = { work, updated: parsed.data.updated };
    const fields = metadataIssueFields("plan", metadata);
    if (
      work !== null &&
      !workById.has(work) &&
      !blockedActiveWorkIds.has(work) &&
      !fields.includes("work")
    ) {
      fields.push("work");
    }
    if (parsed.data.status === "draft" && active) fields.push("status");
    const invalidFields = [...new Set(fields)].sort(compareText);
    if (invalidFields.length > 0) {
      if (active) {
        report.blockers.push(
          finding(
            "active-plan-incomplete",
            source,
            `Active Plan requires explicit valid fields: ${invalidFields.join(", ")}.`,
          ),
        );
      }
      continue;
    }
    if (work !== null && blockedActiveWorkIds.has(work)) continue;
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
    if (!parsed) {
      if (sourceActive) {
        report.blockers.push(
          finding(
            "active-milestone-incomplete",
            source,
            `Active Milestone ${sourceId} requires valid frontmatter.`,
          ),
        );
      }
      continue;
    }
    const explicitId = canonicalMilestoneId(parsed.data.id);
    const id = explicitId ?? sourceId;
    const activeSignal = id !== null && activeIndexMilestoneIds.has(id);
    const status = normalizedMilestoneStatus(parsed.data.status);
    const routedActive = sourceActive || activeSignal;
    const active = routedActive || ACTIVE_STATUSES.has(status);
    if (explicitId !== null && sourceId !== null && explicitId !== sourceId) {
      if (active) {
        report.blockers.push(
          finding(
            "active-milestone-identity-conflict",
            source,
            "Active Milestone identity conflicts: frontmatter=" +
              explicitId + ", filename=" + sourceId + ".",
          ),
        );
      }
      continue;
    }
    if (routedActive && TERMINAL_STATUSES.has(status)) {
      report.blockers.push(
        finding(
          "active-milestone-status-conflict",
          source,
          "Milestone " + id +
            " is terminal in frontmatter but active in canonical schema 1 routing.",
        ),
      );
      continue;
    }
    const metadata = {
      id,
      status,
      created: parsed.data.created,
      updated: parsed.data.updated,
      closed: normalizedClosed(parsed.data.closed, status),
      target: parsed.data.target ?? null,
    };
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`),
    ]);
    const fields = metadataIssueFields("milestone", metadata);
    if (!title) fields.push("title");
    const scopeBlockers = [];
    const body = fields.length === 0
      ? transformLegacyScope(
        parsed.body,
        workById,
        blockedActiveWorkIds,
        source,
        scopeBlockers,
      )
      : parsed.body;
    if (scopeBlockers.length > 0) fields.push("scope");
    const invalidFields = [...new Set(fields)].sort(compareText);
    if (invalidFields.length > 0) {
      if (active) {
        report.blockers.push(
          finding(
            "active-milestone-incomplete",
            source,
            `Active Milestone ${id ?? sourceId ?? "unknown"} requires explicit valid fields: ${invalidFields.join(", ")}.`,
          ),
        );
      }
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
    milestoneIdSources.set(id, source);
    registerCandidate({
      kind: "milestone",
      artifactKind: "milestone",
      source,
      target: source,
      id: metadata.id,
      title,
      metadata,
      body,
    });
  }

  async function addEvidence(source, type, stage, bindingRequired) {
    const parsed = parsedFile(source);
    if (!parsed) return;
    if (parsed.data.status === "draft") return;
    const binding = normalizedBinding(parsed.data, source, "evidence");
    if (binding.error) return;
    const work = binding.value;
    if (bindingRequired && (work === null || !workById.has(work))) return;
    if (work !== null && !workById.has(work)) return;
    const title = headingTitle(parsed.body, [
      /^Test Matrix:\s*/i,
      /^Review:\s*/i,
      /^Provider Dialogue:\s*/i,
    ]);
    const independent = Object.hasOwn(parsed.data, "independent")
      ? parsed.data.independent
      : false;
    const agent = parsed.data.agent ?? null;
    const metadata = {
      type,
      work,
      stage,
      created: parsed.data.created,
      updated: parsed.data.updated,
      independent,
      agent,
      lens: parsed.data.lens ?? null,
    };
    const fields = metadataIssueFields("evidence", metadata);
    if (!title) fields.push("title");
    if (independent && (typeof agent !== "string" || agent.trim() === "")) {
      fields.push("agent");
    }
    if (fields.length > 0) return;
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
    const target = `${directory}/${parsed.data.created}-${type}-${asciiSlug(title ?? "item")}.md`;
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

  const testPaths = [...inventory.keys()]
    .filter((item) => /^tests\/matrices\/[^/]+\.md$/.test(item))
    .sort(compareText);
  for (const source of testPaths) await addEvidence(source, "test", "test", true);

  const reviewPaths = [...inventory.keys()]
    .filter((item) => /^reviews\/.+\.md$/.test(item))
    .sort(compareText);
  for (const source of reviewPaths) await addEvidence(source, "review", "review", true);

  const researchPaths = [...inventory.keys()]
    .filter((item) => /^research\/.+\.md$/.test(item))
    .sort(compareText);
  for (const source of researchPaths) {
    const provider = path.posix.basename(source) === "provider-dialogue.md";
    await addEvidence(source, provider ? "provider" : "research", provider ? "review" : "think", false);
  }

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
        linkRewrites: report.linkRewrites,
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
    linkRewrites: report.linkRewrites,
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
  const indexBody = [
    "# CatPaw Work Board",
    "",
    "Schema 1 source material remains available under the isolated legacy archive.",
    "",
    "## Legacy Material",
    "",
    `- [Schema 1 manifest](${LEGACY_ARCHIVE_ROOT}/manifest.json)`,
    "",
  ].join("\n");
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
  report.preservedLegacy.sort((left, right) => compareText(left.from, right.from));
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
      fileMode: inventory.get(candidate.source).mode,
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
