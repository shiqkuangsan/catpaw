// Flat frontmatter: scalars, JSON strings and JSON arrays of strings.

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseValue(raw) {
  const value = raw.trim();
  if (value === "" || value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('"') || value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function parseFrontmatter(text) {
  const match = text.match(FENCE);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0 || /^\s/.test(line)) continue;
    data[line.slice(0, colon).trim()] = parseValue(line.slice(colon + 1));
  }
  return { data, body: text.slice(match[0].length) };
}

function formatValue(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string") {
    return /^[A-Za-z0-9._\/-]+$/.test(value) && !/^(true|false|null|-?\d+)$/.test(value)
      ? value
      : JSON.stringify(value);
  }
  return String(value);
}

export function formatFrontmatter(data, body) {
  const lines = Object.entries(data).map(([key, value]) => `${key}: ${formatValue(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n${body.replace(/^\n+/, "")}`;
}
