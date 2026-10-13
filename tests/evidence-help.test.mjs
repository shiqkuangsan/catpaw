import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cli = new URL("../src/runtime/bin/catpaw.mjs", import.meta.url).pathname;

test("preferred Evidence help exposes body sources and preserves alias defaults", () => {
  const help = (...topic) => {
    const result = spawnSync(process.execPath, [cli, ...topic, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const add = help("evidence", "add");
  assert.match(add, /--body-file <path\|->/);
  assert.match(add, /omit for topic Evidence/);
  assert.match(add, /Required storage classification/);
  assert.match(add, /research \| review \| test \| provider \| reflection/);
  assert.match(help("proof", "add"), /default: research/);
  assert.doesNotMatch(help("evidence", "list"), /--body/);
  assert.match(help("evidence", "run"), /default: 120000/);
});
