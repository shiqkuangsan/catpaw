import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../src/runtime/lib/cli.mjs";

export async function tempDir(prefix = "catpaw-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export function git(dir, ...args) {
  return execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    encoding: "utf8",
  });
}

export async function gitRepo(dir, files = { "a.txt": "a\n" }) {
  await mkdir(dir, { recursive: true });
  git(dir, "init", "-q");
  for (const [name, text] of Object.entries(files)) await writeFile(path.join(dir, name), text);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}

export async function project(files) {
  const dir = await gitRepo(await tempDir(), files);
  await run(dir, "init");
  return dir;
}

export async function run(cwd, ...argv) {
  return main(argv, { cwd });
}

export async function runError(cwd, ...argv) {
  try {
    await main(argv, { cwd });
  } catch (error) {
    return error;
  }
  throw new Error(`Expected failure: ${argv.join(" ")}`);
}
