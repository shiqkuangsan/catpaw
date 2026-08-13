import { readFile } from "node:fs/promises";

const CATALOG_URL = new URL("../catalog/roles.json", import.meta.url);
const CORE_ROLE_IDS = [
  "scout",
  "architect",
  "builder",
  "reviewer",
  "verifier",
  "integrator",
];
const LENS_IDS = new Set([
  "value-scope",
  "system-contracts",
  "experience",
  "security",
  "performance",
]);
const WRITE_POLICIES = new Set([
  "none",
  "bounded-task-scope",
  "bounded-isolated-integration-surface",
]);
const GIT_POLICIES = new Set([
  "forbidden",
  "forbidden-unless-explicitly-opted-in",
  "forbidden-without-integration-or-builder-git-envelope",
]);
const CONCURRENCY_MODES = new Set([
  "read-only",
  "read-mostly",
  "isolated-writer",
]);
const EFFECTIVE_AUTHORITY =
  "user-project-authority intersect role-ceiling intersect executor-grant intersect transport-enforcement";
const ROLE_ARRAY_FIELDS = [
  "useWhen",
  "avoidWhen",
  "requiredInputs",
  "deliverables",
  "evidenceObligations",
  "authorityCeiling",
  "handoffEdges",
  "stopAndEscalation",
  "compatibleLenses",
  "antiPatterns",
];

function catalogError(message) {
  const error = new Error(`Invalid Agent Role Catalog: ${message}`);
  error.code = "ERR_AGENT_CATALOG";
  return error;
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value) {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "");
}

function validateRole(role, index) {
  if (!object(role)) throw catalogError(`roles[${index}] must be an object.`);
  if (typeof role.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(role.id)) {
    throw catalogError(`roles[${index}].id must be a lowercase role id.`);
  }
  for (const field of ["title", "intent"]) {
    if (typeof role[field] !== "string" || role[field].trim() === "") {
      throw catalogError(`role ${role.id}.${field} must be a nonempty string.`);
    }
  }
  for (const field of ROLE_ARRAY_FIELDS) {
    if (!stringArray(role[field])) {
      throw catalogError(`role ${role.id}.${field} must be a nonempty string array.`);
    }
  }
  if (
    !object(role.defaultSideEffects) ||
    !WRITE_POLICIES.has(role.defaultSideEffects.writes) ||
    !GIT_POLICIES.has(role.defaultSideEffects.git)
  ) {
    throw catalogError(`role ${role.id}.defaultSideEffects is invalid.`);
  }
  if (
    !object(role.independenceEligibility) ||
    typeof role.independenceEligibility.requiredCheck !== "boolean" ||
    !Array.isArray(role.independenceEligibility.conditions) ||
    !role.independenceEligibility.conditions.every((item) =>
      typeof item === "string" && item.trim() !== ""
    )
  ) {
    throw catalogError(`role ${role.id}.independenceEligibility is invalid.`);
  }
  if (
    !object(role.concurrencyProfile) ||
    !CONCURRENCY_MODES.has(role.concurrencyProfile.mode) ||
    typeof role.concurrencyProfile.hardConstraint !== "string" ||
    role.concurrencyProfile.hardConstraint.trim() === ""
  ) {
    throw catalogError(`role ${role.id}.concurrencyProfile is invalid.`);
  }
}

export function validateRoleCatalog(catalog) {
  if (!object(catalog) || catalog.schemaVersion !== 1) {
    throw catalogError("schemaVersion must be 1.");
  }
  if (
    typeof catalog.catalogVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(catalog.catalogVersion)
  ) {
    throw catalogError("catalogVersion must be semantic version text.");
  }
  if (catalog.decisionOwner !== "agent-executor") {
    throw catalogError("decisionOwner must be agent-executor.");
  }
  if (!object(catalog.composition) || !Array.isArray(catalog.roles)) {
    throw catalogError("composition and roles are required.");
  }
  const compositionFlags = [
    "oneAgentMayHoldMultipleRoles",
    "oneRoleMayHaveMultipleAgents",
    "requiredIndependenceRequiresDistinctActor",
  ];
  if (
    compositionFlags.some((field) => catalog.composition[field] !== true) ||
    catalog.composition.effectiveAuthority !== EFFECTIVE_AUTHORITY
  ) {
    throw catalogError("composition contract is invalid.");
  }
  catalog.roles.forEach(validateRole);
  const ids = catalog.roles.map((role) => role.id);
  if (new Set(ids).size !== ids.length) {
    throw catalogError("role ids must be unique.");
  }
  const idSet = new Set(ids);
  const missingCore = CORE_ROLE_IDS.filter((id) => !idSet.has(id));
  if (missingCore.length > 0) {
    throw catalogError(`missing core roles: ${missingCore.join(", ")}.`);
  }
  for (const role of catalog.roles) {
    const unknownHandoffs = role.handoffEdges.filter((id) =>
      id !== "agent-executor" && !idSet.has(id)
    );
    if (unknownHandoffs.length > 0) {
      throw catalogError(
        `role ${role.id}.handoffEdges references unknown roles: ${unknownHandoffs.join(", ")}.`,
      );
    }
    const unknownLenses = role.compatibleLenses.filter((id) => !LENS_IDS.has(id));
    if (unknownLenses.length > 0) {
      throw catalogError(
        `role ${role.id}.compatibleLenses references unknown lenses: ${unknownLenses.join(", ")}.`,
      );
    }
  }
  return catalog;
}

export async function loadRoleCatalog({ url = CATALOG_URL } = {}) {
  let text;
  try {
    text = await readFile(url, "utf8");
  } catch (cause) {
    const error = catalogError(`cannot read ${url}: ${cause.message}`);
    error.cause = cause;
    throw error;
  }
  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch (cause) {
    const error = catalogError(`JSON parse failed: ${cause.message}`);
    error.cause = cause;
    throw error;
  }
  return validateRoleCatalog(catalog);
}

export function findCatalogRole(catalog, roleId) {
  return catalog.roles.find((role) => role.id === roleId) ?? null;
}
