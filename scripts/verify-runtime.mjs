#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const roots = {
  source: path.resolve(
    process.env.CATPAW_SOURCE_ROOT ?? path.join(repoRoot, "src", "runtime"),
  ),
  dist: path.resolve(
    process.env.CATPAW_DIST_ROOT ?? path.join(repoRoot, "dist", "runtime"),
  ),
  installed: path.resolve(
    process.env.CATPAW_HOME ?? path.join(os.homedir(), ".catpaw"),
  ),
};
const ACTIVE_DOC_ROOTS = [
  "runtime-policy.md",
  "README.md",
  "AI-INSTALL.md",
  "guidance",
  "lenses",
  "providers",
  "snippets",
  "templates",
];
const PROTECTED_LOCAL_ROOTS = new Set(["backups", "state"]);

function parseArgs(argv) {
  const options = { json: false, strictActivation: false };
  for (const argument of argv) {
    if (argument === "--json") options.json = true;
    else if (argument === "--strict-activation") options.strictActivation = true;
    else {
      const error = new Error(`unknown argument: ${argument}`);
      error.exitCode = 2;
      throw error;
    }
  }
  return options;
}

function smokeTimeoutMs() {
  const value = Number(process.env.CATPAW_VERIFY_SMOKE_TIMEOUT_MS ?? 10000);
  return Number.isInteger(value) && value > 0 && value <= 60000
    ? value
    : 10000;
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

function safeManifestEntry(entry) {
  if (
    typeof entry !== "string" ||
    entry === "" ||
    entry.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(entry)
  ) return null;
  const directory = entry.endsWith("/");
  const value = directory ? entry.slice(0, -1) : entry;
  if (
    value === "" ||
    value === "." ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..")
  ) return null;
  return { value, directory };
}

function manifestPathContract(manifest) {
  const canonicalValues = manifest.canonicalFiles;
  const canonical = Array.isArray(canonicalValues)
    ? canonicalValues.map(safeManifestEntry)
    : [];
  const legacyValues = manifest.legacyRuntimePaths;
  const legacy = Array.isArray(legacyValues)
    ? legacyValues.map(safeManifestEntry)
    : [];
  const canonicalSafe = Array.isArray(canonicalValues) &&
    canonical.every((entry) => entry !== null && !entry.value.includes("/"));
  const legacySafe = Array.isArray(legacyValues) &&
    legacy.every((entry) =>
      entry !== null &&
      entry.directory &&
      !entry.value.includes("/") &&
      !entry.value.startsWith(".") &&
      !PROTECTED_LOCAL_ROOTS.has(entry.value.toLowerCase())
    );
  const allSafe = canonicalSafe &&
    Array.isArray(legacyValues) &&
    legacySafe;
  const values = [...canonical, ...legacy]
    .filter(Boolean)
    .map((entry) => entry.value.toLowerCase());
  const unique = new Set(values).size === values.length;
  const overlaps = canonical.filter(Boolean).some((current) =>
    legacy.filter(Boolean).some((retired) =>
      current.value.toLowerCase() === retired.value.toLowerCase() ||
      (current.directory && retired.value.toLowerCase().startsWith(
        `${current.value.toLowerCase()}/`,
      )) ||
      (retired.directory && current.value.toLowerCase().startsWith(
        `${retired.value.toLowerCase()}/`,
      ))
    )
  );
  return { canonical, legacy, safe: allSafe && unique && !overlaps };
}

async function listFiles(root) {
  const files = new Map();
  const directories = new Set([""]);
  async function visit(relativePath = "") {
    const entries = await readdir(path.join(root, relativePath), {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const child = path.join(relativePath, entry.name);
      const slashPath = child.split(path.sep).join("/");
      const target = path.join(root, child);
      const stats = await lstat(target);
      if (stats.isDirectory()) {
        directories.add(slashPath);
        await visit(child);
      } else if (stats.isFile()) {
        files.set(
          slashPath,
          createHash("sha256").update(await readFile(target)).digest("hex"),
        );
      } else {
        throw new Error(`Unsupported package entry: ${slashPath}`);
      }
    }
  }
  await visit();
  return { files, directories };
}

async function listManagedFiles(root, entries) {
  const files = new Map();
  const directories = new Set([""]);
  const visited = new Set();

  async function visit(relativePath) {
    if (visited.has(relativePath)) return;
    visited.add(relativePath);
    const target = path.join(root, relativePath);
    let stats;
    try {
      stats = await lstat(target);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return;
      throw error;
    }
    const slashPath = relativePath.split(path.sep).join("/");
    if (stats.isDirectory()) {
      directories.add(slashPath);
      const children = await readdir(target, { withFileTypes: true });
      children.sort((left, right) => left.name.localeCompare(right.name, "en"));
      for (const child of children) {
        await visit(path.join(relativePath, child.name));
      }
    } else if (stats.isFile()) {
      files.set(
        slashPath,
        createHash("sha256").update(await readFile(target)).digest("hex"),
      );
    } else {
      throw new Error(`Unsupported managed package entry: ${slashPath}`);
    }
  }

  for (const entry of entries) await visit(entry.value);
  return { files, directories };
}

async function localExtraRoots(root, entries) {
  const children = await readdir(root, { withFileTypes: true });
  return children
    .map((entry) => entry.name)
    .filter((name) => !entries.some((entry) =>
      entry.value === name || entry.value.startsWith(`${name}/`)
    ));
}

function packageDigest(files) {
  const hash = createHash("sha256");
  for (const [relativePath, digest] of [...files].sort(([left], [right]) =>
    left.localeCompare(right, "en")
  )) {
    hash.update(`${relativePath}\0${digest}\0`);
  }
  return hash.digest("hex");
}

function mapsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

function setsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function snapshotsEqual(left, right) {
  return left !== null && right !== null &&
    mapsEqual(left.files, right.files) &&
    setsEqual(left.directories, right.directories);
}

function covered(relativePath, entries) {
  return entries.some((entry) =>
    entry.directory
      ? relativePath === entry.value || relativePath.startsWith(`${entry.value}/`)
      : relativePath === entry.value
  );
}

function resolveCliEntrypoint(root, manifest) {
  const entry = safeManifestEntry(manifest.cli?.entrypoint);
  const canonical = Array.isArray(manifest.canonicalFiles)
    ? manifest.canonicalFiles.map(safeManifestEntry)
    : [];
  if (
    !entry ||
    entry.directory ||
    canonical.length === 0 ||
    !canonical.every(Boolean) ||
    !covered(entry.value, canonical)
  ) return null;
  const resolved = path.resolve(root, entry.value);
  return inside(root, resolved) ? resolved : null;
}

async function packageSnapshot(label, root, manifest, record, options = {}) {
  if (!(await exists(root))) {
    record(`${label} package root`, false, root);
    return null;
  }
  const canonicalValues = manifest?.canonicalFiles;
  const entries = Array.isArray(canonicalValues)
    ? canonicalValues.map(safeManifestEntry)
    : [];
  const safe = Array.isArray(canonicalValues) &&
    entries.length > 0 &&
    entries.every(Boolean) &&
    new Set(entries.filter(Boolean).map((entry) => entry.value)).size === entries.length;
  record(`${label} manifest paths`, safe, `${entries.length} canonical entries`);
  if (!safe) return null;

  const preserveLocalExtras = options.preserveLocalExtras === true;
  const snapshot = preserveLocalExtras
    ? await listManagedFiles(root, entries)
    : await listFiles(root);
  const missing = [];
  for (const entry of entries) {
    if (entry.directory) {
      if (!snapshot.directories.has(entry.value)) missing.push(`${entry.value}/`);
    } else if (!snapshot.files.has(entry.value)) {
      missing.push(entry.value);
    }
  }
  const undeclared = preserveLocalExtras
    ? await localExtraRoots(root, entries)
    : [...new Set([
        ...snapshot.files.keys(),
        ...[...snapshot.directories].filter(Boolean),
      ])].filter((relativePath) => !covered(relativePath, entries));
  const files = snapshot.files;
  record(
    `${label} canonical coverage`,
    missing.length === 0 && (preserveLocalExtras || undeclared.length === 0),
    preserveLocalExtras
      ? `missing=${missing.length}, localExtras=${undeclared.length}`
      : `missing=${missing.length}, undeclared=${undeclared.length}`,
  );
  return {
    ...snapshot,
    files,
    hash: packageDigest(files),
    missing,
    undeclared,
  };
}

async function markdownFiles(root, relativePath) {
  const target = path.join(root, relativePath);
  const stats = await lstat(target);
  if (stats.isFile()) return relativePath.endsWith(".md") ? [relativePath] : [];
  const files = [];
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en")
  )) {
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(root, child)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(child);
  }
  return files;
}

async function brokenActiveLinks(root) {
  const physicalRoot = await realpath(root);
  const files = [];
  for (const activeRoot of ACTIVE_DOC_ROOTS) {
    const target = path.join(root, activeRoot);
    if (await exists(target)) files.push(...(await markdownFiles(root, activeRoot)));
  }
  const broken = [];
  for (const file of files) {
    const text = await readFile(path.join(root, file), "utf8");
    for (const match of text.matchAll(/\[[^\]\n]+]\(([^)]+)\)/g)) {
      const target = match[1].split(/[?#]/, 1)[0];
      if (
        target === "" ||
        /^(?:https?|mailto):/i.test(target)
      ) continue;
      if (
        target.startsWith("/") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)
      ) {
        broken.push(`${file} -> ${match[1]}`);
        continue;
      }
      if (target.includes("{{")) continue;
      const resolved = path.resolve(root, path.dirname(file), target);
      if (!inside(root, resolved) || !(await exists(resolved))) {
        broken.push(`${file} -> ${match[1]}`);
        continue;
      }
      const physicalTarget = await realpath(resolved);
      if (!inside(physicalRoot, physicalTarget)) {
        broken.push(`${file} -> ${match[1]}`);
      }
    }
  }
  return broken;
}

function subprocess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 16 * 1024 * 1024,
    timeout: options.timeout,
    killSignal: "SIGKILL",
  });
  if (result.error) {
    return {
      ok: false,
      detail: result.error.code === "ETIMEDOUT"
        ? `timed out after ${options.timeout}ms`
        : result.error.message,
    };
  }
  return {
    ok: result.status === 0,
    detail: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    stdout: result.stdout,
  };
}

async function verifyCliBehavior(label, root, manifest, record, options = {}) {
  if (options.enabled === false) {
    record(
      `${label} CLI behavior`,
      false,
      `skipped: ${options.reason ?? "package precondition failed"}`,
    );
    return false;
  }
  const cli = resolveCliEntrypoint(root, manifest);
  if (cli === null) {
    record(`${label} CLI behavior`, false, "skipped: unsafe CLI entrypoint");
    return false;
  }
  const sandbox = await mkdtemp(path.join(os.tmpdir(), `catpaw-${label}-smoke-`));
  try {
    const project = path.join(sandbox, "project");
    await mkdir(project);
    const env = { CATPAW_HOME: path.join(sandbox, "home") };
    const initialized = subprocess(process.execPath, [
      cli,
      "board",
      "init",
      "--project",
      project,
      "--apply",
      "--json",
    ], { env, timeout: smokeTimeoutMs() });
    let initReport = null;
    try {
      initReport = initialized.stdout ? JSON.parse(initialized.stdout) : null;
    } catch {
      // The check below reports the malformed output.
    }
    const status = initialized.ok
      ? subprocess(process.execPath, [
          cli,
          "board",
          "status",
          "--project",
          project,
          "--json",
        ], { env, timeout: smokeTimeoutMs() })
      : { ok: false, detail: "init failed", stdout: "" };
    let statusReport = null;
    try {
      statusReport = status.stdout ? JSON.parse(status.stdout) : null;
    } catch {
      // The check below reports the malformed output.
    }
    const initOk = initialized.ok &&
      initReport?.schema === manifest.boardSchemaVersion &&
      ["applied", "noop"].includes(initReport?.status);
    const statusOk = status.ok &&
      statusReport?.schema === manifest.boardSchemaVersion &&
      Array.isArray(statusReport?.findings) &&
      !statusReport.findings.some((item) => item.severity === "error");
    const ok = initOk && statusOk;
    const detail = ok
      ? "board init/status schema 2 smoke"
      : !initialized.ok
        ? initialized.detail
        : !initOk
          ? "init returned unusable schema 2 output"
          : !status.ok
            ? status.detail
            : "status returned unusable schema 2 output";
    record(
      `${label} CLI behavior`,
      ok,
      detail,
    );
    return ok;
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

async function installedReport(sourceVersion, sourceManifest, sourceSnapshot, options, record) {
  const versionPath = path.join(roots.installed, "VERSION");
  if (!(await exists(versionPath))) {
    const status = "not-installed";
    record(
      "installed activation",
      !options.strictActivation,
      `${status}; expected ${sourceVersion}`,
    );
    return { root: roots.installed, version: null, status, matchesSource: false };
  }
  const version = (await readFile(versionPath, "utf8")).trim();
  if (version !== sourceVersion) {
    const status = "pending-activation";
    record(
      "installed activation",
      !options.strictActivation,
      `${version} -> ${sourceVersion} pending activation`,
    );
    return { root: roots.installed, version, status, matchesSource: false };
  }
  const snapshot = await packageSnapshot(
    "installed",
    roots.installed,
    sourceManifest,
    record,
    { preserveLocalExtras: true },
  );
  const managedParity = snapshotsEqual(snapshot, sourceSnapshot);
  const paths = manifestPathContract(sourceManifest);
  const retiredPresent = [];
  if (paths.safe) {
    for (const entry of paths.legacy) {
      if (await pathExists(path.join(roots.installed, entry.value))) {
        retiredPresent.push(`${entry.value}${entry.directory ? "/" : ""}`);
      }
    }
  }
  record(
    "installed retired paths",
    paths.safe && retiredPresent.length === 0,
    paths.safe
      ? retiredPresent.length === 0 ? "none" : retiredPresent.join(", ")
      : "invalid runtime path contract",
  );
  const installedCli = resolveCliEntrypoint(roots.installed, sourceManifest);
  const cliExecutable = installedCli !== null && await exists(installedCli) &&
    ((await stat(installedCli)).mode & 0o111) !== 0;
  record(
    "installed CLI executable",
    cliExecutable,
    sourceManifest.cli.entrypoint,
  );
  const installedLinks = managedParity
    ? await brokenActiveLinks(roots.installed)
    : null;
  const linksOk = installedLinks !== null && installedLinks.length === 0;
  record(
    "installed active links",
    linksOk,
    installedLinks === null
      ? "skipped: managed parity failed"
      : `${installedLinks.length} broken`,
  );
  const smokeReady = managedParity &&
    paths.safe &&
    retiredPresent.length === 0 &&
    cliExecutable &&
    linksOk;
  const smokeReason = !managedParity
    ? "managed parity failed"
    : !paths.safe
      ? "runtime path contract failed"
      : retiredPresent.length > 0
        ? "retired runtime paths remain"
        : !cliExecutable
          ? "CLI executable check failed"
          : "active link check failed";
  const cliBehavior = await verifyCliBehavior(
    "installed",
    roots.installed,
    sourceManifest,
    record,
    { enabled: smokeReady, reason: smokeReason },
  );
  const matchesSource = managedParity &&
    paths.safe &&
    retiredPresent.length === 0 &&
    cliExecutable &&
    linksOk &&
    cliBehavior;
  const status = matchesSource ? "current" : "drift";
  record("installed activation", matchesSource, status);
  return { root: roots.installed, version, status, matchesSource };
}

async function verify(options) {
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });
  const sourceManifest = JSON.parse(
    await readFile(path.join(roots.source, "runtime-manifest.json"), "utf8"),
  );
  const sourcePaths = manifestPathContract(sourceManifest);
  record(
    "runtime path contract",
    sourcePaths.safe,
    `${sourcePaths.canonical.length} canonical / ${sourcePaths.legacy.length} retired`,
  );
  const sourceVersion = (await readFile(path.join(roots.source, "VERSION"), "utf8")).trim();
  record(
    "source version contract",
    sourceVersion === sourceManifest.version,
    `${sourceVersion} / ${sourceManifest.version}`,
  );
  const schema = JSON.parse(
    await readFile(path.join(roots.source, "schemas", "board-v2.json"), "utf8"),
  );
  record(
    "board schema contract",
    sourceManifest.boardSchemaVersion === 2 &&
      schema.schemaVersion === sourceManifest.boardSchemaVersion,
    `${sourceManifest.boardSchemaVersion} / ${schema.schemaVersion}`,
  );

  const sourceSnapshot = await packageSnapshot(
    "source",
    roots.source,
    sourceManifest,
    record,
  );
  const sourceLinks = await brokenActiveLinks(roots.source);
  record("source active links", sourceLinks.length === 0, `${sourceLinks.length} broken`);
  const sourceCli = resolveCliEntrypoint(roots.source, sourceManifest);
  const sourceExecutable = sourceCli !== null && await exists(sourceCli) &&
    ((await stat(sourceCli)).mode & 0o111) !== 0;
  record("source CLI executable", sourceExecutable, sourceManifest.cli.entrypoint);
  const sourceReady = sourcePaths.safe &&
    sourceSnapshot !== null &&
    sourceSnapshot.missing.length === 0 &&
    sourceSnapshot.undeclared.length === 0 &&
    sourceExecutable &&
    sourceLinks.length === 0;
  await verifyCliBehavior("source", roots.source, sourceManifest, record, {
    enabled: sourceReady,
    reason: "source package precondition failed",
  });

  const distManifestPath = path.join(roots.dist, "runtime-manifest.json");
  let distManifest = null;
  if (await exists(distManifestPath)) {
    distManifest = JSON.parse(await readFile(distManifestPath, "utf8"));
  }
  record(
    "dist manifest contract",
    distManifest?.version === sourceManifest.version &&
      distManifest?.boardSchemaVersion === sourceManifest.boardSchemaVersion,
    distManifest?.version ?? "missing",
  );
  const distSnapshot = distManifest
    ? await packageSnapshot("dist", roots.dist, sourceManifest, record)
    : null;
  const matchesSource = sourceSnapshot !== null &&
    distSnapshot !== null &&
    snapshotsEqual(sourceSnapshot, distSnapshot);
  record("source/dist hashes", matchesSource, matchesSource ? sourceSnapshot.hash : "drift");
  const distLinks = distManifest ? await brokenActiveLinks(roots.dist) : ["missing dist"];
  record("dist active links", distLinks.length === 0, `${distLinks.length} broken`);
  if (distManifest) {
    await verifyCliBehavior("dist", roots.dist, sourceManifest, record, {
      enabled: matchesSource && distLinks.length === 0,
      reason: "source/dist parity failed",
    });
  }

  const installed = await installedReport(
    sourceVersion,
    sourceManifest,
    sourceSnapshot,
    options,
    record,
  );
  const failed = checks.filter((item) => !item.ok);
  return {
    status: failed.length === 0 ? "pass" : "fail",
    strictActivation: options.strictActivation,
    source: {
      root: roots.source,
      version: sourceVersion,
      boardSchemaVersion: sourceManifest.boardSchemaVersion,
      hash: sourceSnapshot?.hash ?? null,
    },
    dist: {
      root: roots.dist,
      version: distManifest?.version ?? null,
      hash: distSnapshot?.hash ?? null,
      matchesSource,
    },
    installed,
    checks,
    summary: {
      passed: checks.length - failed.length,
      failed: failed.length,
      total: checks.length,
    },
  };
}

function render(report) {
  const lines = report.checks.map(
    (item) => `${item.ok ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`,
  );
  lines.push(
    `Installed: ${report.installed.status}`,
    `Result: ${report.status.toUpperCase()} (${report.summary.passed}/${report.summary.total})`,
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`verify-runtime: ${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
    return;
  }
  try {
    const report = await verify(options);
    process.stdout.write(
      options.json ? `${JSON.stringify(report, null, 2)}\n` : render(report),
    );
    if (report.status === "fail") process.exitCode = 1;
  } catch (error) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        status: "fail",
        error: { code: error.code ?? "ERR_VERIFY", message: error.message },
      }, null, 2)}\n`);
    } else {
      process.stderr.write(`${error.stack ?? error.message}\n`);
    }
    process.exitCode = 1;
  }
}

await main();
