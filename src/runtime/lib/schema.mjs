import { readFileSync } from "node:fs";

const BOARD_SCHEMA_URL = new URL("../schemas/board-v2.json", import.meta.url);

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const BOARD_SCHEMA = deepFreeze(JSON.parse(readFileSync(BOARD_SCHEMA_URL, "utf8")));

export function loadBoardSchema() {
  return BOARD_SCHEMA;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function matchesType(value, type) {
  switch (type) {
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return isObject(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    default:
      return typeof value === type;
  }
}

function formatTypes(types) {
  return types.map((type) => (type === "integer" ? "an integer" : type)).join(" or ");
}

function isCalendarDate(value) {
  const match = value.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysByMonth[month - 1];
}

function validateProperty(kind, path, value, definition) {
  const types = Array.isArray(definition.type)
    ? definition.type
    : [definition.type];

  if (!types.some((type) => matchesType(value, type))) {
    return {
      code: "type",
      path,
      message: `${kind}.${path} must be ${formatTypes(types)}.`,
    };
  }

  if (definition.enum && !definition.enum.some((item) => Object.is(item, value))) {
    return {
      code: "enum",
      path,
      message: `${kind}.${path} must be one of: ${definition.enum.join(", ")}.`,
    };
  }

  if (
    definition.pattern &&
    typeof value === "string" &&
    !new RegExp(definition.pattern).test(value)
  ) {
    return {
      code: "pattern",
      path,
      message: `${kind}.${path} must match ${definition.pattern}.`,
    };
  }

  if (definition.format === "date" && typeof value === "string" && !isCalendarDate(value)) {
    return {
      code: "format",
      path,
      message: `${kind}.${path} must be a real calendar date (YYYY-MM-DD).`,
    };
  }

  return null;
}

function validateClosedStatus(kind, metadata, schema) {
  const rule = schema.constraints?.closedStatus;
  if (!rule?.artifactKinds.includes(kind)) return null;
  if (
    !Object.hasOwn(metadata, rule.statusField) ||
    !Object.hasOwn(metadata, rule.closedField)
  ) {
    return null;
  }

  const status = metadata[rule.statusField];
  const closed = metadata[rule.closedField];
  const isTerminal = rule.terminalStatuses.includes(status);

  if (isTerminal && typeof closed !== "string") {
    return {
      code: "closed-status",
      path: rule.closedField,
      message: `${kind}.${rule.closedField} must be an ISO date (YYYY-MM-DD) when status is ${status}.`,
    };
  }

  if (!isTerminal && closed !== null) {
    return {
      code: "closed-status",
      path: rule.closedField,
      message: `${kind}.${rule.closedField} must be null when status is ${status}.`,
    };
  }

  return null;
}

function validateWorkType(kind, metadata, schema) {
  const rule = schema.constraints?.workTypeByIdPrefix;
  if (!rule || rule.artifactKind !== kind) return null;

  const id = metadata[rule.idField];
  const type = metadata[rule.typeField];
  if (typeof id !== "string" || typeof type !== "string") return null;

  const prefix = id.match(/^([A-Z]+)-/)?.[1];
  const expectedType = rule.mapping[prefix];
  const knownTypes = Object.values(rule.mapping);
  if (!expectedType || !knownTypes.includes(type) || expectedType === type) return null;

  return {
    code: "id-type",
    path: rule.typeField,
    message: `${kind}.${rule.typeField} must be ${expectedType} when ${rule.idField} starts with ${prefix}-.`,
  };
}

export function validateMetadata(kind, metadata, schema = loadBoardSchema()) {
  const definition = schema.artifacts?.[kind];
  if (!definition) {
    return [
      {
        code: "unknown-kind",
        path: "$",
        message: `Unknown artifact kind "${kind}".`,
      },
    ];
  }

  if (!isObject(metadata)) {
    return [
      {
        code: "type",
        path: "$",
        message: `${kind} metadata must be an object.`,
      },
    ];
  }

  const findings = [];

  for (const property of definition.required ?? []) {
    if (!Object.hasOwn(metadata, property)) {
      findings.push({
        code: "required",
        path: property,
        message: `${kind}.${property} is required.`,
      });
    }
  }

  for (const [property, value] of Object.entries(metadata)) {
    const propertyDefinition = definition.properties?.[property];
    if (!propertyDefinition) {
      if (definition.additionalProperties === false) {
        findings.push({
          code: "additionalProperties",
          path: property,
          message: `${kind}.${property} is not allowed.`,
        });
      }
      continue;
    }

    const finding = validateProperty(kind, property, value, propertyDefinition);
    if (finding) findings.push(finding);
  }

  const closedStatusFinding = validateClosedStatus(kind, metadata, schema);
  if (closedStatusFinding) findings.push(closedStatusFinding);

  const workTypeFinding = validateWorkType(kind, metadata, schema);
  if (workTypeFinding) findings.push(workTypeFinding);

  return findings;
}
