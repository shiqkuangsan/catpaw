import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
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
    const result = await exec("git", ["--literal-pathspecs", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", scope], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    files = [...new Set(result.stdout.split("\0").filter(Boolean))];
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
    if (stat.isSymbolicLink() || !inside(root, await realpath(file))) throw failure(`Candidate contains an unsafe link: ${name}`);
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
