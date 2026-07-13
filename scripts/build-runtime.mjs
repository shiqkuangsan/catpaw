#!/usr/bin/env node

import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(scriptPath),
  "..",
);
const sourceRoot = path.join(repoRoot, "src", "runtime");
const distRoot = path.join(repoRoot, "dist", "runtime");
const PROTECTED_LOCAL_ROOTS = new Set(["backups", "state"]);

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function canonicalPath(entry, field = "canonicalFiles") {
  if (
    typeof entry !== "string" ||
    entry === "" ||
    entry.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(entry)
  ) {
    throw new Error(`Unsafe runtime-manifest ${field} entry: ${entry}`);
  }
  const directory = entry.endsWith("/");
  const value = directory ? entry.slice(0, -1) : entry;
  if (
    value === "" ||
    value === "." ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..")
  ) {
    throw new Error(`Unsafe runtime-manifest ${field} entry: ${entry}`);
  }
  return { entry, value, directory };
}

async function kind(target) {
  const stats = await lstat(target);
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "special";
}

async function assertRegularTree(root, relativePath) {
  const target = path.join(root, relativePath);
  const targetKind = await kind(target);
  if (targetKind === "file") return;
  if (targetKind !== "directory") {
    throw new Error(`Unsupported runtime package entry: ${relativePath} (${targetKind})`);
  }
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    await assertRegularTree(root, path.join(relativePath, entry.name));
  }
}

export function validateRuntimeManifestPaths(manifest) {
  if (
    manifest?.name !== "catpaw-runtime" ||
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    !Number.isInteger(manifest.boardSchemaVersion) ||
    !Array.isArray(manifest.canonicalFiles) ||
    !Array.isArray(manifest.legacyRuntimePaths) ||
    typeof manifest.cli?.entrypoint !== "string" ||
    !Array.isArray(manifest.cli?.commands)
  ) {
    throw new Error("runtime-manifest.json has an invalid package contract.");
  }
  const entries = manifest.canonicalFiles.map((entry) =>
    canonicalPath(entry, "canonicalFiles")
  );
  const retired = manifest.legacyRuntimePaths.map((entry) =>
    canonicalPath(entry, "legacyRuntimePaths")
  );
  if (entries.some((item) => item.value.includes("/"))) {
    throw new Error("runtime-manifest canonicalFiles entries must be top-level.");
  }
  if (new Set(entries.map((item) => item.value)).size !== entries.length) {
    throw new Error("runtime-manifest canonicalFiles entries must be unique.");
  }
  if (retired.some((item) =>
    !item.directory ||
    item.value.includes("/") ||
    item.value.startsWith(".") ||
    PROTECTED_LOCAL_ROOTS.has(item.value.toLowerCase())
  )) {
    throw new Error(
      "runtime-manifest legacyRuntimePaths entries must be unprotected top-level directories.",
    );
  }
  const allPaths = [...entries, ...retired].map((item) =>
    item.value.toLowerCase()
  );
  if (new Set(allPaths).size !== allPaths.length) {
    throw new Error(
      "runtime-manifest canonicalFiles and legacyRuntimePaths must not overlap.",
    );
  }
  return entries;
}

async function validateManifest(manifest) {
  const entries = validateRuntimeManifestPaths(manifest);
  const version = (await readFile(path.join(sourceRoot, "VERSION"), "utf8")).trim();
  if (version !== manifest.version) {
    throw new Error(`VERSION ${version} does not match manifest ${manifest.version}.`);
  }

  const declaredTopLevel = new Set(entries.map((item) => item.value.split("/")[0]));
  const actualTopLevel = (await readdir(sourceRoot)).sort();
  const undeclared = actualTopLevel.filter((item) => !declaredTopLevel.has(item));
  if (undeclared.length > 0) {
    throw new Error(`Runtime source has undeclared top-level entries: ${undeclared.join(", ")}`);
  }

  for (const item of entries) {
    const target = path.join(sourceRoot, item.value);
    if (!inside(sourceRoot, target)) throw new Error(`Path escapes source root: ${item.entry}`);
    const targetKind = await kind(target);
    if (item.directory ? targetKind !== "directory" : targetKind !== "file") {
      throw new Error(`Canonical entry type mismatch: ${item.entry} (${targetKind})`);
    }
    await assertRegularTree(sourceRoot, item.value);
  }

  const entrypoint = canonicalPath(manifest.cli.entrypoint, "cli.entrypoint").value;
  const entrypointPath = path.join(sourceRoot, entrypoint);
  if (!inside(sourceRoot, entrypointPath) || await kind(entrypointPath) !== "file") {
    throw new Error(`Missing CLI entrypoint: ${manifest.cli.entrypoint}`);
  }
  if (!entries.some((item) =>
    item.value === entrypoint ||
    (item.directory && entrypoint.startsWith(`${item.value}/`))
  )) {
    throw new Error(`CLI entrypoint is not canonical: ${manifest.cli.entrypoint}`);
  }
  return entries;
}

async function copyEntry(item) {
  const sourcePath = path.join(sourceRoot, item.value);
  const distPath = path.join(distRoot, item.value);
  if (!inside(distRoot, distPath)) throw new Error(`Path escapes dist root: ${item.entry}`);
  await mkdir(path.dirname(distPath), { recursive: true });
  await cp(sourcePath, distPath, {
    recursive: item.directory,
    force: true,
    errorOnExist: false,
  });
}

async function main() {
  const manifest = JSON.parse(
    await readFile(path.join(sourceRoot, "runtime-manifest.json"), "utf8"),
  );
  const entries = await validateManifest(manifest);

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  for (const entry of entries) await copyEntry(entry);

  const distEntrypoint = path.join(distRoot, manifest.cli.entrypoint);
  await chmod(distEntrypoint, 0o755);
  for (const entry of entries) await assertRegularTree(distRoot, entry.value);

  console.log(`Built CatPaw runtime ${manifest.version} at ${distRoot}`);
  console.log(`Board schema: ${manifest.boardSchemaVersion}`);
  console.log(`Copied ${entries.length} canonical entries.`);
  console.log(`CLI: ${manifest.cli.entrypoint} (${manifest.cli.commands.length} command groups).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
