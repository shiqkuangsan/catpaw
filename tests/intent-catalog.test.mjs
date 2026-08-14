import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadIntentCatalog,
  validateIntentCatalog,
} from "../src/runtime/lib/intent-catalog.mjs";

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

test("Intent Catalog defines the three bounded task intents", async () => {
  const catalog = await loadIntentCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.catalogVersion, "1.0.0");
  assert.equal(catalog.decisionOwner, "primary-agent");
  assert.deepEqual(catalog.intents.map((intent) => intent.id), [
    "explore",
    "build",
    "check",
  ]);
  assert.equal(catalog.composition.oneAgentMayHoldMultipleIntents, true);
  assert.equal(catalog.composition.oneIntentMayHaveMultipleAgents, true);
  assert.equal(catalog.composition.independentCheckRequiresDistinctActor, true);

  for (const intent of catalog.intents) {
    assert.ok(intent.purpose);
    assert.ok(intent.methods.length > 0);
    assert.ok(intent.requiredInputs.length > 0);
    assert.ok(intent.outputs.length > 0);
    assert.ok(intent.proofObligations.length > 0);
    assert.ok(intent.authorityCeiling.length > 0);
    assert.ok(intent.handoff.length > 0);
    assert.ok(intent.stopConditions.length > 0);
    assert.ok(intent.antiPatterns.length > 0);
    assert.ok(intent.defaultSideEffects.writes);
    assert.ok(intent.defaultSideEffects.git);
    assert.ok(intent.concurrency.hardConstraint);
    for (const forbidden of ["model", "provider", "agentCount", "executionGraph"]) {
      assert.equal(Object.hasOwn(intent, forbidden), false, `${intent.id}.${forbidden}`);
    }
  }
  assert.equal(
    catalog.intents.find((intent) => intent.id === "build").independentProofEligible,
    false,
  );
  assert.equal(
    catalog.intents.find((intent) => intent.id === "check").independentProofEligible,
    true,
  );
});

test("Intent Catalog validator rejects ownership and contract drift", async () => {
  const duplicate = structuredClone(await loadIntentCatalog());
  duplicate.intents[1].id = duplicate.intents[0].id;
  assert.throws(() => validateIntentCatalog(duplicate), /intent ids must be unique/i);

  const wrongOwner = structuredClone(await loadIntentCatalog());
  wrongOwner.decisionOwner = "catpaw";
  assert.throws(
    () => validateIntentCatalog(wrongOwner),
    /decisionOwner must be primary-agent/i,
  );

  const missingCore = structuredClone(await loadIntentCatalog());
  missingCore.intents = missingCore.intents.filter((intent) => intent.id !== "check");
  assert.throws(
    () => validateIntentCatalog(missingCore),
    /missing core intents: check/i,
  );

  const extraIntent = structuredClone(await loadIntentCatalog());
  extraIntent.intents.push({
    ...structuredClone(extraIntent.intents[0]),
    id: "deploy",
    title: "Deploy",
  });
  assert.throws(
    () => validateIntentCatalog(extraIntent),
    /unexpected intents: deploy/i,
  );

  const reordered = structuredClone(await loadIntentCatalog());
  [reordered.intents[0], reordered.intents[1]] = [
    reordered.intents[1],
    reordered.intents[0],
  ];
  assert.throws(
    () => validateIntentCatalog(reordered),
    /intent order must be: explore, build, check/i,
  );

  const badHandoff = structuredClone(await loadIntentCatalog());
  badHandoff.intents[0].handoff.push("ghost");
  assert.throws(
    () => validateIntentCatalog(badHandoff),
    /handoff references unknown intents: ghost/i,
  );

  const badGitPolicy = structuredClone(await loadIntentCatalog());
  badGitPolicy.intents[0].defaultSideEffects.git = "allowed";
  assert.throws(
    () => validateIntentCatalog(badGitPolicy),
    /defaultSideEffects is invalid/i,
  );

  const badConcurrency = structuredClone(await loadIntentCatalog());
  badConcurrency.intents[0].concurrency.mode = "unbounded";
  assert.throws(
    () => validateIntentCatalog(badConcurrency),
    /concurrency is invalid/i,
  );

  const writableCheck = structuredClone(await loadIntentCatalog());
  const check = writableCheck.intents.find((intent) => intent.id === "check");
  check.defaultSideEffects.writes = "bounded-isolated-scope";
  check.defaultSideEffects.git = "forbidden-unless-explicitly-granted";
  check.independentProofEligible = false;
  check.concurrency.mode = "isolated-writer";
  assert.throws(
    () => validateIntentCatalog(writableCheck),
    /intent check safety contract is invalid/i,
  );

  const unboundedBuild = structuredClone(await loadIntentCatalog());
  const build = unboundedBuild.intents.find((intent) => intent.id === "build");
  build.defaultSideEffects.git = "forbidden";
  assert.throws(
    () => validateIntentCatalog(unboundedBuild),
    /intent build safety contract is invalid/i,
  );

  const selfChecking = structuredClone(await loadIntentCatalog());
  selfChecking.intents.find((intent) => intent.id === "check")
    .independenceConditions = ["the builder may check its own work"];
  assert.throws(
    () => validateIntentCatalog(selfChecking),
    /intent check safety contract is invalid/i,
  );

  const sharedWriter = structuredClone(await loadIntentCatalog());
  sharedWriter.intents.find((intent) => intent.id === "build")
    .concurrency.hardConstraint = "multiple actors may write the same surface";
  assert.throws(
    () => validateIntentCatalog(sharedWriter),
    /intent build safety contract is invalid/i,
  );

  const expandedAuthority = structuredClone(await loadIntentCatalog());
  expandedAuthority.intents.find((intent) => intent.id === "check")
    .authorityCeiling = ["modify the checked implementation and grant Approval"];
  assert.throws(
    () => validateIntentCatalog(expandedAuthority),
    /intent check safety contract is invalid/i,
  );

  const fakeIndependence = structuredClone(await loadIntentCatalog());
  fakeIndependence.intents.find((intent) => intent.id === "explore")
    .independenceConditions = ["exploration is always independent"];
  assert.throws(
    () => validateIntentCatalog(fakeIndependence),
    /intent explore safety contract is invalid/i,
  );

  const badAuthority = structuredClone(await loadIntentCatalog());
  badAuthority.composition.effectiveAuthority = "primary agent decides everything";
  assert.throws(
    () => validateIntentCatalog(badAuthority),
    /composition contract is invalid/i,
  );
});

test("agent intents and agent intent discover contracts without provider access or writes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-intent-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = await readdir(root);

  const listed = await runCli(["agent", "intents", "--project", root, "--json"]);
  assert.equal(listed.code, 0, listed.stderr);
  assert.equal(listed.stderr, "");
  const listReport = JSON.parse(listed.stdout);
  assert.equal(listReport.command, "agent intents");
  assert.equal(listReport.decisionOwner, "primary-agent");
  assert.equal(listReport.intents.length, 3);

  const shown = await runCli(["agent", "intent", "--intent", "build"]);
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /Agent Intent: Build \(build\)/);
  assert.match(shown.stdout, /Decision owner: primary-agent/);
  assert.match(shown.stdout, /bounded local commits/i);
  assert.match(shown.stdout, /Proof obligations:/);
  assert.match(shown.stdout, /Independence conditions:/);
  assert.match(shown.stdout, /Handoff:/);
  assert.match(shown.stdout, /Stop conditions:/);
  assert.match(shown.stdout, /Anti-patterns:/);
  assert.deepEqual(await readdir(root), before);
});

test("agent intent rejects unknown or malformed intent ids", async () => {
  const unknown = await runCli([
    "agent",
    "intent",
    "--intent",
    "missing",
    "--json",
  ]);
  assert.equal(unknown.code, 1);
  assert.equal(
    JSON.parse(unknown.stdout).error.code,
    "ERR_AGENT_INTENT_NOT_FOUND",
  );

  const malformed = await runCli(["agent", "intent", "--intent", "Bad Intent"]);
  assert.equal(malformed.code, 2);
  assert.match(malformed.stderr, /lowercase intent id/i);

  const providerCoupling = await runCli([
    "agent",
    "intents",
    "--agent",
    "cc",
  ]);
  assert.equal(providerCoupling.code, 2);
  assert.match(providerCoupling.stderr, /not valid for agent intents/i);
});
