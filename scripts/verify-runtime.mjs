#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repoRoot, "src", "runtime");
const distRoot = path.join(repoRoot, "dist", "runtime");
const installedRoot = path.join(process.env.HOME ?? "", ".catpaw");

const checks = [];

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readText(target) {
  return readFile(target, "utf8");
}

async function readJson(target) {
  return JSON.parse(await readText(target));
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes ${parent}: ${child}`);
  }
}

function assertSafeManifestPath(entry) {
  if (!entry || entry.startsWith("/") || entry.includes("..")) {
    throw new Error(`Unsafe manifest path: ${entry}`);
  }
}

async function verifyPackageRoot(label, root, manifest) {
  if (!(await pathExists(root))) {
    record(`${label} root`, false, root);
    return;
  }
  record(`${label} root`, true, root);

  for (const entry of manifest.canonicalFiles) {
    assertSafeManifestPath(entry);
    const target = path.join(root, entry);
    assertInside(root, target);
    record(`${label} canonical ${entry}`, await pathExists(target), entry);
  }

  for (const commandName of manifest.commands ?? []) {
    const target = path.join(root, "commands", `${commandName}.md`);
    assertInside(root, target);
    record(`${label} command ${commandName}`, await pathExists(target), commandName);
  }
}

async function verifyVersions(sourceManifest) {
  const sourceVersion = (await readText(path.join(sourceRoot, "VERSION"))).trim();
  const runtimeReadme = await readText(path.join(sourceRoot, "README.md"));
  record(
    "source VERSION matches manifest",
    sourceVersion === sourceManifest.version,
    `${sourceVersion} / ${sourceManifest.version}`,
  );
  record(
    "source README version is current",
    runtimeReadme.includes(`Current runtime version: \`${sourceVersion}\`.`),
    sourceVersion,
  );

  if (await pathExists(path.join(distRoot, "VERSION"))) {
    const distVersion = (await readText(path.join(distRoot, "VERSION"))).trim();
    const distManifest = await readJson(path.join(distRoot, "runtime-manifest.json"));
    record("dist VERSION matches source", distVersion === sourceVersion, distVersion);
    record(
      "dist manifest matches source",
      distManifest.version === sourceManifest.version,
      distManifest.version,
    );
  }

  if (await pathExists(path.join(installedRoot, "VERSION"))) {
    const installedVersion = (await readText(path.join(installedRoot, "VERSION"))).trim();
    const installedManifest = await readJson(
      path.join(installedRoot, "runtime-manifest.json"),
    );
    record(
      "installed VERSION matches source",
      installedVersion === sourceVersion,
      installedVersion,
    );
    record(
      "installed manifest matches source",
      installedManifest.version === sourceManifest.version,
      installedManifest.version,
    );
  } else {
    record("installed runtime exists", false, installedRoot);
  }
}

async function verifyProtocolInvariants(rootLabel, root) {
  const files = {
    policy: path.join(root, "runtime-policy.md"),
    provider: path.join(root, "commands", "provider.md"),
    status: path.join(root, "commands", "status.md"),
    doctor: path.join(root, "commands", "doctor.md"),
    registryDoctor: path.join(root, "commands", "registry-doctor.md"),
    testMatrix: path.join(root, "templates", "test-matrix.md"),
  };

  if (!(await pathExists(files.policy))) return;

  const policy = await readText(files.policy);
  const status = await readText(files.status);
  const doctor = await readText(files.doctor);
  const registryDoctor = await readText(files.registryDoctor);
  const testMatrix = await readText(files.testMatrix);

  record(
    `${rootLabel} lifecycle role routing`,
    policy.includes("Lifecycle role routing"),
    "runtime-policy.md",
  );
  record(
    `${rootLabel} progress handoff`,
    policy.includes("Progress Handoff Contract"),
    "runtime-policy.md",
  );
  record(
    `${rootLabel} provider command exists`,
    await pathExists(files.provider),
    "commands/provider.md",
  );
  record(
    `${rootLabel} status read-only wording`,
    status.includes("Project-artifact read-only"),
    "commands/status.md",
  );
  record(
    `${rootLabel} doctor read-only wording`,
    doctor.includes("Project-artifact read-only"),
    "commands/doctor.md",
  );
  record(
    `${rootLabel} registry discover report-only`,
    registryDoctor.includes("never\nauto-registers discovered boards") ||
      registryDoctor.includes("never auto-registers discovered boards"),
    "commands/registry-doctor.md",
  );
  record(
    `${rootLabel} test matrix req link`,
    testMatrix.includes("Req: ../../reqs/"),
    "templates/test-matrix.md",
  );
  record(
    `${rootLabel} test matrix plan link`,
    testMatrix.includes("Plan: ../../plans/"),
    "templates/test-matrix.md",
  );
}

function frontmatterRuntime(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const match = text.slice(4, end).match(/^runtime:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

async function verifyRegistry(installedVersion) {
  const registryPath = path.join(installedRoot, "state", "projects.json");
  if (!(await pathExists(registryPath))) {
    record("registry exists", true, "not present; no registered boards");
    return;
  }

  const registry = await readJson(registryPath);
  const projects = registry.projects ?? [];
  let current = 0;
  let missing = 0;
  let mismatched = 0;
  let activeDone = 0;
  let badMatrixLinks = 0;

  for (const project of projects) {
    const boardPath = project.boardPath;
    if (!(await pathExists(boardPath))) {
      missing += 1;
      continue;
    }

    const indexPath = path.join(boardPath, "index.md");
    const indexText = await readText(indexPath);
    const indexRuntime = frontmatterRuntime(indexText);
    if (project.stamp === installedVersion && indexRuntime === installedVersion) {
      current += 1;
    } else {
      mismatched += 1;
    }

    const activeDir = path.join(boardPath, "plans", "active");
    if (await pathExists(activeDir)) {
      for (const fileName of await readdir(activeDir)) {
        if (!fileName.endsWith(".md")) continue;
        const text = await readText(path.join(activeDir, fileName));
        if (/^status:\s*(done|cancelled)\s*$/m.test(text)) activeDone += 1;
      }
    }

    const matrixDir = path.join(boardPath, "tests", "matrices");
    if (await pathExists(matrixDir)) {
      for (const fileName of await readdir(matrixDir)) {
        if (!fileName.endsWith(".md")) continue;
        const text = await readText(path.join(matrixDir, fileName));
        if (/(?:Req:\s+\.\.\/reqs\/|Plan:\s+\.\.\/plans\/)/.test(text)) {
          badMatrixLinks += 1;
        }
      }
    }
  }

  record(
    "registry boards current",
    current === projects.length && missing === 0 && mismatched === 0,
    `${current}/${projects.length} current, ${missing} missing, ${mismatched} mismatched`,
  );
  record(
    "registry active plans are active",
    activeDone === 0,
    `${activeDone} done/cancelled plans under plans/active`,
  );
  record(
    "registry test matrix links",
    badMatrixLinks === 0,
    `${badMatrixLinks} old test matrix links`,
  );
}

async function main() {
  const sourceManifest = await readJson(path.join(sourceRoot, "runtime-manifest.json"));
  await verifyVersions(sourceManifest);
  await verifyPackageRoot("source", sourceRoot, sourceManifest);
  await verifyPackageRoot("dist", distRoot, sourceManifest);
  await verifyPackageRoot("installed", installedRoot, sourceManifest);
  await verifyProtocolInvariants("source", sourceRoot);
  await verifyProtocolInvariants("dist", distRoot);
  await verifyProtocolInvariants("installed", installedRoot);

  const installedVersion = (await pathExists(path.join(installedRoot, "VERSION")))
    ? (await readText(path.join(installedRoot, "VERSION"))).trim()
    : null;
  if (installedVersion) await verifyRegistry(installedVersion);

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  console.log(
    `Result: ${failed.length === 0 ? "PASS" : "FAIL"} (${checks.length - failed.length}/${checks.length})`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
