import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { snapshotTree, resolvePhysicalPath } from "./patch-plan.mjs";

const execute = promisify(execFile);
export const DEFAULT_PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function fail(code, message) {
  throw Object.assign(new Error(message), { code: `ERR_OPERATION_${code}` });
}
export function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export async function safePath(input, label = "target") {
  if (typeof input !== "string" || !input || /[\x00-\x1f\x7f]/.test(input)) fail("PATH", `${label} must be an explicit filesystem path`);
  const absolute = path.resolve(input);
  try {
    if ((await lstat(absolute)).isSymbolicLink()) fail("SYMLINK", `${label} must not be a symlink: ${absolute}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return resolvePhysicalPath(absolute);
}
export function surfaceDigest(entries) {
  return entries.size ? hash(stable([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))) : "absent-root";
}
export async function readSurface(root) {
  const snapshot = await snapshotTree(root);
  for (const [relative, entry] of snapshot.entries) {
    if (entry.type === "special") fail("SPECIAL_FILE", `Special files are unsupported: ${path.join(root, relative)}`);
    const stat = await lstat(path.join(root, relative));
    entry.uid = stat.uid;
    entry.gid = stat.gid;
  }
  return { ...snapshot, digest: surfaceDigest(snapshot.entries) };
}
function packagePath(value, directoryOnly = false) {
  if (typeof value !== "string" || !value || /[\x00-\x1f\x7f-\x9f\\]/.test(value) || path.posix.isAbsolute(value)) fail("MANIFEST", "Unsafe manifest path");
  const bare = value.replace(/\/$/, "");
  if (!bare || bare.includes("/") || bare.startsWith(".") || /^[A-Za-z]:/.test(bare) || ["state", "backups"].includes(bare.toLowerCase()) || (directoryOnly && !value.endsWith("/"))) fail("MANIFEST", `Unsafe or protected manifest path: ${value}`);
  return bare;
}
export async function inspectPackage(input = DEFAULT_PACKAGE_ROOT) {
  const root = await safePath(input, "packageRoot");
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) fail("PACKAGE", "packageRoot must be a directory");
  if (!(await lstat(path.join(root, "runtime-manifest.json"))).isFile()) fail("PACKAGE", "Runtime manifest must be a regular file, not a symlink");
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(root, "runtime-manifest.json"), "utf8")); }
  catch (error) { fail("MANIFEST", `Cannot read runtime manifest: ${error.message}`); }
  if (manifest.name !== "catpaw-runtime" || !/^\d+\.\d+\.\d+$/.test(manifest.version) || !Number.isInteger(manifest.boardSchemaVersion) || !Array.isArray(manifest.canonicalFiles) || !Array.isArray(manifest.legacyRuntimePaths) || !manifest.cli || typeof manifest.cli.entrypoint !== "string" || !Array.isArray(manifest.cli.commands)) fail("MANIFEST", "Invalid runtime manifest contract");
  const canonical = manifest.canonicalFiles.map((item) => packagePath(item));
  const retired = manifest.legacyRuntimePaths.map((item) => packagePath(item, true));
  if (new Set([...canonical, ...retired].map((item) => item.toLowerCase())).size !== canonical.length + retired.length) fail("MANIFEST", "Duplicate or overlapping manifest roots");
  if (!canonical.includes("VERSION") || !canonical.includes("runtime-manifest.json")) fail("MANIFEST", "Manifest must own VERSION and runtime-manifest.json");
  const entrypoint = manifest.cli.entrypoint;
  if (/[\x00-\x1f\x7f-\x9f\\]/.test(entrypoint) || path.posix.isAbsolute(entrypoint) || path.posix.normalize(entrypoint) !== entrypoint || entrypoint.split("/").some((item) => !item || item === ".." || item === ".") || !canonical.includes(entrypoint.split("/")[0])) fail("MANIFEST", "Unsafe CLI entrypoint");
  // Installed runtimes are valid package sources. Never inspect their state,
  // backups, or other unowned roots while building the managed package digest.
  const entries = new Map([["", { type: "dir", mode: rootStat.mode & 0o7777, uid: rootStat.uid, gid: rootStat.gid }]]);
  for (const relative of canonical) {
    const child = await readSurface(path.join(root, relative));
    if (!child.exists || [...child.entries.values()].some((entry) => !["dir", "file"].includes(entry.type))) fail("PACKAGE", "Managed package paths must be regular files and directories; symlinks are forbidden");
    for (const [local, entry] of child.entries) entries.set(local ? `${relative}/${local}` : relative, entry);
  }
  const snapshot = { entries, digest: surfaceDigest(entries), exists: true, rootType: "dir" };
  for (const [index, relative] of canonical.entries()) {
    const entry = snapshot.entries.get(relative);
    if (!entry || entry.type !== (manifest.canonicalFiles[index].endsWith("/") ? "dir" : "file")) fail("PACKAGE", `Manifest file type mismatch: ${relative}`);
  }
  if ((await readFile(path.join(root, "VERSION"), "utf8")).trim() !== manifest.version) fail("PACKAGE", "VERSION differs from runtime manifest");
  const cli = snapshot.entries.get(entrypoint);
  if (!cli || cli.type !== "file" || !(cli.mode & 0o111)) fail("PACKAGE", "Runtime CLI must be a regular executable file");
  const packageHash = createHash("sha256");
  for (const [relative, entry] of [...snapshot.entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) if (entry.type === "file") packageHash.update(`${relative}\0${entry.sha256}\0`);
  return { root, manifest, canonical, retired, snapshot, runtimeHash: packageHash.digest("hex") };
}
export async function runtimeCandidate(pkg, before, target) {
  const owned = new Set();
  if (before.entries.size > 1) {
    if (before.entries.get("runtime-manifest.json")?.type !== "file") fail("OWNERSHIP", "Nonempty runtime target has no regular manifest; ownership must not be inferred");
    let previous;
    try { previous = JSON.parse(await readFile(path.join(target, "runtime-manifest.json"), "utf8")); }
    catch { fail("OWNERSHIP", "Cannot establish prior runtime ownership from manifest"); }
    if (previous.name !== "catpaw-runtime" || !Array.isArray(previous.canonicalFiles)) fail("OWNERSHIP", "Target manifest does not establish CatPaw ownership");
    for (const relative of previous.canonicalFiles) owned.add(packagePath(relative));
    if (!owned.has("runtime-manifest.json") || !owned.has("VERSION")) fail("OWNERSHIP", "Prior manifest must own its metadata");
  }
  for (const relative of pkg.canonical) if (before.entries.has(relative) && !owned.has(relative)) fail("OWNERSHIP", `New managed root collides with an unowned target path: ${relative}`);
  const removals = [...pkg.canonical, ...pkg.retired.filter((relative) => owned.has(relative))];
  const entries = new Map(before.entries);
  for (const relative of entries.keys()) if (relative && removals.some((root) => relative === root || relative.startsWith(`${root}/`))) entries.delete(relative);
  for (const [relative, entry] of pkg.snapshot.entries) if (relative) entries.set(relative, { ...entry });
  if (!entries.has("")) entries.set("", { ...pkg.snapshot.entries.get("") });
  return entries;
}
const BEGIN = "<!-- CATPAW:BEGIN -->";
const END = "<!-- CATPAW:END -->";
function blockRange(text, label) {
  const begins = text.split(BEGIN).length - 1;
  const ends = text.split(END).length - 1;
  if (begins !== ends || begins > 1 || (begins && text.indexOf(END) < text.indexOf(BEGIN))) fail("ADAPTER_BLOCK", `${label} contains ambiguous or incomplete CATPAW markers`);
  return begins ? [text.indexOf(BEGIN), text.indexOf(END) + END.length] : null;
}
export async function adapterCandidate(pkg, target, before, scope) {
  if (!["global", "project"].includes(scope)) fail("SCOPE", "Adapter scope must be global or project");
  const snippetPath = `snippets/${scope}-adapter.md`;
  if (pkg.snapshot.entries.get(snippetPath)?.type !== "file") fail("ADAPTER_BLOCK", "Package does not own the requested adapter snippet");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let original, snippet;
  try {
    original = before.exists ? decoder.decode(await readFile(target)) : "";
    snippet = decoder.decode(await readFile(path.join(pkg.root, snippetPath)));
  } catch { fail("ADAPTER_ENCODING", "Adapter and snippet must be valid UTF-8"); }
  const snippetRange = blockRange(snippet, "Snippet");
  if (!snippetRange || snippet.slice(0, snippetRange[0]).trim() || snippet.slice(snippetRange[1]).trim()) fail("ADAPTER_BLOCK", "Snippet must contain exactly one CATPAW block");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const block = snippet.slice(...snippetRange).replace(/\r?\n/g, newline);
  const range = blockRange(original, "Adapter");
  const text = range ? original.slice(0, range[0]) + block + original.slice(range[1]) : original + (original && !original.endsWith("\n") ? newline : "") + block + newline;
  const content = Buffer.from(text);
  const entry = { ...(before.entries.get("") ?? { type: "file", mode: 0o644, uid: process.getuid?.() ?? 0, gid: process.getgid?.() ?? 0 }), bytes: content.length, sha256: hash(content) };
  return { content, entries: new Map([["", entry]]) };
}
export async function verifyRuntime(root, pkg) {
  for (const relative of pkg.canonical) {
    const expected = [...pkg.snapshot.entries].filter(([key]) => key === relative || key.startsWith(`${relative}/`));
    const actual = await readSurface(path.join(root, relative));
    for (const [key, entry] of expected) {
      const local = key === relative ? "" : key.slice(relative.length + 1);
      if (stable(actual.entries.get(local)) !== stable(entry)) fail("VERIFY", `Published runtime differs at ${key}`);
    }
    if (actual.entries.size !== expected.length) fail("VERIFY", `Unexpected managed runtime entries in ${relative}`);
  }
  // Fixed bounded smoke only. Inspect and plan never execute package code.
  const { stdout } = await execute(process.execPath, [path.join(root, pkg.manifest.cli.entrypoint), "--version"], {
    cwd: root, timeout: 15000, maxBuffer: 64 * 1024,
    env: { PATH: path.dirname(process.execPath), LANG: "C.UTF-8", CATPAW_HOME: root },
  });
  if (!stdout.includes(`catpaw ${pkg.manifest.version} (board schema ${pkg.manifest.boardSchemaVersion})`)) fail("VERIFY", "Runtime CLI --version did not match the package");
  return { manifest: "passed", canonicalFiles: "passed", cliVersion: "passed", version: pkg.manifest.version, runtimeHash: pkg.runtimeHash };
}
