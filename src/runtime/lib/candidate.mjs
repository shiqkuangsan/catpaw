import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseFrontmatter } from "./frontmatter.mjs";

const exec = promisify(execFile);
const digest = value => createHash("sha256").update(value).digest("hex");
function failure(message) {
  return Object.assign(new Error(message), { code: "ERR_WORKFLOW_CANDIDATE" });
}
function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export async function candidateFor(options, work) {
  if (work.contract !== 4) return null;
  const root = await realpath(options.projectRoot);
  const scope = work.scope ?? ".";
  if (path.isAbsolute(scope) || scope.includes("\0")) throw failure("Work scope must be project-relative.");
  const target = path.resolve(root, scope);
  if (!inside(root, target)) throw failure("Work scope escapes the project.");
  const boardPath = await realpath(options.boardPath ?? path.join(root, ".catpaw"));
  const exclusions = await Promise.all((options.candidateExclusions ?? []).map(directory => realpath(directory)));
  const excluded = file => inside(boardPath, file) || inside(path.join(root, ".git"), file) || exclusions.some(directory => inside(directory, file));
  if (excluded(target)) throw failure("Work scope must describe deliverables outside board and Git state.");
  let files;
  let git = false;
  try {
    await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    git = true;
  } catch (error) {
    if (error.code !== 128 && error.code !== "ENOENT") throw failure("Cannot identify the candidate repository.");
  }
  if (git) {
    // Follow only the explicitly scoped path, never discover sibling repositories.
    let repository = root;
    let cursor = root;
    for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
      if (segment === ".git") throw failure("Work scope must exclude Git state.");
      cursor = path.join(cursor, segment);
      let stat;
      try { stat = await lstat(cursor); } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
      if (stat.isSymbolicLink()) throw failure("Work scope contains an unsafe link.");
      if (!stat.isDirectory()) break;
      try {
        const marker = await lstat(path.join(cursor, ".git"));
        if (marker.isSymbolicLink() || (!marker.isDirectory() && !marker.isFile())) throw failure("Unsafe repository marker.");
        const detected = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: cursor });
        if (await realpath(detected.stdout.trim()) !== cursor) throw failure("Candidate repository root mismatch.");
        repository = cursor;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const localScope = path.relative(repository, target) || ".";
    const result = await exec("git", ["--literal-pathspecs", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", localScope], { cwd: repository, maxBuffer: 16 * 1024 * 1024 });
    files = [...new Set(result.stdout.split("\0").filter(Boolean).map(name => path.relative(root, path.resolve(repository, name))))];
  } else {
    files = [];
    async function walk(file) {
      if (excluded(file)) return;
      const stat = await lstat(file);
      if (stat.isDirectory()) {
        for (const name of await readdir(file)) await walk(path.join(file, name));
      } else files.push(path.relative(root, file));
      if (files.length > 100000) throw failure("Candidate scope exceeds 100000 files; choose a narrower scope.");
    }
    await walk(target);
  }
  const entries = [];
  const inventory = new Set(files.map(name => path.resolve(root, name)));
  for (const name of files.sort()) {
    const file = path.resolve(root, name);
    if (!inside(root, file)) throw failure("Candidate file escapes the project.");
    if (excluded(file)) continue;
    let stat;
    try { stat = await lstat(file); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      entries.push([name, "deleted"]);
      continue;
    }
    if (stat.isSymbolicLink()) {
      // Permit only direct links to ordinary files already covered by this inventory.
      // Hash the link itself; the target's own entry accounts for its bytes and mode.
      const link = await readlink(file);
      const destination = path.resolve(path.dirname(file), link);
      const unsafe = () => failure(`Candidate contains an unsafe link: ${name}`);
      if (path.isAbsolute(link) || !inside(root, destination) || excluded(destination)
        || path.relative(root, destination).split(path.sep).includes(".git") || !inventory.has(destination)) throw unsafe();
      try {
        // Validate raw traversal before collapsing '..'; a missing or linked parent
        // must not disappear through path normalization.
        let cursor = path.dirname(file);
        for (const segment of link.split(path.sep).filter(Boolean)) {
          if (!(await lstat(cursor)).isDirectory()) throw unsafe();
          cursor = path.resolve(cursor, segment);
          if (!inside(root, cursor) || excluded(cursor) || segment === ".git"
            || (await lstat(cursor)).isSymbolicLink()) throw unsafe();
        }
        if (await realpath(file) !== destination) throw unsafe();
        if (await realpath(destination) !== destination || !(await lstat(destination)).isFile()) throw unsafe();
      } catch (error) {
        if (["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) throw unsafe();
        throw error;
      }
      const after = await lstat(file);
      if (!after.isSymbolicLink() || await readlink(file) !== link || stat.ino !== after.ino
        || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.mode !== after.mode) {
        throw failure("Candidate changed while hashing; inspect it again.");
      }
      entries.push([name, "symlink", link]);
      continue;
    }
    if (!inside(root, await realpath(file))) throw failure(`Candidate contains an unsafe link: ${name}`);
    if (!stat.isFile()) throw failure(`Candidate contains unsupported content: ${name}`);
    const bytes = await readFile(file);
    const after = await lstat(file);
    if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.mode !== after.mode || stat.ino !== after.ino) throw failure("Candidate changed while hashing; inspect it again.");
    entries.push([name, stat.mode & 0o7777, digest(bytes)]);
  }
  if (entries.length === 0 && scope !== ".") throw failure("Candidate scope contains no files. Choose a concrete deliverable scope.");
  const body = String(work.body ?? "").replace(/<!-- catpaw:work-progress:start -->[\s\S]*?<!-- catpaw:work-progress:end -->/g, "");
  const plans = [];
  const planRoot = path.join(boardPath, "plans");
  async function readPlans(directory) {
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (directory === planRoot && error.code === "ENOENT") return; throw error; }
    for (const entry of children) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw failure("Candidate Plan must not be a symlink.");
      if (entry.isDirectory()) await readPlans(file);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const parsed = parseFrontmatter(await readFile(file, "utf8"));
        if (parsed.data.work === work.id) plans.push([path.relative(boardPath, file), parsed.data.work, parsed.body]);
      }
    }
  }
  await readPlans(planRoot);
  plans.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return digest(JSON.stringify({ contract: 4, id: work.id, cycle: work.cycle, owner: work.owner, acceptance: work.acceptance, scope, body, plans, entries }));
}
