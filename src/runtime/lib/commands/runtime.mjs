import { runOperationCommand } from "../runtime-operations.mjs";

export async function runRuntimeCommand(options) {
  return runOperationCommand("runtime", options);
}
