import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isUsableEvidence } from "../src/runtime/lib/completion-evidence.mjs";

const CLI = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));

function run(args, root, input = "") {
  const result = spawnSync(process.execPath, [CLI, ...args, "--json"], {
    cwd: root, input, encoding: "utf8", timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catpaw-proof-input-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const init = run(["board", "init", "--apply"], root);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return root;
}

for (const group of ["proof", "evidence"]) {
  test(`${group} add reads UTF-8 stdin and preserves multiline content`, async (t) => {
    const root = await fixture(t);
    const body = "Verified Unicode: 中文 🐾\n\n## Checks\nAll assertions passed.\n";
    const result = run([group, "add", "--type", "research", "--title", "Stdin proof", "--body-file", "-", "--apply"], root, body);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    const saved = await readFile(path.join(root, ".catpaw", report.artifacts[0].path), "utf8");
    assert.ok(saved.includes(body));
    assert.equal(isUsableEvidence({ body: saved }), true);
  });
}

test("empty stdin produces a structured error before a write or transport call", async (t) => {
  const root = await fixture(t);
  for (const [args, code] of [
    [["proof", "add", "--title", "Empty", "--body-file", "-", "--apply"], "ERR_WORKFLOW_EMPTY_PROOF"],
    [["transport", "send", "--agent", "cc", "--prompt-file", "-"], "ERR_AGENT_EMPTY_PROMPT"],
  ]) {
    const result = run(args, root, " \n\t");
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.equal(JSON.parse(result.stdout).error.code, code);
  }
});

test("Markdown headings in recorded Proof satisfy the existing completion contract", async (t) => {
  const root = await fixture(t);
  assert.equal(run(["work", "start", "--id", "FR-950", "--title", "Structured Proof", "--high-risk", "--apply"], root).status, 0);
  for (const [type, body, extra] of [
    ["test", "## Verification\n\nFocused tests passed.\n\n## Limits\nOnly the scoped fixture was tested.", []],
    ["review", "## Findings\n\nNo blocking findings in the checked scope.", ["--independent", "--agent", "independent-checker"]],
  ]) {
    const added = run(["proof", "add", "--work", "FR-950", "--type", type, "--title", type, "--body", body, ...extra, "--apply"], root);
    assert.equal(added.status, 0, added.stderr || added.stdout);
  }
  const finished = run(["work", "finish", "--id", "FR-950", "--apply"], root);
  assert.equal(finished.status, 0, finished.stderr || finished.stdout);
});

test("template limits cannot turn an empty or placeholder Record into completion Proof", () => {
  for (const record of ["", "_No body supplied._"]) {
    assert.equal(isUsableEvidence({ body: `# Test\n\n## Record\n\n${record}\n\n## Limits\n\n- Remaining gap: test not run.\n` }), false);
  }
});
