import { runOperationCommand } from "../runtime-operations.mjs";

export async function runAdapterCommand(options) {
  return runOperationCommand("adapter", options);
}
