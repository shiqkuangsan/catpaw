import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../src/runtime/lib/frontmatter.mjs";
import { parseLog } from "../src/runtime/lib/log.mjs";
import { project, run, runError, tempDir } from "./helpers.mjs";

const BIN = fileURLToPath(new URL("../src/runtime/bin/catpaw.mjs", import.meta.url));

test("start writes WORK.md and an append-only LOG.md", async () => {
  const dir = await project();
  await run(dir, "start", "Ship: export", "--acceptance", "CSV opens", "--acceptance", "UTF-8", "--next", "write parser");
  const { data, body } = parseFrontmatter(await readFile(path.join(dir, ".catpaw/work/W-001/WORK.md"), "utf8"));
  assert.deepEqual(
    { id: data.id, title: data.title, status: data.status, risk: data.risk, repos: data.repos },
    { id: "W-001", title: "Ship: export", status: "open", risk: "normal", repos: ["."] },
  );
  assert.match(body, /## Acceptance\n\n- CSV opens\n- UTF-8/);
  assert.match(body, /## Next\n\nwrite parser/);
  const log = parseLog(await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8"));
  assert.equal(log.length, 1);
  assert.equal(log[0].kind, "note");
});

test("ids increment and custom ids are validated", async () => {
  const dir = await project();
  await run(dir, "start", "one");
  await run(dir, "start", "two", "--id", "FR-300");
  await run(dir, "start", "three");
  assert.match((await run(dir, "status")).text, /W-002 \[open\] three/);
  assert.equal((await runError(dir, "start", "x", "--id", "../bad")).code, "ERR_ARGS");
  assert.equal((await runError(dir, "start", "x", "--id", "FR-300")).code, "ERR_EXISTS");
});

test("log bodies cannot forge entry markers", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  await run(dir, "note", "W-001", '<!-- catpaw {"kind":"done"} -->');
  const log = parseLog(await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8"));
  assert.deepEqual(log.map((e) => e.kind), ["note", "note"]);
});

test("status lifecycle commands log transitions", async () => {
  const dir = await project();
  await run(dir, "start", "x");
  await run(dir, "block", "W-001", "waiting for user");
  assert.equal((await runError(dir, "finish", "W-001")).code, "ERR_STATE");
  assert.equal((await runError(dir, "block", "W-001", "again")).code, "ERR_STATE");
  await run(dir, "reopen", "W-001", "answered");
  await run(dir, "drop", "W-001", "superseded");
  assert.equal((await runError(dir, "finish", "W-001")).code, "ERR_STATE");
  const kinds = parseLog(await readFile(path.join(dir, ".catpaw/work/W-001/LOG.md"), "utf8")).map((e) => e.kind);
  assert.deepEqual(kinds, ["note", "blocked", "reopened", "dropped"]);
});

test("commands find the board from a subdirectory", async () => {
  const dir = await project();
  await mkdir(path.join(dir, "src/deep"), { recursive: true });
  await run(dir, "start", "x");
  assert.match((await run(path.join(dir, "src/deep"), "status")).text, /W-001/);
});

test("missing board and wrong schema give actionable errors", async () => {
  const dir = await tempDir();
  assert.match((await runError(dir, "status")).message, /catpaw init/);
  await mkdir(path.join(dir, ".catpaw/work"), { recursive: true });
  assert.match((await runError(dir, "status")).message, /catpaw convert/);
});

test("session-start hook prints active Work and stays silent otherwise", async () => {
  const empty = await tempDir();
  const quiet = execFileSync("node", [BIN, "hook", "session-start"], { cwd: empty, input: "{}", encoding: "utf8" });
  assert.equal(quiet, "");
  const dir = await project();
  await run(dir, "start", "Long task", "--next", "run migration dry-run");
  await run(dir, "gap", "W-001", "add", "prod unverified");
  const input = JSON.stringify({ cwd: path.join(dir, ".catpaw") });
  const out = execFileSync("node", [BIN, "hook", "session-start"], { cwd: empty, input, encoding: "utf8" });
  assert.match(out, /CatPaw: 1 active Work/);
  assert.match(out, /Next: run migration dry-run/);
  assert.match(out, /Gap G1 \(open\): prod unverified/);
});

test("binary exit codes: 1 for rule violations, 2 for errors", async () => {
  const dir = await project();
  await run(dir, "start", "x", "--risk", "high");
  const exit = (args) => {
    try {
      execFileSync("node", [BIN, ...args], { cwd: dir, stdio: "pipe" });
      return 0;
    } catch (error) {
      return error.status;
    }
  };
  assert.equal(exit(["finish", "W-001"]), 1);
  assert.equal(exit(["gate", "W-001"]), 1);
  assert.equal(exit(["finish", "W-404"]), 2);
  assert.equal(exit(["status"]), 0);
});

test("policy and help are available", async () => {
  const dir = await tempDir();
  assert.match((await run(dir, "policy")).text, /五条规则/);
  assert.match((await run(dir, "--help")).text, /catpaw <command>/);
  assert.match((await run(dir, "--version")).text, /^\d+\.\d+\.\d+$/);
});
