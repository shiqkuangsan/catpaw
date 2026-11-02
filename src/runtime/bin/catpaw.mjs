#!/usr/bin/env node
import { main } from "../lib/cli.mjs";

try {
  const result = await main(process.argv.slice(2));
  const output = result.json ? JSON.stringify(result.data ?? {}, null, 2) : result.text;
  if (output) process.stdout.write(`${output}\n`);
  process.exitCode = result.exitCode;
} catch (error) {
  if (!error.code?.startsWith("ERR_")) throw error;
  process.stderr.write(`catpaw: ${error.message}\n`);
  process.exitCode = error.code === "ERR_RULES" ? 1 : 2;
}
