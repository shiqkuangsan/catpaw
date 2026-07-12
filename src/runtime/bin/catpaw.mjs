#!/usr/bin/env node

import { CliUsageError, parseCliArgs } from "../lib/args.mjs";
import {
  renderBoardReport,
  runBoardCommand,
} from "../lib/commands/board.mjs";
import { runWorkCommand } from "../lib/commands/work.mjs";
import { renderMutationReport } from "../lib/commands/workflow.mjs";
import { runMilestoneCommand } from "../lib/commands/milestone.mjs";
import { runEvidenceCommand } from "../lib/commands/evidence.mjs";
import {
  renderAgentReport,
  runAgentCommand,
} from "../lib/commands/agent.mjs";

const OPERATIONAL_ERROR_CODES = new Set([
  "EACCES",
  "EBUSY",
  "EEXIST",
  "EISDIR",
  "ENOENT",
  "ENOTDIR",
  "ENOTEMPTY",
  "EPERM",
  "EROFS",
]);

function isOperationalError(error) {
  return typeof error?.code === "string" && (
    OPERATIONAL_ERROR_CODES.has(error.code) ||
    error.code.startsWith("ERR_BOARD_") ||
    error.code.startsWith("ERR_PATCH_") ||
    error.code.startsWith("ERR_WORKFLOW_") ||
    error.code.startsWith("ERR_AGENT_")
  );
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseCliArgs(argv);
    const result = options.group === "board"
      ? await runBoardCommand(options)
      : options.group === "work"
        ? await runWorkCommand(options)
        : options.group === "milestone"
          ? await runMilestoneCommand(options)
          : options.group === "evidence"
            ? await runEvidenceCommand(options)
            : await runAgentCommand(options);
    process.stdout.write(
      options.json
        ? `${JSON.stringify(result.report, null, 2)}\n`
        : options.group === "board"
          ? renderBoardReport(result.report)
          : options.group === "agent"
            ? renderAgentReport(result.report)
            : renderMutationReport(result.report),
    );
    process.exitCode = result.exitCode;
  } catch (error) {
    if (error instanceof CliUsageError) {
      process.stderr.write(`catpaw: ${error.message}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    if (isOperationalError(error)) {
      if (options?.json) {
        process.stdout.write(`${JSON.stringify({
          error: { code: error.code, message: error.message },
        }, null, 2)}\n`);
      } else {
        process.stderr.write(`catpaw: ${error.message}\n`);
      }
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

await main();
