#!/usr/bin/env node

import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repoRoot, "src", "runtime");
const distRoot = path.join(repoRoot, "dist", "runtime");
const manifestPath = path.join(sourceRoot, "runtime-manifest.json");

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${parent}: ${child}`);
  }
}

function assertSafeManifestPath(entry) {
  if (!entry || entry.startsWith("/") || entry.includes("..")) {
    throw new Error(`Unsafe runtime-manifest canonicalFiles entry: ${entry}`);
  }
}

async function copyCanonicalEntry(entry) {
  assertSafeManifestPath(entry);

  const sourcePath = path.join(sourceRoot, entry);
  const distPath = path.join(distRoot, entry);
  assertInside(sourceRoot, sourcePath);
  assertInside(distRoot, distPath);

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Missing canonical runtime source: ${entry}`);
  }

  await mkdir(path.dirname(distPath), { recursive: true });
  await cp(sourcePath, distPath, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

async function verifyBuiltPackage(manifest) {
  for (const entry of manifest.canonicalFiles) {
    const builtPath = path.join(distRoot, entry);
    assertInside(distRoot, builtPath);
    if (!(await pathExists(builtPath))) {
      throw new Error(`Missing built runtime package entry: ${entry}`);
    }
  }

  for (const commandName of manifest.commands ?? []) {
    const commandPath = path.join(distRoot, "commands", `${commandName}.md`);
    assertInside(distRoot, commandPath);
    if (!(await pathExists(commandPath))) {
      throw new Error(`Missing command declared in manifest: ${commandName}`);
    }
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.canonicalFiles)) {
    throw new Error("runtime-manifest.json must define canonicalFiles[]");
  }

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  for (const entry of manifest.canonicalFiles) {
    await copyCanonicalEntry(entry);
  }

  await verifyBuiltPackage(manifest);

  console.log(`Built CatPaw runtime ${manifest.version} at ${distRoot}`);
  console.log(`Copied ${manifest.canonicalFiles.length} canonical entries.`);
  console.log(`Verified ${manifest.commands?.length ?? 0} commands.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
