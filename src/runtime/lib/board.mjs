import { access, lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter.mjs";
import {
  frontmatterParseFinding,
  missingIndexFinding,
  schemaFindings,
} from "./findings.mjs";
import { validateMetadata } from "./schema.mjs";

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const LEGACY_WORK_ID_PATTERN = /^(FR|BUG|CHORE)-\d+/;
const SCHEMA_2_ARTIFACT_ROOTS = Object.freeze({
  milestones: "milestones",
  workItems: "work",
  plans: "plans",
  evidence: "evidence",
});

export const SCHEMA_2_LAYOUT = Object.freeze({
  artifactRoots: SCHEMA_2_ARTIFACT_ROOTS,
  requiredDirectories: Object.freeze([
    ...Object.values(SCHEMA_2_ARTIFACT_ROOTS),
    `${SCHEMA_2_ARTIFACT_ROOTS.evidence}/topics`,
  ]),
});

function compareNames(left, right) {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

export async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function pathKind(target) {
  let stats;
  try {
    stats = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    if (error?.code === "ENOTDIR") return "invalid-parent";
    throw error;
  }

  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "special";
}

function boardRootError(boardPath) {
  const error = new Error(`Board root is not a directory: ${boardPath}`);
  error.code = "ERR_BOARD_ROOT_NOT_DIRECTORY";
  return error;
}

async function validateBoardRoot(boardPath) {
  const kind = await pathKind(boardPath);
  if (kind === "missing" || kind === "directory") return;
  if (kind === "symlink") {
    try {
      if ((await stat(boardPath)).isDirectory()) return;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  throw boardRootError(boardPath);
}

export function projectRelative(projectRoot, target) {
  const relativePath = path.relative(projectRoot, target) || ".";
  return relativePath.split(path.sep).join("/");
}

export async function listMarkdownFiles(directory, options = {}) {
  if (await pathKind(directory) !== "directory") return [];

  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort(compareNames);
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(target);
    } else if (entry.isDirectory() && options.recursive) {
      files.push(...(await listMarkdownFiles(target, options)));
    }
  }

  return files;
}

async function listLegacyReviewSummaries(directory) {
  if (await pathKind(directory) !== "directory") return [];

  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort(compareNames);
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summary = path.join(directory, entry.name, "summary.md");
    if (await pathExists(summary)) summaries.push(summary);
  }
  return summaries;
}

function legacyWorkId(filePath) {
  return path.basename(filePath, ".md").match(LEGACY_WORK_ID_PATTERN)?.[0] ?? null;
}

async function readArtifact({
  artifactKind,
  filePath,
  projectRoot,
  validate,
  legacyWork,
  findings,
}) {
  const text = await readFile(filePath, "utf8");
  const relativePath = projectRelative(projectRoot, filePath);
  let parsed;

  try {
    parsed = parseFrontmatter(text);
  } catch (error) {
    findings.push(frontmatterParseFinding(artifactKind, relativePath, error));
    return {
      kind: artifactKind,
      path: relativePath,
      filePath,
      text,
      body: null,
      metadata: null,
      parseError: error.message,
    };
  }

  const metadata = parsed.data;
  const artifact = {
    ...metadata,
    kind: artifactKind,
    path: relativePath,
    filePath,
    text,
    body: parsed.body,
    metadata,
  };

  if (legacyWork && !Object.hasOwn(artifact, "id")) {
    artifact.id = legacyWorkId(filePath) ?? path.basename(filePath, ".md");
  }
  if (artifactKind === "workItem") {
    artifact.terminal = TERMINAL_STATUSES.has(artifact.status);
  }

  if (validate) {
    findings.push(
      ...schemaFindings(artifactKind, artifact, validateMetadata(artifactKind, metadata)),
    );
  }

  return artifact;
}

async function readArtifacts(files, options) {
  const artifacts = [];
  for (const filePath of files) {
    artifacts.push(await readArtifact({ ...options, filePath }));
  }
  return artifacts;
}

async function readIndex(projectRoot, boardPath, findings) {
  const filePath = path.join(boardPath, "index.md");
  const relativePath = projectRelative(projectRoot, filePath);
  if (!(await pathExists(filePath))) {
    findings.push(missingIndexFinding(relativePath));
    return {
      kind: "board",
      path: relativePath,
      filePath,
      text: "",
      body: null,
      metadata: null,
      missing: true,
    };
  }

  const text = await readFile(filePath, "utf8");

  try {
    const parsed = parseFrontmatter(text);
    return {
      ...parsed.data,
      kind: "board",
      path: relativePath,
      filePath,
      text,
      body: parsed.body,
      metadata: parsed.data,
    };
  } catch (error) {
    findings.push(frontmatterParseFinding("board", relativePath, error));
    return {
      kind: "board",
      path: relativePath,
      filePath,
      text,
      body: null,
      metadata: null,
      parseError: error.message,
    };
  }
}

async function loadSchema2(projectRoot, boardPath, index, findings) {
  if (index.metadata) {
    findings.push(...schemaFindings("board", index, validateMetadata("board", index.metadata)));
  }

  const common = { projectRoot, validate: true, findings };
  const { artifactRoots } = SCHEMA_2_LAYOUT;
  const milestones = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, artifactRoots.milestones)),
    { ...common, artifactKind: "milestone" },
  );
  const workItems = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, artifactRoots.workItems)),
    { ...common, artifactKind: "workItem" },
  );
  const plans = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, artifactRoots.plans)),
    { ...common, artifactKind: "plan" },
  );
  const evidence = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, artifactRoots.evidence), {
      recursive: true,
    }),
    { ...common, artifactKind: "evidence" },
  );

  return {
    milestones,
    workItems,
    plans,
    evidence,
    reqs: workItems,
    activePlans: plans,
    archivedPlans: [],
    tests: evidence.filter((item) => item.type === "test"),
    reviews: evidence.filter((item) => item.type === "review"),
  };
}

async function loadSchema1(projectRoot, boardPath, findings) {
  const common = { projectRoot, validate: false, findings };
  const milestones = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, "milestones")),
    { ...common, artifactKind: "milestone" },
  );
  const workItems = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, "reqs")),
    { ...common, artifactKind: "workItem", legacyWork: true },
  );
  const activePlans = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, "plans", "active")),
    { ...common, artifactKind: "plan" },
  );
  const archivedPlans = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, "plans", "archive")),
    { ...common, artifactKind: "plan" },
  );
  const tests = await readArtifacts(
    await listMarkdownFiles(path.join(boardPath, "tests", "matrices")),
    { ...common, artifactKind: "test" },
  );
  const reviews = await readArtifacts(
    await listLegacyReviewSummaries(path.join(boardPath, "reviews")),
    { ...common, artifactKind: "review" },
  );

  return {
    milestones,
    workItems,
    plans: [...activePlans, ...archivedPlans],
    evidence: [...tests, ...reviews],
    reqs: workItems,
    activePlans,
    archivedPlans,
    tests,
    reviews,
  };
}

function emptyArtifacts() {
  return {
    milestones: [],
    workItems: [],
    plans: [],
    evidence: [],
    reqs: [],
    activePlans: [],
    archivedPlans: [],
    tests: [],
    reviews: [],
  };
}

export async function loadBoard(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const boardPath = path.resolve(options.boardPath ?? path.join(projectRoot, ".catpaw"));
  await validateBoardRoot(boardPath);
  const findings = [];
  const index = await readIndex(projectRoot, boardPath, findings);
  const hasDeclaredSchema = index.metadata && Object.hasOwn(index.metadata, "schema");
  const schema = index.metadata ? (hasDeclaredSchema ? index.schema : 1) : null;
  let artifacts;
  if (schema === null) {
    artifacts = emptyArtifacts();
  } else if (schema === 2) {
    artifacts = await loadSchema2(projectRoot, boardPath, index, findings);
  } else if (schema === 1) {
    artifacts = await loadSchema1(projectRoot, boardPath, findings);
  } else {
    findings.push(...schemaFindings("board", index, validateMetadata("board", index.metadata)));
    artifacts = emptyArtifacts();
  }

  return {
    projectRoot,
    boardPath,
    schema,
    schemaVersion: schema,
    runtime: index.runtime ?? null,
    index,
    indexPath: index.filePath,
    indexText: index.text,
    indexRuntime: index.runtime ?? null,
    ...artifacts,
    findings,
  };
}
