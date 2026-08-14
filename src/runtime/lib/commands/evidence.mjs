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

export async function runEvidenceCommand(options) {
  if (options.command === "add") return runAdd(options);
  throw new TypeError(`Unsupported evidence command: ${options.command}`);
}

export { EVIDENCE_ORDER, evidenceMetadata };
