#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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

async function exists(target) {
  try {
    await stat(target);
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
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..")
  ) return null;
  return { value, directory };
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

function covered(relativePath, entries) {
  return entries.some((entry) =>
    entry.directory
      ? relativePath.startsWith(`${entry.value}/`)
      : relativePath === entry.value
  );
}

async function packageSnapshot(label, root, manifest, record) {
  if (!(await exists(root))) {
    record(`${label} package root`, false, root);
    return null;
  }
  const entries = manifest.canonicalFiles.map(safeManifestEntry);
  const safe = entries.every(Boolean) &&
    new Set(entries.filter(Boolean).map((entry) => entry.value)).size === entries.length;
  record(`${label} manifest paths`, safe, `${entries.length} canonical entries`);
  if (!safe) return null;

  const snapshot = await listFiles(root);
  const missing = [];
  for (const entry of entries) {
    if (entry.directory) {
      if (!snapshot.directories.has(entry.value)) missing.push(`${entry.value}/`);
    } else if (!snapshot.files.has(entry.value)) {
      missing.push(entry.value);
    }
  }
  const undeclared = [...snapshot.files.keys()].filter(
    (relativePath) => !covered(relativePath, entries),
  );
  record(
    `${label} canonical coverage`,
    missing.length === 0 && undeclared.length === 0,
    `missing=${missing.length}, undeclared=${undeclared.length}`,
  );
  return {
    ...snapshot,
    hash: packageDigest(snapshot.files),
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
        target.includes("{{") ||
        target.startsWith("/") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)
      ) continue;
      const resolved = path.resolve(root, path.dirname(file), target);
      if (!(await exists(resolved))) broken.push(`${file} -> ${match[1]}`);
    }
  }
  return broken;
}

function subprocess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) return { ok: false, detail: result.error.message };
  return {
    ok: result.status === 0,
    detail: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    stdout: result.stdout,
  };
}

async function verifyCliBehavior(label, root, manifest, record) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), `catpaw-${label}-smoke-`));
  try {
    const project = path.join(sandbox, "project");
    await mkdir(project);
    const cli = path.join(root, manifest.cli.entrypoint);
    const env = { CATPAW_HOME: path.join(sandbox, "home") };
    const initialized = subprocess(process.execPath, [
      cli,
      "board",
      "init",
      "--project",
      project,
      "--apply",
      "--json",
    ], { env });
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
        ], { env })
      : { ok: false, detail: "init failed", stdout: "" };
    let statusReport = null;
    try {
      statusReport = status.stdout ? JSON.parse(status.stdout) : null;
    } catch {
      // The check below reports the malformed output.
    }
    const ok = initialized.ok &&
      initReport?.schema === manifest.boardSchemaVersion &&
      ["applied", "noop"].includes(initReport?.status) &&
      status.ok &&
      statusReport?.schema === manifest.boardSchemaVersion &&
      !statusReport.findings?.some((item) => item.severity === "error");
    record(
      `${label} CLI behavior`,
      ok,
      ok ? "board init/status schema 2 smoke" : initialized.detail || status.detail,
    );
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
  );
  const matchesSource = snapshot !== null && mapsEqual(snapshot.files, sourceSnapshot.files);
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
  const sourceCli = path.join(roots.source, sourceManifest.cli.entrypoint);
  const sourceExecutable = await exists(sourceCli) &&
    ((await stat(sourceCli)).mode & 0o111) !== 0;
  record("source CLI executable", sourceExecutable, sourceManifest.cli.entrypoint);
  await verifyCliBehavior("source", roots.source, sourceManifest, record);

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
    mapsEqual(sourceSnapshot.files, distSnapshot.files);
  record("source/dist hashes", matchesSource, matchesSource ? sourceSnapshot.hash : "drift");
  const distLinks = distManifest ? await brokenActiveLinks(roots.dist) : ["missing dist"];
  record("dist active links", distLinks.length === 0, `${distLinks.length} broken`);
  if (distManifest) await verifyCliBehavior("dist", roots.dist, sourceManifest, record);

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
