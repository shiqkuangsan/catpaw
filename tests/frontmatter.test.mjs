import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFrontmatter,
  stringifyFrontmatter,
} from "../src/runtime/lib/frontmatter.mjs";

test("parseFrontmatter reads every supported scalar and preserves the body", () => {
  const parsed = parseFrontmatter(`---
title: Plain text
quoted: "true"
enabled: false
optional: null
count: -12
---
# Body
`);

  assert.deepEqual(parsed.data, {
    title: "Plain text",
    quoted: "true",
    enabled: false,
    optional: null,
    count: -12,
  });
  assert.equal(parsed.body, "# Body\n");
});

test("parseFrontmatter supports CRLF delimiters without changing the body", () => {
  const parsed = parseFrontmatter(
    "---\r\nid: FR-001\r\nactive: true\r\n---\r\nBody\r\n",
  );

  assert.deepEqual(parsed.data, { id: "FR-001", active: true });
  assert.equal(parsed.body, "Body\r\n");
});

test("parseFrontmatter returns an empty map when frontmatter is absent", () => {
  const text = "# Plain Markdown\n\nNo metadata here.\n";

  assert.deepEqual(parseFrontmatter(text), { data: {}, body: text });
});

test("parseFrontmatter rejects duplicate keys", () => {
  assert.throws(
    () => parseFrontmatter("---\nid: FR-001\nid: FR-002\n---\n"),
    /duplicate frontmatter key "id" on line 3/i,
  );
});

test("parseFrontmatter rejects nested values and arrays", async (t) => {
  await t.test("indented nested key", () => {
    assert.throws(
      () => parseFrontmatter("---\nparent: value\n  child: nested\n---\n"),
      /flat scalar map.*line 3/i,
    );
  });

  await t.test("inline object", () => {
    assert.throws(
      () => parseFrontmatter("---\nvalue: { nested: true }\n---\n"),
      /nested objects.*line 2/i,
    );
  });

  await t.test("inline array", () => {
    assert.throws(
      () => parseFrontmatter("---\nvalue: [one, two]\n---\n"),
      /arrays.*line 2/i,
    );
  });

  await t.test("block array", () => {
    assert.throws(
      () => parseFrontmatter("---\nvalue: one\n- two\n---\n"),
      /flat scalar map.*line 3/i,
    );
  });
});

test("parseFrontmatter handles delimiters and rejects malformed quoted strings", async (t) => {
  await t.test("missing closing delimiter", () => {
    assert.throws(
      () => parseFrontmatter("---\nid: FR-001\n"),
      /closing frontmatter delimiter/i,
    );
  });

  await t.test("keeps later horizontal rules in ordinary Markdown body", () => {
    const text = "# Heading\n\n---\n\nParagraph.\n";

    assert.deepEqual(parseFrontmatter(text), { data: {}, body: text });
  });

  await t.test("single-quoted YAML string", () => {
    assert.throws(
      () => parseFrontmatter("---\ntitle: 'not JSON quoted'\n---\n"),
      /JSON-style double quotes.*line 2/i,
    );
  });

  await t.test("invalid JSON string", () => {
    assert.throws(
      () => parseFrontmatter('---\ntitle: "unterminated\n---\n'),
      /invalid JSON-style string.*line 2/i,
    );
  });
});

test("parseFrontmatter rejects integers that cannot round-trip exactly", async (t) => {
  for (const [name, value] of [
    ["unsafe positive integer", "9007199254740993"],
    ["unsafe negative integer", "-9007199254740993"],
    ["negative zero", "-0"],
  ]) {
    await t.test(name, () => {
      assert.throws(
        () => parseFrontmatter(`---\nvalue: ${value}\n---\n`),
        /safe integer.*line 2/i,
      );
    });
  }
});

test("stringifyFrontmatter honors preferred order and round-trips scalar types", () => {
  const record = {
    count: 2,
    status: "active",
    id: "FR-001",
    ambiguous: "true",
    empty: "",
    enabled: true,
    optional: null,
  };

  const text = stringifyFrontmatter(record, ["id", "status"]);

  assert.equal(
    text,
    `---
id: FR-001
status: active
count: 2
ambiguous: "true"
empty: ""
enabled: true
optional: null
---
`,
  );
  assert.deepEqual(parseFrontmatter(text), { data: record, body: "" });
});

test("stringifyFrontmatter rejects non-scalar and non-integer values", async (t) => {
  for (const [name, value] of [
    ["array", ["one"]],
    ["object", { nested: true }],
    ["undefined", undefined],
    ["float", 1.5],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["negative zero", -0],
  ]) {
    await t.test(name, () => {
      assert.throws(
        () => stringifyFrontmatter({ value }),
        /frontmatter value for "value" must be a scalar/i,
      );
    });
  }
});
