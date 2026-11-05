import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseLog } from "../src/runtime/lib/log.mjs";
import { project, run, runError } from "./helpers.mjs";

const BIN = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));
const exec = promisify(execFile);

async function editWork(dir, edit) {
  const file = path.join(dir, ".catpaw/work/W-001/WORK.md");
  await writeFile(file, edit(await readFile(file, "utf8")));
}

test("concurrent processes do not lose gaps or reuse ids", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const many = (args) => Promise.all(Array.from({ length: 8 }, (_, i) => exec("node", [BIN, ...args(i)], { cwd: dir })));
  await many((i) => ["gap", "W-001", "add", `gap ${i}`]);
  await many((i) => ["start", `parallel ${i}`]);
  const work = await readFile(path.join(dir, ".catpaw/work/W-001/WORK.md"), "utf8");
  const ids = [...work.matchAll(/^- \[open\] (G\d+): /gm)].map((m) => m[1]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  const log = parseLog(await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8"));
  assert.deepEqual(log.filter((entry) => entry.kind === "gap").map((entry) => entry.gap), ids.reverse());
  const status = await run(dir, "status", "--json");
  assert.equal(status.data.active.length, 9);
});

test("a lock left by a dead process is taken over", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  await writeFile(path.join(dir, ".catpaw/.lock"), "999999\n");
  await run(dir, "note", "W-001", "after crash");
  const log = parseLog(await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8"));
  assert.equal(log[0].body, "after crash");
});

test("an unreadable Gaps line blocks finish instead of being skipped", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  await editWork(dir, (text) => text.replace("## Gaps\n", "## Gaps\n\n- [ open] G1: prod not verified\n"));
  const error = await runError(dir, "finish", "W-001");
  assert.equal(error.code, "ERR_RULES");
  assert.match(error.message, /unreadable Gaps line: - \[ open\] G1: prod not verified/);
});

test("invalid frontmatter blocks finish and fails gate for done Work", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  await editWork(dir, (text) => text.replace("risk: normal", "risk: hgih"));
  assert.match((await runError(dir, "finish", "W-001")).message, /unknown risk 'hgih'/);
  await editWork(dir, (text) => text.replace("risk: hgih", "risk: normal"));
  await run(dir, "finish", "W-001");
  await editWork(dir, (text) => text.replace("## Gaps\n", "## Gaps\n\nnone\n"));
  const gate = await run(dir, "gate");
  assert.equal(gate.exitCode, 1);
  assert.match(gate.text, /W-001: unreadable Gaps line: none/);
});

test("a corrupted LOG.md entry blocks finish", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  const log = path.join(dir, ".catpaw/work/W-001/LOG.md");
  await writeFile(log, `${await readFile(log, "utf8")}<!-- catpaw {"kind":"check","result":"passed" -->\n`);
  assert.match((await runError(dir, "finish", "W-001")).message, /unreadable LOG.md entry 2/);
});
