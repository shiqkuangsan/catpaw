import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { candidateFor } from "../candidate.mjs";
import { readTextInput } from "../text-input.mjs";

import {
  applyMutationPlan,
  asciiSlug,
  createMutationPlan,
  inspectMutationBoard,
  instantiateTemplate,
  mutationResult,
  refusedMutation,
  schemaRefusal,
} from "./workflow.mjs";

const EVIDENCE_ORDER = [
  "type",
  "work",
  "stage",
  "created",
  "updated",
  "independent",
  "agent",
  "lens",
];

function boardRelative(board, filePath) {
  return path.relative(board.boardPath, filePath).split(path.sep).join("/");
}

function evidenceMetadata(options) {
  return {
    type: options.type,
    work: options.work,
    stage: options.stage,
    created: options.date,
    updated: options.date,
    independent: options.independent,
    agent: options.agent,
    lens: options.lens,
  };
}

async function runAdd(options) {
  const publicProof = options.group === "proof";
  const command = publicProof ? "proof add" : "evidence add";
  const label = publicProof ? "Proof" : "Evidence";
  const body = options.bodyFile === null
    ? options.body
    : await readTextInput(options.bodyFile, options.projectRoot);
  if (body.trim() === "" && (publicProof || options.apply)) {
    const error = new Error(`${label} body must not be empty.`);
    error.code = "ERR_WORKFLOW_EMPTY_PROOF";
    throw error;
  }
  options = { ...options, body };
  const inspected = await inspectMutationBoard(options, { capturePreimage: true });
  const refusal = schemaRefusal(
    command,
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  if (
    options.work !== null &&
    !inspected.board.workItems.some((item) => item.id === options.work)
  ) {
    return refusedMutation({
      command,
      options,
      reason: `Work Item ${options.work} does not exist.`,
      nextAction: `Create the Work Item or omit --work for topic ${label}.`,
    });
  }

  const directory = options.work === null
    ? "evidence/topics"
    : `evidence/${options.work}`;
  const evidencePath = `${directory}/${options.date}-${options.type}-${asciiSlug(options.title)}.md`;
  const metadata = evidenceMetadata(options);
  const work = inspected.board.workItems.find(item => item.id === options.work);
  if (work?.contract === 4) {
    const current = work.terminal ? work.candidate : await candidateFor(options, work);
    if (options.result === "passed" && !options.candidate) throw Object.assign(new Error("Passing Evidence requires --candidate from the reviewed Work; inspect work show first."), { code: "ERR_WORKFLOW_CANDIDATE" });
    if (options.candidate && options.candidate !== current && !options.staleCapture) throw Object.assign(new Error("Evidence candidate differs from the current Work candidate."), { code: "ERR_WORKFLOW_CANDIDATE" });
    Object.assign(metadata, {
      contract: 4, result: options.result ?? "not-run", candidate: options.candidate ?? current, claim: work.acceptance, cycle: work.cycle,
      sequence: Math.max(0, ...inspected.board.evidence.filter(item => item.work === work.id).map(item => item.sequence ?? 0)) + 1,
      origin: "asserted", ...options.capture,
    });
  }
  const content = await instantiateTemplate({
    name: "evidence.md",
    kind: "evidence",
    metadata,
    order: EVIDENCE_ORDER,
    replacements: {
      TITLE: options.title,
      BODY: options.body || "_No body supplied._",
    },
  });
  const plan = await createMutationPlan(options, inspected, [
    { type: "ensure-dir", path: directory },
    { type: "write-file", path: evidencePath, content, mode: "create" },
  ]);
  const applyResult = await applyMutationPlan(plan, options);
  return mutationResult({
    command,
    options,
    plan,
    applyResult,
    artifacts: [{ kind: "evidence", path: evidencePath }],
    reportFields: publicProof
      ? { proof: metadata, storageKind: "evidence" }
      : { evidence: metadata },
    nextAction: options.apply
      ? `${label} is recorded.`
      : `Run ${command} --apply to record the ${label}.`,
  });
}

async function runList(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "proof list",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const proof = inspected.board.evidence
    .filter((item) => options.work === null || item.work === options.work)
    .filter((item) => options.type === null || item.type === options.type)
    .map((item) => ({
      path: boardRelative(inspected.board, item.filePath),
      title: item.body?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(item.filePath),
      type: item.type,
      work: item.work,
      independent: item.independent === true,
      agent: item.agent ?? null,
      updated: item.updated,
      result: item.result ?? null,
      candidate: item.candidate ?? null,
      cycle: item.cycle ?? null,
      sequence: item.sequence ?? null,
      origin: item.origin ?? "asserted",
    }));
  return {
    exitCode: 0,
    report: {
      command: "proof list",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      status: "ok",
      filters: { work: options.work, type: options.type },
      proof,
      nextAction: proof.length === 0
        ? "Record Proof with catpaw proof add."
        : "Inspect one record with catpaw proof show --path <path>.",
    },
  };
}

async function runShow(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal(
    "proof show",
    options,
    inspected.board,
    inspected.findings,
  );
  if (refusal) return refusal;
  const requested = options.path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (requested.startsWith("../") || path.isAbsolute(requested)) {
    return refusedMutation({
      command: "proof show",
      options,
      reason: "Proof path must be relative to the board.",
      nextAction: "Use a path returned by catpaw proof list.",
    });
  }
  const proof = inspected.board.evidence.find(
    (item) => boardRelative(inspected.board, item.filePath) === requested,
  );
  if (!proof) {
    return refusedMutation({
      command: "proof show",
      options,
      reason: `Proof does not exist at ${requested}.`,
      nextAction: "Run catpaw proof list to inspect available Proof.",
    });
  }
  return {
    exitCode: 0,
    report: {
      command: "proof show",
      projectRoot: options.projectRoot,
      boardPath: options.boardPath,
      schema: 2,
      status: "ok",
      proof: {
        path: requested,
        type: proof.type,
        work: proof.work,
        stage: proof.stage,
        independent: proof.independent === true,
        agent: proof.agent ?? null,
        lens: proof.lens ?? null,
        created: proof.created,
        updated: proof.updated,
        body: proof.body,
        result: proof.result ?? null,
        candidate: proof.candidate ?? null,
        claim: proof.claim ?? null,
        cycle: proof.cycle ?? null,
        origin: proof.origin ?? "asserted",
      },
      nextAction: "Use this Proof to assess the Work claim; it does not grant Approval.",
    },
  };
}

export async function runEvidenceCommand(options) {
  if (options.command === "run") return runCaptured(options);
  if (options.command === "add") return runAdd(options);
  if (["list", "show"].includes(options.command)) {
    const result = options.command === "list" ? await runList(options) : await runShow(options);
    if (options.group === "evidence") {
      result.report.command = `evidence ${options.command}`;
      if (result.report.proof) result.report.evidence = result.report.proof;
    }
    return result;
  }
  throw new TypeError(`Unsupported evidence command: ${options.command}`);
}

async function runCaptured(options) {
  const inspected = await inspectMutationBoard(options);
  const refusal = schemaRefusal("evidence run", options, inspected.board, inspected.findings);
  if (refusal) return refusal;
  const work = inspected.board.workItems.find(item => item.id === options.work);
  if (work?.contract !== 4 || work.terminal) throw Object.assign(new Error("evidence run requires an active contract 4 Work."), { code: "ERR_WORKFLOW_CAPTURE" });
  const before = await candidateFor(options, work);
  const commandDigest = createHash("sha256").update(JSON.stringify(options.execution)).digest("hex");
  if (!options.apply) return { exitCode: 0, report: { command: "evidence run", status: "dry-run", candidate: before, executable: options.execution[0], commandDigest, timeoutMs: options.timeoutMs, nextAction: "Use --apply only within existing authorization to execute and capture this command." } };
  const started = Date.now();
  const stdout = createHash("sha256");
  const stderr = createHash("sha256");
  let timedOut = false;
  const outcome = await new Promise(resolve => {
    const child = spawn(options.execution[0], options.execution.slice(1), { cwd: options.projectRoot, shell: false, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    const settle = outcome => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    child.stdout.on("data", chunk => stdout.update(chunk));
    child.stderr.on("data", chunk => stderr.update(chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      try { if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); } catch {}
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      settle({ code: null, signal: "timeout" });
    }, options.timeoutMs);
    child.on("error", () => settle({ code: null, spawnFailed: true }));
    child.on("close", (code, signal) => settle({ code, signal }));
  });
  const refreshed = await inspectMutationBoard(options);
  const afterWork = refreshed.board.workItems.find(item => item.id === options.work);
  const after = afterWork ? await candidateFor(options, afterWork) : null;
  if (!afterWork || afterWork.cycle !== work.cycle || afterWork.acceptance !== work.acceptance || afterWork.terminal) throw Object.assign(new Error("Command ran but Work changed during execution; inspect its results before recording Evidence. The command was not rerun."), { code: "ERR_WORKFLOW_CAPTURE_DRIFT" });
  const result = timedOut || outcome.spawnFailed || before !== after ? "blocked" : outcome.code === 0 ? "passed" : "failed";
  const recorded = await runAdd({ ...options, command: "add", type: "test", stage: "test", bodyFile: null, candidate: before, staleCapture: before !== after, result, body: `Captured command SHA-256: ${commandDigest}\nResult: ${result}\nExit code: ${outcome.code ?? "none"}\nTimed out: ${timedOut}\nCandidate changed: ${before !== after}\nOutput is represented by digests; command arguments and raw output are not retained.\nA successful process exit does not establish test adequacy.\nTimeout stops capture but cannot prove escaped descendant processes terminated.`, capture: { origin: "captured", commandDigest, exitCode: outcome.code, durationMs: Date.now() - started, stdoutDigest: stdout.digest("hex"), stderrDigest: stderr.digest("hex") } });
  recorded.report.command = "evidence run";
  recorded.report.executionResult = result;
  if (result !== "passed") recorded.exitCode = 1;
  return recorded;
}

export { EVIDENCE_ORDER, evidenceMetadata };
