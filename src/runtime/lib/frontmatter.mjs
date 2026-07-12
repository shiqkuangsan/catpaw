const DELIMITER = "---";

function readLine(text, start) {
  const newline = text.indexOf("\n", start);
  const end = newline === -1 ? text.length : newline;
  const raw = text.slice(start, end);

  return {
    content: raw.endsWith("\r") ? raw.slice(0, -1) : raw,
    next: newline === -1 ? text.length : newline + 1,
  };
}

function parseScalar(value, lineNumber) {
  if (value.startsWith("{")) {
    throw new Error(`Frontmatter nested objects are not supported on line ${lineNumber}.`);
  }

  if (value.startsWith("[")) {
    throw new Error(`Frontmatter arrays are not supported on line ${lineNumber}.`);
  }

  if (value.startsWith("'")) {
    throw new Error(
      `Frontmatter strings must use JSON-style double quotes on line ${lineNumber}.`,
    );
  }

  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string") {
        throw new TypeError("not a string");
      }
      return parsed;
    } catch {
      throw new Error(`Invalid JSON-style string on line ${lineNumber}.`);
    }
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?(?:0|[1-9]\d*)$/.test(value)) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || Object.is(parsed, -0)) {
      throw new Error(`Frontmatter integers must be safe integers on line ${lineNumber}.`);
    }
    return parsed;
  }

  return value;
}

function parseEntry(line, lineNumber, data) {
  if (line === "") return;

  const colon = line.indexOf(":");
  if (/^\s/.test(line) || colon <= 0) {
    throw new Error(
      `Frontmatter must be a flat scalar map; invalid entry on line ${lineNumber}.`,
    );
  }

  const key = line.slice(0, colon).trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
    throw new Error(
      `Frontmatter must be a flat scalar map; invalid entry on line ${lineNumber}.`,
    );
  }

  if (Object.hasOwn(data, key)) {
    throw new Error(`Duplicate frontmatter key "${key}" on line ${lineNumber}.`);
  }

  data[key] = parseScalar(line.slice(colon + 1).trim(), lineNumber);
}

export function parseFrontmatter(text) {
  const firstLine = readLine(text, 0);

  if (firstLine.content !== DELIMITER) {
    return { data: {}, body: text };
  }

  const data = {};
  let cursor = firstLine.next;
  let lineNumber = 2;

  while (cursor < text.length) {
    const line = readLine(text, cursor);
    if (line.content === DELIMITER) {
      return { data, body: text.slice(line.next) };
    }

    parseEntry(line.content, lineNumber, data);
    cursor = line.next;
    lineNumber += 1;
  }

  throw new Error("Missing closing frontmatter delimiter.");
}

function stringifyScalar(key, value) {
  if (typeof value === "string") {
    const isReserved = /^(?:true|false|null|-?(?:0|[1-9]\d*))$/.test(value);
    const isPlain = /^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(value);
    return isPlain && !isReserved ? value : JSON.stringify(value);
  }

  if (value === null || typeof value === "boolean") {
    return String(value);
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0)
  ) {
    return String(value);
  }

  throw new TypeError(
    `Frontmatter value for "${key}" must be a scalar (string, boolean, null, or integer).`,
  );
}

export function stringifyFrontmatter(record, preferredOrder = []) {
  const keys = [];
  const seen = new Set();

  for (const key of preferredOrder) {
    if (Object.hasOwn(record, key) && !seen.has(key)) {
      keys.push(key);
      seen.add(key);
    }
  }

  for (const key of Object.keys(record)) {
    if (!seen.has(key)) keys.push(key);
  }

  const lines = keys.map((key) => {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      throw new TypeError(`Invalid frontmatter key "${key}".`);
    }
    return `${key}: ${stringifyScalar(key, record[key])}`;
  });

  return [DELIMITER, ...lines, DELIMITER, ""].join("\n");
}
