import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";

const ABSENT_ROOT_DIGEST = "absent-root";
const ENGINE_PLANS = new WeakSet();
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const OPERATION_PHASE = new Map([
  ["ensure-dir", 0],
  ["move-file", 1],
  ["write-file", 2],
  ["remove-file", 3],
  ["remove-dir", 4],
]);

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function updateDigest(hash, value) {
  const bytes = Buffer.from(String(value));
  hash.update(String(bytes.length));
  hash.update(":");
  hash.update(bytes);
  hash.update(";");
}

function entryType(stats) {
  if (stats.isDirectory()) return "dir";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "special";
}

export async function resolvePhysicalPath(candidate) {
  const missingSegments = [];
  let current = candidate;

  while (true) {
    try {
      const existing = await realpath(current);
      return path.join(existing, ...missingSegments.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingSegments.push(path.basename(current));
      current = parent;
    }
  }
}

async function canonicalizeRoot(root) {
  const lexicalRoot = path.resolve(root);
  try {
    const stats = await lstat(lexicalRoot);
    if (stats.isSymbolicLink()) {
      const physicalParent = await realpath(path.dirname(lexicalRoot));
      return path.join(physicalParent, path.basename(lexicalRoot));
    }
    return await realpath(lexicalRoot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return resolvePhysicalPath(lexicalRoot);
  }
}

export async function snapshotTree(root) {
  let rootStats;
  try {
    rootStats = await lstat(root);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        digest: ABSENT_ROOT_DIGEST,
        entries: new Map(),
        exists: false,
        rootType: "absent",
      };
    }
    throw error;
  }

  const entries = new Map();

  async function visit(absolutePath, relativePath, stats) {
    const type = entryType(stats);
    const entry = {
      mode: stats.mode & 0o7777,
      type,
    };

    if (type === "file") {
      const content = await readFile(absolutePath);
      entry.bytes = content.length;
      entry.sha256 = sha256(content);
    } else if (type === "symlink") {
      entry.target = await readlink(absolutePath);
    } else if (type === "special") {
      entry.device = stats.rdev;
    }

    entries.set(relativePath, entry);
    if (type !== "dir") return;

    const names = await readdir(absolutePath);
    names.sort(compareStrings);
    for (const name of names) {
      const childRelativePath = relativePath ? `${relativePath}/${name}` : name;
      const childAbsolutePath = path.join(absolutePath, name);
      await visit(childAbsolutePath, childRelativePath, await lstat(childAbsolutePath));
    }
  }

  await visit(root, "", rootStats);

  const hash = createHash("sha256");
  const relativePaths = [...entries.keys()].sort(compareStrings);
  for (const relativePath of relativePaths) {
    const entry = entries.get(relativePath);
    updateDigest(hash, relativePath);
    updateDigest(hash, entry.type);
    updateDigest(hash, entry.mode);
    if (entry.type === "file") {
      updateDigest(hash, entry.bytes);
      updateDigest(hash, entry.sha256);
    } else if (entry.type === "symlink") {
      updateDigest(hash, entry.target);
    } else if (entry.type === "special") {
      updateDigest(hash, entry.device);
    }
  }

  return {
    digest: hash.digest("hex"),
    entries,
    exists: true,
    rootType: entryType(rootStats),
  };
}

function assertExactKeys(operation, requiredKeys, index, optionalKeys = []) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(operation)) {
    if (!allowed.has(key)) {
      throw new TypeError(`operations[${index}] has unsupported field "${key}".`);
    }
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(operation, key)) {
      throw new TypeError(`operations[${index}].${key} is required.`);
    }
  }
}

function normalizeOperation(operation, index) {
  if (operation === null || typeof operation !== "object" || Array.isArray(operation)) {
    throw new TypeError(`operations[${index}] must be an object.`);
  }

  switch (operation.type) {
    case "ensure-dir": {
      assertExactKeys(operation, ["type", "path"], index, ["dirMode"]);
      if (typeof operation.path !== "string") {
        throw new TypeError(
          "operations[" + index + "].path must be a string.",
        );
      }
      if (
        Object.hasOwn(operation, "dirMode") &&
        (!Number.isInteger(operation.dirMode) ||
          operation.dirMode < 0 ||
          operation.dirMode > 0o7777)
      ) {
        throw new TypeError(
          "operations[" + index +
            "].dirMode must be an integer between 0 and 0o7777.",
        );
      }
      const normalized = { type: operation.type, path: operation.path };
      if (Object.hasOwn(operation, "dirMode")) {
        normalized.dirMode = operation.dirMode;
      }
      return normalized;
    }
    case "remove-file":
    case "remove-dir": {
      assertExactKeys(operation, ["type", "path"], index);
      if (typeof operation.path !== "string") {
        throw new TypeError(`operations[${index}].path must be a string.`);
      }
      return { type: operation.type, path: operation.path };
    }
    case "write-file": {
      assertExactKeys(
        operation,
        ["type", "path", "content", "mode"],
        index,
        ["fileMode"],
      );
      if (typeof operation.path !== "string") {
        throw new TypeError(`operations[${index}].path must be a string.`);
      }
      if (typeof operation.content !== "string") {
        throw new TypeError(`operations[${index}].content must be a string.`);
      }
      if (operation.mode !== "create" && operation.mode !== "replace") {
        throw new TypeError(`operations[${index}].mode must be "create" or "replace".`);
      }
      if (
        Object.hasOwn(operation, "fileMode") &&
        (!Number.isInteger(operation.fileMode) ||
          operation.fileMode < 0 ||
          operation.fileMode > 0o7777)
      ) {
        throw new TypeError(
          `operations[${index}].fileMode must be an integer between 0 and 0o7777.`,
        );
      }
      const normalized = {
        type: operation.type,
        path: operation.path,
        content: operation.content,
        mode: operation.mode,
      };
      if (Object.hasOwn(operation, "fileMode")) {
        normalized.fileMode = operation.fileMode;
      }
      return normalized;
    }
    case "move-file": {
      assertExactKeys(operation, ["type", "from", "to"], index);
      if (typeof operation.from !== "string" || typeof operation.to !== "string") {
        throw new TypeError(`operations[${index}].from and .to must be strings.`);
      }
      return { type: operation.type, from: operation.from, to: operation.to };
    }
    default:
      throw new TypeError(`operations[${index}].type is unsupported.`);
  }
}

function operationSortKey(operation) {
  if (operation.type === "move-file") return `${operation.from}\0${operation.to}`;
  if (operation.type === "write-file") {
    return `${operation.path}\0${operation.mode}\0${operation.fileMode ?? ""}\0${sha256(operation.content)}`;
  }
  return operation.path;
}

function formatFileMode(fileMode) {
  return fileMode.toString(8).padStart(4, "0");
}

function pathDepth(relativePath) {
  return relativePath.split("/").length;
}

function compareOperations(left, right) {
  const phase = OPERATION_PHASE.get(left.type) - OPERATION_PHASE.get(right.type);
  if (phase !== 0) return phase;

  if (left.type === "ensure-dir") {
    const depth = pathDepth(left.path) - pathDepth(right.path);
    if (depth !== 0) return depth;
  } else if (left.type === "remove-dir") {
    const depth = pathDepth(right.path) - pathDepth(left.path);
    if (depth !== 0) return depth;
  }

  return compareStrings(operationSortKey(left), operationSortKey(right));
}

function pathFields(operation) {
  if (operation.type === "move-file") {
    return [
      ["from", operation.from],
      ["to", operation.to],
    ];
  }
  return [["path", operation.path]];
}

function unsafePathReason(relativePath) {
  if (relativePath.length === 0) return "path is empty";
  if (path.posix.isAbsolute(relativePath)) return "absolute paths are not allowed";
  if (WINDOWS_ABSOLUTE_PATH.test(relativePath)) {
    return "Windows absolute paths are not allowed";
  }
  if (relativePath.includes("\\")) return "backslashes are not allowed";
  if (CONTROL_CHARACTERS.test(relativePath)) return "control characters are not allowed";

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    return "empty path segments are not allowed";
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return "dot path segments are not allowed";
  }
  return null;
}

function printablePath(relativePath) {
  return relativePath.replace(/[\u0000-\u001f\u007f-\u009f]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function createBlockerCollector() {
  const blockers = new Map();

  return {
    add(code, relativePath, message) {
      const blocker = { code, path: printablePath(relativePath), message };
      blockers.set(`${code}\0${blocker.path}\0${message}`, blocker);
    },
    list() {
      return [...blockers.values()].sort((left, right) =>
        compareStrings(
          `${left.code}\0${left.path}\0${left.message}`,
          `${right.code}\0${right.path}\0${right.message}`,
        ),
      );
    },
    get size() {
      return blockers.size;
    },
  };
}

function addRole(map, relativePath, description) {
  const roles = map.get(relativePath) ?? [];
  roles.push(description);
  map.set(relativePath, roles);
}

function collectStructuralBlockers(operations, blockers) {
  const sources = new Map();
  const targets = new Map();
  const filePaths = new Set();
  const directoryPaths = new Set();
  const moveSources = new Set();

  for (const operation of operations) {
    switch (operation.type) {
      case "ensure-dir":
        addRole(targets, operation.path, "ensure-dir");
        directoryPaths.add(operation.path);
        break;
      case "write-file":
        addRole(targets, operation.path, `write-file:${operation.mode}`);
        filePaths.add(operation.path);
        break;
      case "move-file":
        addRole(sources, operation.from, "move-file:from");
        addRole(targets, operation.to, "move-file:to");
        filePaths.add(operation.from);
        filePaths.add(operation.to);
        moveSources.add(operation.from);
        break;
      case "remove-file":
        addRole(sources, operation.path, "remove-file");
        filePaths.add(operation.path);
        break;
      case "remove-dir":
        addRole(sources, operation.path, "remove-dir");
        directoryPaths.add(operation.path);
        break;
    }
  }

  for (const [relativePath, roles] of sources) {
    if (roles.length > 1) {
      blockers.add(
        "duplicate-source",
        relativePath,
        `Multiple operations use "${relativePath}" as a source.`,
      );
    }
  }
  for (const [relativePath, roles] of targets) {
    if (roles.length > 1) {
      blockers.add(
        "duplicate-target",
        relativePath,
        `Multiple operations use "${relativePath}" as a target.`,
      );
    }
  }
  for (const relativePath of sources.keys()) {
    if (targets.has(relativePath)) {
      blockers.add(
        "source-target-conflict",
        relativePath,
        `"${relativePath}" is both a source and a target.`,
      );
    }
  }

  for (const operation of operations) {
    if (operation.type === "move-file" && moveSources.has(operation.to)) {
      blockers.add(
        "move-chain",
        `${operation.from} -> ${operation.to}`,
        "Move chains and cycles are not supported.",
      );
    }
  }

  const allPaths = new Set([...filePaths, ...directoryPaths]);
  for (const filePath of filePaths) {
    if (directoryPaths.has(filePath)) {
      blockers.add(
        "file-directory-prefix",
        filePath,
        `"${filePath}" is planned as both a file and a directory.`,
      );
    }
    for (const otherPath of allPaths) {
      if (otherPath.startsWith(`${filePath}/`)) {
        blockers.add(
          "file-directory-prefix",
          `${filePath} -> ${otherPath}`,
          `File path "${filePath}" is a prefix of "${otherPath}".`,
        );
      }
    }
  }
}

function inspectPath(entries, relativePath) {
  const segments = relativePath.split("/");
  let currentPath = "";

  for (let index = 0; index < segments.length - 1; index += 1) {
    currentPath = currentPath ? `${currentPath}/${segments[index]}` : segments[index];
    const entry = entries.get(currentPath);
    if (!entry) return { missingParent: currentPath };
    if (entry.type !== "dir") return { ancestor: entry, ancestorPath: currentPath };
  }

  return { entry: entries.get(relativePath) };
}

function blockUnsafeEntry(blockers, requestedPath, inspected) {
  const entry = inspected.ancestor ?? inspected.entry;
  const entryPath = inspected.ancestorPath ?? requestedPath;
  if (entry?.type === "symlink") {
    blockers.add(
      "symlink-traversal",
      entryPath,
      `Operation path "${requestedPath}" traverses a symbolic link.`,
    );
    return true;
  }
  if (entry?.type === "special") {
    blockers.add(
      "special-file",
      entryPath,
      `Operation path "${requestedPath}" reaches a special file.`,
    );
    return true;
  }
  if (inspected.ancestor) {
    blockers.add(
      "expected-directory",
      entryPath,
      `Parent "${entryPath}" is not a directory.`,
    );
    return true;
  }
  return false;
}

function addMissingParent(blockers, relativePath, missingParent) {
  blockers.add(
    "missing-parent",
    missingParent,
    `Parent directory for "${relativePath}" does not exist.`,
  );
}

function simulateOperations(initialEntries, operations, blockers) {
  const entries = new Map(initialEntries);
  if (!entries.has("")) entries.set("", { mode: 0o755, type: "dir" });
  const effective = [];

  for (const operation of operations) {
    if (operation.type === "ensure-dir") {
      const inspected = inspectPath(entries, operation.path);
      if (blockUnsafeEntry(blockers, operation.path, inspected)) continue;
      if (inspected.missingParent) {
        const segments = operation.path.split("/");
        let currentPath = "";
        for (const segment of segments) {
          currentPath = currentPath ? `${currentPath}/${segment}` : segment;
          if (!entries.has(currentPath)) {
            entries.set(currentPath, {
              mode: currentPath === operation.path
                ? operation.dirMode ?? 0o755
                : 0o755,
              type: "dir",
            });
          }
        }
        effective.push(operation);
      } else if (!inspected.entry) {
        entries.set(operation.path, {
          mode: operation.dirMode ?? 0o755,
          type: "dir",
        });
        effective.push(operation);
      } else if (inspected.entry.type !== "dir") {
        blockers.add(
          "expected-directory",
          operation.path,
          `"${operation.path}" exists and is not a directory.`,
        );
      }
      continue;
    }

    if (operation.type === "move-file") {
      const initialSource = inspectPath(initialEntries, operation.from);
      if (blockUnsafeEntry(blockers, operation.from, initialSource)) continue;
      if (initialSource.missingParent || !initialSource.entry) {
        blockers.add(
          "missing-source",
          operation.from,
          `Move source "${operation.from}" does not exist.`,
        );
        continue;
      }
      if (initialSource.entry.type !== "file") {
        blockers.add(
          "expected-file",
          operation.from,
          `Move source "${operation.from}" is not a regular file.`,
        );
        continue;
      }

      const initialDestination = inspectPath(initialEntries, operation.to);
      if (blockUnsafeEntry(blockers, operation.to, initialDestination)) continue;
      if (initialDestination.entry) {
        blockers.add(
          "existing-move-destination",
          operation.to,
          `Move destination "${operation.to}" already exists.`,
        );
        continue;
      }

      const destination = inspectPath(entries, operation.to);
      if (blockUnsafeEntry(blockers, operation.to, destination)) continue;
      if (destination.missingParent) {
        addMissingParent(blockers, operation.to, destination.missingParent);
        continue;
      }

      entries.delete(operation.from);
      entries.set(operation.to, initialSource.entry);
      effective.push(operation);
      continue;
    }

    if (operation.type === "write-file") {
      const inspected = inspectPath(entries, operation.path);
      if (blockUnsafeEntry(blockers, operation.path, inspected)) continue;
      if (inspected.missingParent) {
        addMissingParent(blockers, operation.path, inspected.missingParent);
        continue;
      }
      if (inspected.entry?.type === "dir") {
        blockers.add(
          "expected-file",
          operation.path,
          `"${operation.path}" exists and is a directory.`,
        );
        continue;
      }

      const content = Buffer.from(operation.content);
      const contentDigest = sha256(content);
      if (
        inspected.entry?.type === "file" &&
        inspected.entry.bytes === content.length &&
        inspected.entry.sha256 === contentDigest &&
        (operation.fileMode === undefined || inspected.entry.mode === operation.fileMode)
      ) {
        continue;
      }
      if (operation.mode === "create" && inspected.entry) {
        blockers.add(
          "existing-target",
          operation.path,
          `Create target "${operation.path}" already exists with different bytes or file mode.`,
        );
        continue;
      }
      if (operation.mode === "replace" && !inspected.entry) {
        blockers.add(
          "missing-target",
          operation.path,
          `Replace target "${operation.path}" does not exist.`,
        );
        continue;
      }

      if (
        operation.mode === "replace" &&
        operation.fileMode !== undefined &&
        inspected.entry.mode !== operation.fileMode
      ) {
        blockers.add(
          "replacement-mode-mismatch",
          operation.path,
          `Replace target "${operation.path}" has mode ${formatFileMode(inspected.entry.mode)}; replacement must preserve it instead of requesting ${formatFileMode(operation.fileMode)}.`,
        );
        continue;
      }

      const fileMode = operation.mode === "replace"
        ? inspected.entry.mode
        : operation.fileMode;

      entries.set(operation.path, {
        bytes: content.length,
        mode: fileMode ?? 0o666,
        sha256: contentDigest,
        type: "file",
      });
      effective.push(
        fileMode === undefined || operation.fileMode === fileMode
          ? operation
          : { ...operation, fileMode },
      );
      continue;
    }

    if (operation.type === "remove-file") {
      const inspected = inspectPath(entries, operation.path);
      if (blockUnsafeEntry(blockers, operation.path, inspected)) continue;
      if (inspected.missingParent || !inspected.entry) continue;
      if (inspected.entry.type !== "file") {
        blockers.add(
          "expected-file",
          operation.path,
          `Remove target "${operation.path}" is not a regular file.`,
        );
        continue;
      }
      entries.delete(operation.path);
      effective.push(operation);
      continue;
    }

    if (operation.type === "remove-dir") {
      const inspected = inspectPath(entries, operation.path);
      if (blockUnsafeEntry(blockers, operation.path, inspected)) continue;
      if (inspected.missingParent || !inspected.entry) continue;
      if (inspected.entry.type !== "dir") {
        blockers.add(
          "expected-directory",
          operation.path,
          `Remove target "${operation.path}" is not a directory.`,
        );
        continue;
      }
      if ([...entries.keys()].some((entryPath) => entryPath.startsWith(`${operation.path}/`))) {
        blockers.add(
          "directory-not-empty",
          operation.path,
          `Directory "${operation.path}" is not empty after planned operations.`,
        );
        continue;
      }
      entries.delete(operation.path);
      effective.push(operation);
    }
  }

  return effective;
}

async function inspectAbsentRootParent(root, blockers) {
  const parent = path.dirname(root);
  let stats;
  try {
    stats = await lstat(parent);
  } catch (error) {
    if (error?.code === "ENOENT") {
      blockers.add(
        "missing-root-parent",
        parent,
        "The parent directory for an absent root does not exist.",
      );
      return;
    }
    throw error;
  }

  if (stats.isSymbolicLink()) {
    blockers.add("symlink-traversal", parent, "The root parent is a symbolic link.");
  } else if (!stats.isDirectory()) {
    blockers.add("expected-directory", parent, "The root parent is not a directory.");
  }
}

export async function createPatchPlan({ root, operations } = {}) {
  if (typeof root !== "string" || root.length === 0 || CONTROL_CHARACTERS.test(root)) {
    throw new TypeError("root must be a non-empty path without control characters.");
  }
  if (!Array.isArray(operations)) {
    throw new TypeError("operations must be an array.");
  }

  const canonicalRoot = await canonicalizeRoot(root);
  const normalizedOperations = operations
    .map((operation, index) => normalizeOperation(operation, index))
    .sort(compareOperations);
  const snapshot = await snapshotTree(canonicalRoot);
  const blockers = createBlockerCollector();
  const safeOperations = [];

  for (const operation of normalizedOperations) {
    let safe = true;
    for (const [field, relativePath] of pathFields(operation)) {
      const reason = unsafePathReason(relativePath);
      if (reason) {
        blockers.add(
          "unsafe-path",
          relativePath,
          `${operation.type}.${field}: ${reason}.`,
        );
        safe = false;
      }
    }
    if (safe) safeOperations.push(operation);
  }

  if (snapshot.rootType === "symlink") {
    blockers.add("symlink-traversal", canonicalRoot, "The patch root is a symbolic link.");
  } else if (snapshot.exists && snapshot.rootType !== "dir") {
    blockers.add("expected-directory", canonicalRoot, "The patch root is not a directory.");
  }
  if (!snapshot.exists) await inspectAbsentRootParent(canonicalRoot, blockers);

  for (const [relativePath, entry] of snapshot.entries) {
    if (entry.type === "special") {
      blockers.add(
        "special-file",
        relativePath || canonicalRoot,
        "Special files cannot be copied into a staged transaction.",
      );
    }
  }

  collectStructuralBlockers(safeOperations, blockers);
  const effectiveOperations = blockers.size === 0
    ? simulateOperations(snapshot.entries, safeOperations, blockers)
    : [];
  const blockerList = blockers.list();
  const status = blockerList.length > 0
    ? "blocked"
    : effectiveOperations.length === 0
      ? "noop"
      : "ready";

  const plan = deepFreeze({
    root: canonicalRoot,
    rootDigest: snapshot.digest,
    status,
    operations: effectiveOperations,
    blockers: blockerList,
  });
  ENGINE_PLANS.add(plan);
  return plan;
}

export function assertPatchPlan(plan) {
  if (plan === null || typeof plan !== "object" || !ENGINE_PLANS.has(plan)) {
    throw new TypeError("plan must be created by createPatchPlan().");
  }
  if (
    !path.isAbsolute(plan.root) ||
    typeof plan.rootDigest !== "string" ||
    !["ready", "noop", "blocked"].includes(plan.status) ||
    !Array.isArray(plan.operations) ||
    plan.operations.some((operation) => !OPERATION_PHASE.has(operation.type))
  ) {
    throw new TypeError("plan contains an unsupported operation or invalid engine state.");
  }
  return plan;
}

function renderOperation(operation) {
  switch (operation.type) {
    case "ensure-dir":
      return operation.dirMode === undefined
        ? `ENSURE DIR ${operation.path}`
        : `ENSURE DIR ${operation.path} (mode=${formatFileMode(operation.dirMode)})`;
    case "write-file": {
      const bytes = Buffer.byteLength(operation.content);
      const fileMode = operation.fileMode === undefined
        ? ""
        : `, mode=${formatFileMode(operation.fileMode)}`;
      return `WRITE ${operation.mode.toUpperCase()} ${operation.path} (${bytes} bytes, sha256=${sha256(operation.content)}${fileMode})`;
    }
    case "move-file":
      return `MOVE FILE ${operation.from} -> ${operation.to}`;
    case "remove-file":
      return `REMOVE FILE ${operation.path}`;
    case "remove-dir":
      return `REMOVE DIR ${operation.path}`;
    default:
      throw new TypeError(`Unsupported patch operation: ${operation.type}`);
  }
}

export function renderPatchPlan(plan) {
  assertPatchPlan(plan);
  if (plan.status === "noop") return "NO CHANGES\n";

  const lines = [plan.status === "blocked" ? "BLOCKED" : "READY"];
  for (const blocker of plan.blockers ?? []) {
    lines.push(`BLOCK ${blocker.code} ${blocker.path}: ${blocker.message}`);
  }
  for (const operation of plan.operations ?? []) lines.push(renderOperation(operation));
  return `${lines.join("\n")}\n`;
}
