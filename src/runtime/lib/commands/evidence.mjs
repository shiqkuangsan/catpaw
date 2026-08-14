import { readFile } from "node:fs/promises";
import path from "node:path";

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

async function readInputFile(file, projectRoot) {
  return file === "-"
    ? readFile(0, "utf8")
    : readFile(path.resolve(projectRoot, file), "utf8");
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
    : await readInputFile(options.bodyFile, options.projectRoot);
  if (body.trim() === "" && (publicProof || options.apply)) {
    const error = new Error(`${label} body must not be empty.`);
    error.code = "ERR_WORKFLOW_EMPTY_PROOF";
    throw error;
  }
  options = { ...options, body };
  const inspected = await inspectMutationBoard(options);
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
  const plan = await createMutationPlan(options, [
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
      },
      nextAction: "Use this Proof to assess the Work claim; it does not grant Approval.",
    },
  };
}

export async function runEvidenceCommand(options) {
  if (options.command === "add") return runAdd(options);
  if (options.command === "list") return runList(options);
  if (options.command === "show") return runShow(options);
  throw new TypeError(`Unsupported evidence command: ${options.command}`);
}

export { EVIDENCE_ORDER, evidenceMetadata };
