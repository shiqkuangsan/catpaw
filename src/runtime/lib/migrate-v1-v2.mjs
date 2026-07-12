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
const WORK_ID_PATTERN = /^(?:FR|BUG|CHORE)-[0-9]{3,}$/;
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
const DEFAULT_LESSONS = /^# Lessons\s+> Status: active · Last updated: (?:YYYY-MM-DD|\d{4}-\d{2}-\d{2})\s+Short corrective records\.[\s\S]*?- Candidate rule title -> promoted to project CLAUDE\.md\s*$/;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

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

function addMetadataBlockers(kind, metadata, artifactPath, blockers) {
  for (const issue of validateMetadata(kind, metadata)) {
    blockers.push(
      finding(
        `invalid-${kind}-metadata`,
        artifactPath,
        `${issue.path}: ${issue.message}`,
      ),
    );
  }
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

function transformLegacyScope(body, workById, artifactPath, blockers) {
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

function rewriteDestination({
  raw,
  source,
  target,
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
    blockers.push(
      finding("link-escapes-board", source, `Local link escapes the board: ${parsed.url}`),
    );
    return raw;
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
    ["write-file", 1],
    ["remove-file", 2],
  ]);
  const phase = phases.get(left.type) - phases.get(right.type);
  if (phase !== 0) return phase;
  return compareText(left.path ?? "", right.path ?? "");
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
    preservedUnknown: [],
    linkRewrites: [],
  };
}

function legacyWorkBinding(data, artifactPath, artifactKind, blockers) {
  const work = data.work ?? null;
  const req = data.req ?? null;
  if (work !== null && req !== null && work !== req) {
    blockers.push(
      finding(
        `conflicting-${artifactKind}-work`,
        artifactPath,
        `Conflicting legacy Work bindings: work=${work}, req=${req}.`,
      ),
    );
  }
  return work ?? req;
}

export async function analyzeV1ToV2Migration({
  projectRoot = process.cwd(),
  boardPath = path.join(projectRoot, ".catpaw"),
} = {}) {
  const root = path.resolve(boardPath);
  const report = baseReport(null);
  let inventory;
  try {
    inventory = await inventoryTree(root);
  } catch (error) {
    report.status = "blocked";
    report.blockers = [finding("invalid-board-root", ".", error.message)];
    return report;
  }

  const indexEntry = inventory.get("index.md");
  if (indexEntry?.type !== "file") {
    report.status = "blocked";
    report.blockers = [finding("missing-index", "index.md", "Board index.md is missing.")];
    return report;
  }
  const knownMarkdown = new Map();
  const indexText = decodeKnownMarkdown(
    await readFile(path.join(root, "index.md")),
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
    const text = decodeKnownMarkdown(
      await readFile(path.join(root, relativePath)),
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

  async function parsedFile(relativePath) {
    const text = knownMarkdown.get(relativePath);
    const parsed = parseText(text, relativePath, report.blockers);
    return parsed ? { text, ...parsed } : null;
  }

  const workPaths = [...inventory.keys()]
    .filter((item) => /^reqs\/[^/]+\.md$/.test(item))
    .sort(compareText);
  for (const source of workPaths) {
    const parsed = await parsedFile(source);
    if (!parsed) continue;
    const data = parsed.data;
    const id = data.id;
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*:\s*`),
    ]);
    if (typeof id === "string" && workIdSources.has(id)) {
      report.blockers.push(
        finding(
          "duplicate-work-id",
          source,
          `Work Item ${id} also appears at ${workIdSources.get(id)}.`,
        ),
      );
    } else if (typeof id === "string") {
      workIdSources.set(id, source);
    }
    if (data.level === "L0" || data.level === "L1") {
      report.blockers.push(
        finding(
          "unsupported-work-level",
          source,
          `${data.level} work has no schema 2 artifact mapping.`,
        ),
      );
    }
    if (data.status === "draft") {
      report.blockers.push(
        finding("draft-work", source, "Draft Work must be framed before migration."),
      );
    }
    if (data.stage === undefined) {
      report.blockers.push(
        finding("missing-work-stage", source, "Work Item requires an explicit lifecycle stage."),
      );
    }
    if (!title) {
      report.blockers.push(
        finding("missing-work-title", source, "Work Item requires a concrete H1 title."),
      );
    }
    const mode = data.level === "L2" ? "tracked" : data.level === "L3" ? "gated" : null;
    const metadata = {
      id,
      type: data.type,
      mode,
      status: data.status,
      stage: data.stage,
      created: data.created,
      updated: data.updated,
      closed: data.closed,
    };
    addMetadataBlockers("workItem", metadata, source, report.blockers);
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

  const planPaths = [...inventory.keys()]
    .filter((item) => /^plans\/(?:active|archive)\/[^/]+\.md$/.test(item))
    .sort(compareText);
  for (const source of planPaths) {
    const parsed = await parsedFile(source);
    if (!parsed) continue;
    if (parsed.data.status === "draft") {
      report.blockers.push(
        finding("draft-plan", source, "Draft Plan must be finalized before migration."),
      );
    }
    const work = legacyWorkBinding(
      parsed.data,
      source,
      "plan",
      report.blockers,
    );
    if (typeof work !== "string" || !workById.has(work)) {
      report.blockers.push(
        finding("missing-plan-work", source, "Plan requires an explicit existing Work binding."),
      );
    }
    const metadata = { work, updated: parsed.data.updated };
    addMetadataBlockers("plan", metadata, source, report.blockers);
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

  const milestonePaths = [...inventory.keys()]
    .filter((item) => /^milestones\/[^/]+\.md$/.test(item))
    .sort(compareText);
  for (const source of milestonePaths) {
    const parsed = await parsedFile(source);
    if (!parsed) continue;
    const id = parsed.data.id;
    if (typeof id === "string" && milestoneIdSources.has(id)) {
      report.blockers.push(
        finding(
          "duplicate-milestone-id",
          source,
          `Milestone ${id} also appears at ${milestoneIdSources.get(id)}.`,
        ),
      );
    } else if (typeof id === "string") {
      milestoneIdSources.set(id, source);
    }
    if (parsed.data.status === "draft") {
      report.blockers.push(
        finding("draft-milestone", source, "Draft Milestone must be activated or cancelled."),
      );
    }
    const metadata = {
      id: parsed.data.id,
      status: parsed.data.status,
      created: parsed.data.created,
      updated: parsed.data.updated,
      closed: parsed.data.closed,
      target: parsed.data.target ?? null,
    };
    addMetadataBlockers("milestone", metadata, source, report.blockers);
    const title = headingTitle(parsed.body, [
      new RegExp(`^${String(parsed.data.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*:\s*`),
    ]);
    if (!title) {
      report.blockers.push(
        finding("missing-milestone-title", source, "Milestone requires a concrete H1 title."),
      );
    }
    const body = transformLegacyScope(parsed.body, workById, source, report.blockers);
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
    const parsed = await parsedFile(source);
    if (!parsed) return;
    if (parsed.data.status === "draft") {
      report.blockers.push(
        finding(
          "draft-evidence",
          source,
          "Draft artifact must be finalized before it can become Evidence.",
        ),
      );
    }
    const work = legacyWorkBinding(
      parsed.data,
      source,
      "evidence",
      report.blockers,
    );
    if (bindingRequired && (typeof work !== "string" || !workById.has(work))) {
      report.blockers.push(
        finding("missing-evidence-work", source, "Evidence requires an explicit existing Work binding."),
      );
    } else if (work !== null && (typeof work !== "string" || !workById.has(work))) {
      report.blockers.push(
        finding("invalid-evidence-work", source, "Evidence Work binding does not resolve."),
      );
    }
    if (parsed.data.created === undefined) {
      report.blockers.push(
        finding("missing-evidence-created", source, "Evidence requires an explicit created date."),
      );
    }
    if (parsed.data.updated === undefined) {
      report.blockers.push(
        finding("missing-evidence-updated", source, "Evidence requires an explicit updated date."),
      );
    }
    const title = headingTitle(parsed.body, [
      /^Test Matrix:\s*/i,
      /^Review:\s*/i,
      /^Provider Dialogue:\s*/i,
    ]);
    if (!title) {
      report.blockers.push(
        finding("missing-evidence-title", source, "Evidence requires a concrete H1 title."),
      );
    }
    const independent = Object.hasOwn(parsed.data, "independent")
      ? parsed.data.independent
      : false;
    const agent = parsed.data.agent ?? null;
    if (independent && (typeof agent !== "string" || agent.trim() === "")) {
      report.blockers.push(
        finding("missing-independent-agent", source, "Independent Evidence requires an agent."),
      );
    }
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
    addMetadataBlockers("evidence", metadata, source, report.blockers);
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

  if (inventory.get("lessons.md")?.type === "file") {
    const lessons = knownMarkdown.get("lessons.md");
    report.preservedUnknown.push("lessons.md");
    if (lessons.trim() !== "" && !DEFAULT_LESSONS.test(lessons.trim())) {
      report.blockers.push(
        finding(
          "substantive-lessons",
          "lessons.md",
          "Lessons cannot be split into deterministic Reflection Evidence.",
        ),
      );
    }
  }

  const targetDirectories = new Set(REQUIRED_DIRECTORIES);
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

  const indexCandidate = {
    kind: "index",
    artifactKind: "board",
    source: "index.md",
    target: "index.md",
  };
  report.mappings.push({ kind: "index", from: "index.md", to: "index.md" });
  moveMap.set("index.md", "index.md");
  const indexBody = rewriteMarkdownLinks(
    rewriteContext(indexCandidate),
    indexParsed.body,
  );
  const workItems = candidates
    .filter((item) => item.artifactKind === "workItem")
    .map((item) => ({ ...item.metadata, title: item.title, boardRelativePath: item.target }));
  const milestones = candidates
    .filter((item) => item.artifactKind === "milestone")
    .map((item) => ({ ...item.metadata, title: item.title, boardRelativePath: item.target }));
  const plans = candidates
    .filter((item) => item.artifactKind === "plan")
    .map((item) => ({ ...item.metadata, boardRelativePath: item.target }));
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
  }));
  for (const candidate of candidates) {
    operations.push({
      type: "write-file",
      path: candidate.target,
      content: rendered.get(candidate.source),
      mode: candidate.target === candidate.source ? "replace" : "create",
      fileMode: inventory.get(candidate.source).mode,
    });
    if (candidate.target !== candidate.source) {
      operations.push({ type: "remove-file", path: candidate.source });
    }
  }
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
  report.operations = operations.sort(operationSort);
  return report;
}
