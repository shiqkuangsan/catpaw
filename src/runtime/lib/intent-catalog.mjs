import { readFile } from "node:fs/promises";

const CATALOG_URL = new URL("../catalog/intents.json", import.meta.url);
const CORE_INTENT_IDS = ["explore", "build", "check"];
const WRITE_POLICIES = new Set(["none", "bounded-isolated-scope"]);
const GIT_POLICIES = new Set([
  "forbidden",
  "forbidden-unless-explicitly-granted",
]);
const CONCURRENCY_MODES = new Set([
  "read-mostly",
  "isolated-writer",
]);
const INTENT_CONTRACTS = Object.freeze({
  explore: Object.freeze({
    writes: "none",
    git: "forbidden",
    authorityCeiling: Object.freeze([
      "read declared non-sensitive scope",
      "propose changes without treating the proposal as Approval",
    ]),
    independentProofEligible: false,
    independenceConditions: null,
    concurrencyMode: "read-mostly",
    concurrencyHardConstraint: "do not mutate shared project or external state",
  }),
  build: Object.freeze({
    writes: "bounded-isolated-scope",
    git: "forbidden-unless-explicitly-granted",
    authorityCeiling: Object.freeze([
      "write only the assigned isolated scope",
      "create bounded local commits only under an exact scoped grant",
      "never accept its own candidate or update protected, base, or remote state",
    ]),
    independentProofEligible: false,
    independenceConditions: null,
    concurrencyMode: "isolated-writer",
    concurrencyHardConstraint: "one accountable writer per mutable surface at a time",
  }),
  check: Object.freeze({
    writes: "none",
    git: "forbidden",
    authorityCeiling: Object.freeze([
      "read and assess declared scope",
      "run authorized isolated verification",
      "never modify the checked implementation or grant Approval",
    ]),
    independentProofEligible: true,
    independenceConditions: Object.freeze([
      "actor is different from the actor that built the checked scope",
      "actor did not modify the checked candidate",
    ]),
    concurrencyMode: "read-mostly",
    concurrencyHardConstraint: "verification side effects are isolated or explicitly serialized",
  }),
});
const EFFECTIVE_AUTHORITY =
  "user-project-approval intersect intent-authority-ceiling intersect primary-agent-grant intersect tool-enforcement";
const INTENT_ARRAY_FIELDS = [
  "methods",
  "useWhen",
  "avoidWhen",
  "requiredInputs",
  "outputs",
  "proofObligations",
  "authorityCeiling",
  "handoff",
  "stopConditions",
  "antiPatterns",
];

function catalogError(message) {
  const error = new Error(`Invalid Agent Intent Catalog: ${message}`);
  error.code = "ERR_AGENT_INTENT_CATALOG";
  return error;
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value) {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "");
}

function exactStringArray(value, expected) {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index]);
}

function validateIntent(intent, index) {
  if (!object(intent)) {
    throw catalogError(`intents[${index}] must be an object.`);
  }
  if (typeof intent.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(intent.id)) {
    throw catalogError(`intents[${index}].id must be a lowercase intent id.`);
  }
  for (const field of ["title", "purpose"]) {
    if (typeof intent[field] !== "string" || intent[field].trim() === "") {
      throw catalogError(`intent ${intent.id}.${field} must be a nonempty string.`);
    }
  }
  for (const field of INTENT_ARRAY_FIELDS) {
    if (!stringArray(intent[field])) {
      throw catalogError(`intent ${intent.id}.${field} must be a nonempty string array.`);
    }
  }
  if (
    !object(intent.defaultSideEffects) ||
    !WRITE_POLICIES.has(intent.defaultSideEffects.writes) ||
    !GIT_POLICIES.has(intent.defaultSideEffects.git)
  ) {
    throw catalogError(`intent ${intent.id}.defaultSideEffects is invalid.`);
  }
  if (typeof intent.independentProofEligible !== "boolean") {
    throw catalogError(`intent ${intent.id}.independentProofEligible must be boolean.`);
  }
  if (
    intent.independentProofEligible &&
    !stringArray(intent.independenceConditions)
  ) {
    throw catalogError(
      `intent ${intent.id}.independenceConditions must be a nonempty string array when eligible.`,
    );
  }
  if (
    !object(intent.concurrency) ||
    !CONCURRENCY_MODES.has(intent.concurrency.mode) ||
    typeof intent.concurrency.hardConstraint !== "string" ||
    intent.concurrency.hardConstraint.trim() === ""
  ) {
    throw catalogError(`intent ${intent.id}.concurrency is invalid.`);
  }
}

export function validateIntentCatalog(catalog) {
  if (!object(catalog) || catalog.schemaVersion !== 1) {
    throw catalogError("schemaVersion must be 1.");
  }
  if (
    typeof catalog.catalogVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(catalog.catalogVersion)
  ) {
    throw catalogError("catalogVersion must be semantic version text.");
  }
  if (catalog.decisionOwner !== "primary-agent") {
    throw catalogError("decisionOwner must be primary-agent.");
  }
  if (!object(catalog.composition) || !Array.isArray(catalog.intents)) {
    throw catalogError("composition and intents are required.");
  }
  const compositionFlags = [
    "oneAgentMayHoldMultipleIntents",
    "oneIntentMayHaveMultipleAgents",
    "independentCheckRequiresDistinctActor",
  ];
  if (
    compositionFlags.some((field) => catalog.composition[field] !== true) ||
    catalog.composition.effectiveAuthority !== EFFECTIVE_AUTHORITY
  ) {
    throw catalogError("composition contract is invalid.");
  }
  catalog.intents.forEach(validateIntent);
  const ids = catalog.intents.map((intent) => intent.id);
  if (new Set(ids).size !== ids.length) {
    throw catalogError("intent ids must be unique.");
  }
  const idSet = new Set(ids);
  const missingCore = CORE_INTENT_IDS.filter((id) => !idSet.has(id));
  if (missingCore.length > 0) {
    throw catalogError(`missing core intents: ${missingCore.join(", ")}.`);
  }
  const unexpected = ids.filter((id) => !CORE_INTENT_IDS.includes(id));
  if (unexpected.length > 0) {
    throw catalogError(`unexpected intents: ${unexpected.join(", ")}.`);
  }
  if (ids.some((id, index) => id !== CORE_INTENT_IDS[index])) {
    throw catalogError(`intent order must be: ${CORE_INTENT_IDS.join(", ")}.`);
  }
  for (const intent of catalog.intents) {
    const contract = INTENT_CONTRACTS[intent.id];
    if (
      intent.defaultSideEffects.writes !== contract.writes ||
      intent.defaultSideEffects.git !== contract.git ||
      !exactStringArray(intent.authorityCeiling, contract.authorityCeiling) ||
      intent.independentProofEligible !== contract.independentProofEligible ||
      (
        contract.independenceConditions === null
          ? Object.hasOwn(intent, "independenceConditions")
          : !exactStringArray(
              intent.independenceConditions,
              contract.independenceConditions,
            )
      ) ||
      intent.concurrency.mode !== contract.concurrencyMode ||
      intent.concurrency.hardConstraint !== contract.concurrencyHardConstraint
    ) {
      throw catalogError(`intent ${intent.id} safety contract is invalid.`);
    }
    const unknownHandoffs = intent.handoff.filter((id) =>
      id !== "primary-agent" && !idSet.has(id)
    );
    if (unknownHandoffs.length > 0) {
      throw catalogError(
        `intent ${intent.id}.handoff references unknown intents: ${unknownHandoffs.join(", ")}.`,
      );
    }
  }
  return catalog;
}

export async function loadIntentCatalog({ url = CATALOG_URL } = {}) {
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
  return validateIntentCatalog(catalog);
}

export function findCatalogIntent(catalog, intentId) {
  return catalog.intents.find((intent) => intent.id === intentId) ?? null;
}
