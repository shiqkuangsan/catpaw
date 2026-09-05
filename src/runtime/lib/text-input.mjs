import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readTextInput(file, projectRoot) {
  if (file !== "-") return readFile(path.resolve(projectRoot, file), "utf8");
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}
