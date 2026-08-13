import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadRoleCatalog,
  validateRoleCatalog,
} from "../src/runtime/lib/role-catalog.mjs";

const CLI = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("Role Catalog defines six composable responsibility contracts", async () => {
  const catalog = await loadRoleCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.catalogVersion, "1.0.0");
  assert.equal(catalog.decisionOwner, "agent-executor");
  assert.deepEqual(catalog.roles.map((role) => role.id), [
    "scout",
    "architect",
    "builder",
    "reviewer",
    "verifier",
    "integrator",
  ]);
  assert.equal(catalog.composition.oneAgentMayHoldMultipleRoles, true);
  assert.equal(catalog.composition.oneRoleMayHaveMultipleAgents, true);
  assert.equal(
    catalog.composition.requiredIndependenceRequiresDistinctActor,
    true,
  );
  for (const role of catalog.roles) {
    assert.ok(role.intent);
    assert.ok(role.requiredInputs.length > 0);
    assert.ok(role.deliverables.length > 0);
    assert.ok(role.authorityCeiling.length > 0);
    assert.ok(role.handoffEdges.length > 0);
    assert.ok(role.stopAndEscalation.length > 0);
    assert.ok(role.antiPatterns.length > 0);
    assert.ok(role.defaultSideEffects.writes);
    assert.ok(role.defaultSideEffects.git);
    assert.ok(role.concurrencyProfile.hardConstraint);
    for (const forbidden of ["model", "provider", "agentCount", "executionGraph"] ) {
      assert.equal(Object.hasOwn(role, forbidden), false, `${role.id}.${forbidden}`);
    }
  }
  assert.equal(
    catalog.roles.find((role) => role.id === "builder")
      .independenceEligibility.requiredCheck,
    false,
  );
  assert.equal(
    catalog.roles.find((role) => role.id === "reviewer")
      .independenceEligibility.requiredCheck,
    true,
  );
});

test("Role Catalog validator rejects ownership and semantic-reference drift", async () => {
  const catalog = structuredClone(await loadRoleCatalog());
  catalog.roles[1].id = catalog.roles[0].id;
  assert.throws(() => validateRoleCatalog(catalog), /role ids must be unique/i);

  const wrongOwner = structuredClone(await loadRoleCatalog());
  wrongOwner.decisionOwner = "catpaw";
  assert.throws(
    () => validateRoleCatalog(wrongOwner),
    /decisionOwner must be agent-executor/i,
  );

  const missingCore = structuredClone(await loadRoleCatalog());
  missingCore.roles = missingCore.roles.filter((role) => role.id !== "verifier");
  assert.throws(
    () => validateRoleCatalog(missingCore),
    /missing core roles: verifier/i,
  );

  const badHandoff = structuredClone(await loadRoleCatalog());
  badHandoff.roles[0].handoffEdges.push("ghost");
  assert.throws(
    () => validateRoleCatalog(badHandoff),
    /handoffEdges references unknown roles: ghost/i,
  );

  const badLens = structuredClone(await loadRoleCatalog());
  badLens.roles[0].compatibleLenses.push("style");
  assert.throws(
    () => validateRoleCatalog(badLens),
    /compatibleLenses references unknown lenses: style/i,
  );

  const badGitPolicy = structuredClone(await loadRoleCatalog());
  badGitPolicy.roles[0].defaultSideEffects.git = "allowed";
  assert.throws(
    () => validateRoleCatalog(badGitPolicy),
    /defaultSideEffects is invalid/i,
  );

  const badConcurrency = structuredClone(await loadRoleCatalog());
  badConcurrency.roles[0].concurrencyProfile.mode = "unbounded";
  assert.throws(
    () => validateRoleCatalog(badConcurrency),
    /concurrencyProfile is invalid/i,
  );

  const badAuthority = structuredClone(await loadRoleCatalog());
  badAuthority.composition.effectiveAuthority = "executor decides everything";
  assert.throws(
    () => validateRoleCatalog(badAuthority),
    /composition contract is invalid/i,
  );
});

test("agent roles and agent role discover contracts without provider or writes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-role-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = await readdir(root);

  const listed = await runCli(["agent", "roles", "--project", root, "--json"]);
  assert.equal(listed.code, 0, listed.stderr);
  assert.equal(listed.stderr, "");
  const listReport = JSON.parse(listed.stdout);
  assert.equal(listReport.command, "agent roles");
  assert.equal(listReport.decisionOwner, "agent-executor");
  assert.equal(listReport.roles.length, 6);

  const shown = await runCli(["agent", "role", "--role", "builder"]);
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /Agent Role: Builder/);
  assert.match(shown.stdout, /Decision owner: agent-executor/);
  assert.match(shown.stdout, /bounded local commits/i);
  assert.match(shown.stdout, /Evidence obligations:/);
  assert.match(shown.stdout, /Independence conditions:/);
  assert.match(shown.stdout, /Handoff edges:/);
  assert.match(shown.stdout, /Stop and escalation:/);
  assert.match(shown.stdout, /Compatible Lenses:/);
  assert.match(shown.stdout, /Anti-patterns:/);
  assert.deepEqual(await readdir(root), before);
});

test("agent role rejects unknown or malformed role ids", async () => {
  const unknown = await runCli([
    "agent",
    "role",
    "--role",
    "missing",
    "--json",
  ]);
  assert.equal(unknown.code, 1);
  assert.equal(
    JSON.parse(unknown.stdout).error.code,
    "ERR_AGENT_ROLE_NOT_FOUND",
  );

  const malformed = await runCli(["agent", "role", "--role", "Bad Role"]);
  assert.equal(malformed.code, 2);
  assert.match(malformed.stderr, /lowercase role id/i);

  const providerCoupling = await runCli([
    "agent",
    "roles",
    "--agent",
    "cc",
  ]);
  assert.equal(providerCoupling.code, 2);
  assert.match(providerCoupling.stderr, /not valid for agent roles/i);
});
