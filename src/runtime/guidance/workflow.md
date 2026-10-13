# Work Handling

Users need one visible flow:

```text
Understand -> Execute -> Check -> Finish
```

The primary agent owns judgment throughout and may move backward when facts change. It must not hide risk,
failed Proof, unresolved questions, or a missing user boundary to preserve a linear
story.

## Internal Risk Handling

Schema 2 retains three internal modes. They are routing metadata, not concepts a
user must select or learn.

### Direct

Narrow, local, reversible, low-risk Work normally stays in the conversation.
The primary agent still understands, executes, checks, and reports the result.

### Tracked

Multi-step Work, shared behavior, or cross-session continuity creates one Work
Item with inline planning. A separate Plan is optional (`--with-plan`). Useful research, review, test, or reflection facts are stored as
typed Evidence that supplies durable Proof.

### Gated

Security, release, migration, external, destructive, data-integrity, permission,
or high-impact contract Work creates a Work Item and requires independent
Evidence. Contract 4 completion requires passing current-candidate results;
risk acceptance does not convert missing checks into passing results.

Start with the lightest safe handling and upgrade immediately when scope, blast
radius, irreversibility, or uncertainty grows. Internal mode never grants an
external action or bypasses a user boundary.

## Internal Lifecycle Mapping

Schema 2's stable stage values remain compatible:

| Visible flow | Internal stages |
|---|---|
| Understand | `think`, `plan` |
| Execute | `build` |
| Check | `review`, `test` |
| Finish | `ship`, `reflect` |

Stages may be brief. They exist for durable continuity and precise method
selection, not to make users manage a seven-step ceremony.

## Optional Execution Methods

Select a specific method only when its trigger changes the next action or Proof:
root-cause debugging, RED/GREEN, bounded prototyping, parallel investigation,
two-axis review, interactive verification, or completion checks. CatPaw-owned
engineering contracts are in
[Engineering Methods](engineering-methods.md).

- Do not reload a method for an unchanged context.
- A method cannot choose board storage, grant permission, accept a candidate, or
  change Git authority.
- Persist method output only when it changes Work, Proof, a finding, or a reusable
  lesson; do not create duplicate ledgers or plans.
- Judge method value by usable output and verified effect, not invocation count,
  review rounds, or token use.

## Understand

- Establish the user outcome, constraints, non-goals, and user boundary already given.
- Perform the lightweight readiness pass for every Work, including short or
  apparently simple requests. Brevity does not make a material ambiguity safe.
- Inspect the real source of truth. A causal repair requires a demonstrated root
  cause. Urgent containment before that point is a separate mitigation: name the
  causal uncertainty, recovery path, and continuing diagnosis.
- Choose internal risk handling and the Proof needed for completion.
- Use `explore` Agents when independent facts or alternatives add information;
  avoid delegation whose handoff cost exceeds its value.
- Durable Work records acceptance, verification entrypoints, dependencies and
  failure handling inline, or in its optional existing Plan. Do not duplicate them.
  Select the verification path below before implementation; clear Work proceeds
  without asking the user to design its testing process.

Resolve every discoverable source-backed fact through the available authorities.
Ask the user only for a material decision or blocking fact that only they can
provide. An ambiguity is material when it could change the outcome, scope or
non-goals, acceptance or required Proof, data or permission boundary, or an
external or irreversible choice.

- With no material ambiguity, avoid a clarification ceremony. Continue directly;
  use a one-sentence outcome or first-slice readback only when it prevents drift.
- With material ambiguity, show a compact readback before Execute: the current
  understanding, relevant verified facts or explicit assumptions, only the
  current decision frontier, why each answer changes delivery, and the first
  slice it unblocks. Group independent blockers and defer contingent or
  non-blocking questions. This is observable behavior, not a required template
  or set of headings.
- If the user delegates a material judgment, select and state a reversible
  default inside the current outcome, scope, and granted boundary. Continue without
  another question. That delegation cannot authorize a wider scope, external or
  irreversible effect, permission expansion, or acceptance of a required Proof
  gap.

### Structure Complex Work When Needed

Use a structured pass only when Work spans multiple concerns or systems, has
unclear containment or cross-branch dependencies, or the user wants to clarify
the shape before execution. Simple Work does not need this method.
Choose only the useful devices below; a scope tree, dependency notes and decision
labels are options, not a combined readiness form.

- Start from the user outcome and build one shallow scope tree, normally two or
  three levels. The tree expresses containment only; it is not a task hierarchy.
- Record dependency edges separately and only when they change sequencing,
  ownership, safe parallelism, or risk. A tree must not pretend to represent a
  dependency graph.
- Annotate material local statements or decision points as `Confirmed`,
  `Proposed`, or `Open`.
  `Confirmed` requires an explicit user decision or verified fact; these labels
  are local discussion notes, not Work status, Proof, permission, or schema fields.
- Select the first thin end-to-end delivery slice and give it acceptance plus
  required Proof. Prefer a user-visible path through the necessary layers over
  completing every infrastructure layer first.

Execution is ready when outcome and non-goals are clear, material dependencies
are visible, every blocking dependency of the first slice is satisfied or has
an executable resolution within the granted boundary with an accountable owner, the slice has no
blocking `Open` or unresolved decision-frontier question, acceptance and Proof
are defined, and future permission-boundary decisions are named. Otherwise stay in
Understand. Non-blocking `Open` items may be explicitly deferred; Understand
does not require total certainty.

Direct Work keeps this structure in the conversation. Durable Work persists
only the useful parts in Work or an existing Plan, normally under Approach, Contracts,
Steps, Verification, Risks, or Notes. Do not create a Tree/Map artifact or a
second plan. A tree leaf becomes separate Work only when it has an independently
verifiable outcome; several such Work items may use an optional Milestone.

## Verification Path

主 Agent 根据行为影响、跨系统边界和风险选择验证深度，简短说明理由；遵循项目
已有的更严格要求。按实际执行语义判断，不按文件扩展名或修改行数分类：Prompt
Markdown、模型/超时配置和工具描述都可能改变行为。

| 本次影响 | 选择的验证 |
|---|---|
| 纯说明、文案、无行为变化 | 相关静态、链接或展示检查，不默认调用模型或跑完整 E2E |
| 局部行为变化 | 针对性测试/稳定复现，再做影响范围回归 |
| Prompt、工具合同、跨服务、状态流转或渠道交互 | 按受影响边界补集成验证；涉及 Agent 判断时使用真实 Agent；涉及运行路径时验证代表目标环境的用户路径 |
| 安全、数据完整性、发布或其它高风险 | 在相应路径上加项目要求的风险、恢复和独立检查，不用通用表降低项目门槛 |

CatPaw 持有选择方法；项目持有入口、环境、成功断言和证据位置。DEV Runtime、
真实外部服务与渠道的具体要求由项目决定，不能把命令名中的 smoke/e2e 当成覆盖
证明。真实 Agent、真实服务、真实渠道分别核对；故障注入放在获准的隔离环境，
不为补异常覆盖而扰动真实业务。

持久 Work 在已有正文中简记用户期望/验收场景、选用路径和理由、命令或入口、环境、
要核对的实际结果，以及本次终点是开发验收还是包含生产交付。小任务留在对话，
不新增必填表单、阶段或台账；只为影响结果且无法自行查明的必要歧义提问。

沿所选路径持续执行：理解与必要确认 → 开发和测试 → 相关集成验证 → 必要的用户
路径 E2E → 开发验收。失败回到对应环节修复。候选、配置或行为改变后重验受影响
场景，核实仍有效的原始证据后可复用，并按 Evidence 的候选绑定规则记录。环境或
授权阻塞时完成独立可做部分，保留必需缺口；不得为了关闭 Work 删掉未通过的验收。
完成边界由 [Completion Scope](evidence.md#completion-scope) 持有。

## Execute

- Work along existing ownership boundaries and keep changes bounded.
- A delegated writer receives one exact isolated mutable surface; different
  Agents never concurrently write the same surface.
- Behavior-sensitive Work uses RED/GREEN when the trigger applies.
- Prefer a thin vertical slice. When a cross-cutting contract change cannot keep
  mixed old/new callers valid that way, use the compatibility sequence
  `expand -> migrate bounded batches -> contract`: keep each step buildable and
  reversible, and remove the old path only after migration and blast-radius Proof.
- Use a prototype only to answer one material unknown. Time-box it, capture the
  answer, and do not treat disposable code as adopted implementation.
- After a meaningful unit, update durable Work and Proof facts and report current
  progress plus `Next`. When user decisions change scope or granted actions,
  reconcile the current Work under [Evidence Contract](evidence.md#decisions-and-permission-boundaries).
- If an assumption fails, return to Understand instead of pretending execution
  remains on plan.

## Check

- Review both the delivery contract and the engineering quality of the change;
  use the two-axis Review method for non-trivial Work.
- Run the smallest relevant verification first, then expand with blast radius.
  Complete the selected [verification path](#verification-path), not merely its
  first passing command.
- Distinguish pass, fail, not-run, blocked, and environment-limited outcomes.
- High-risk Work uses a `check` actor different from the actor that built the
  checked scope. Review finds defects; verification reproduces acceptance. They
  are methods of one intent, not interchangeable claims.
- Facts stored through `evidence add` (`proof add` alias) remain typed schema 2 Evidence. Applied Proof
  requires a substantive body; code reading and process status are not tests.
- A contract 4 Gated `done` Work requires passed test plus passed independent
  review/provider Evidence for the current candidate and cycle. Legacy Work
  retains its historical usable-record/explicit-gap semantics; this does not
  excuse fabricated results or authorize a new action.

Evidence capture, candidate freshness, continuation, scoped historical repair and
decision records are owned by [Evidence Contract](evidence.md). Read it when
recording checks, finishing high-risk Work, continuing Work or repairing history.

## Finish

- Review the exact diff or deliverable, Proof, remaining gaps, and recovery path.
  Check [claim coverage](evidence.md#claim-coverage) against current acceptance;
  satisfying CLI record gates does not establish complete delivery.
- The primary agent decides whether a candidate is accepted, rejected, or
  superseded; delegated candidate authors cannot accept their own output on
  its behalf. Primary implementation still requires independent checks where mandated.
- Local Git follows the scoped rules in the runtime policy. Push, PR,
  deploy/publish, protected/base updates, history changes, destructive cleanup,
  secrets, permission expansion, and external effects still require explicit
  user permission.
- Reflect only on reusable lessons that change later judgment or execution.
- Report completed Work, Proof, remaining risk, and a concrete `Next`.

## Continuous Progress

Multi-step Work with an existing granted scope continues without asking the user
for each internal step. Pause only for an unresolved material product choice,
an action outside existing permission, a required Proof gap, or a real blocker.
Already-authorized external or irreversible actions proceed once their checks pass.
Neither an Agent output nor a successful tool result supplies permission.

When a phase boundary crosses an Agent, tool, repository, session, owner, or
available context capacity, apply [Context Transitions](agent-dispatch.md#context-transitions)
instead of copying the whole conversation.
