// Snapshot: for each repository in scope, HEAD plus a hash of uncommitted
// changes (tracked diff and untracked files). The board itself is excluded.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readlink } from "node:fs/promises";
import path from "node:path";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const WALK_SKIP = new Set([".git", ".catpaw", "node_modules", "dist", ".DS_Store"]);

function run(dir, args, onData) {
  return new Promise((resolve) => {
    const child = spawn("git", ["-C", dir, ...args], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    child.stdout.on("data", (chunk) => (onData ? onData(chunk) : chunks.push(chunk)));
    child.on("error", () => resolve({ code: -1, out: "" }));
    child.on("close", (code) => resolve({ code, out: Buffer.concat(chunks).toString("utf8") }));
  });
}

function hashFile(file, hash) {
  return new Promise((resolve, reject) => {
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
}

async function hashEntry(file, hash) {
  const info = await lstat(file);
  if (info.isSymbolicLink()) hash.update(`link:${await readlink(file)}`);
  else if (info.isFile()) await hashFile(file, hash);
}

async function gitState(dir, exclude) {
  const top = await run(dir, ["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) return null;
  const head = await run(dir, ["rev-parse", "--verify", "-q", "HEAD"]);
  const base = head.code === 0 ? head.out.trim() : EMPTY_TREE;
  const pathspec = ["--", ".", ...exclude.map((rel) => `:(exclude)${rel}`)];
  const hash = createHash("sha256");
  let dirty = false;
  await run(dir, ["diff", base, "--binary", "--no-ext-diff", "--no-color", ...pathspec], (chunk) => {
    dirty = true;
    hash.update(chunk);
  });
  const untracked = await run(dir, ["ls-files", "--others", "--exclude-standard", "-z", ...pathspec]);
  for (const rel of untracked.out.split("\0").filter(Boolean).sort()) {
    dirty = true;
    hash.update(`\0untracked:${rel}\0`);
    await hashEntry(path.join(dir, rel), hash).catch(() => hash.update("unreadable"));
  }
  return { head: head.code === 0 ? base : "nohead", diff: dirty ? hash.digest("hex") : "clean" };
}

async function walkState(dir) {
  const hash = createHash("sha256");
  async function walk(current) {
    const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (WALK_SKIP.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        hash.update(`\0${path.relative(dir, full)}\0`);
        await hashEntry(full, hash);
      }
    }
  }
  await walk(dir);
  return { head: "nogit", diff: hash.digest("hex") };
}

export async function takeSnapshot(projectRoot, repos, boardDir) {
  const states = [];
  for (const repo of repos) {
    const dir = path.resolve(projectRoot, repo);
    const rel = path.relative(dir, boardDir);
    const exclude = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? [rel] : [];
    let state;
    try {
      state = (await gitState(dir, exclude)) ?? (await walkState(dir));
    } catch {
      state = { head: "missing", diff: "missing" };
    }
    states.push({ repo, ...state });
  }
  const id = createHash("sha256")
    .update(states.map((s) => `${s.repo}@${s.head}+${s.diff}`).join("\n"))
    .digest("hex")
    .slice(0, 16);
  const detail = states
    .map((s) => `${s.repo}@${s.head.slice(0, 12)}+${s.diff === "clean" ? "clean" : s.diff.slice(0, 12)}`)
    .join(" ");
  return { id, detail };
}
