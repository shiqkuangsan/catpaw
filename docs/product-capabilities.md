# CatPaw 产品能力

CatPaw 为 coding agent 提供工作协议、工程方法、项目记忆和可重复的本地操作。
目标是让主 Agent 持续完成有依据的交付：知道当前目标、保留重要决定、验证真实
结果，并在已有授权内推进。主 Agent 负责理解、取舍、编排和最终采纳。

本文是产品能力与设计取舍的全景索引，不是第二份执行规则。行为以链接的 runtime
authority 和对应实现为准；源码能力不等于本机安装或生产环境已经启用。

## 四个能力域

| 能力域 | 解决的问题 | 主要承担方式 |
|---|---|---|
| 工程方法 | Agent 会动手，但可能没查清问题、没锁定行为、没验证交付 | 按风险读取的方法与检查问题，由 Agent 执行 |
| 工作与证据 | 跨轮丢目标、旧结论失效、局部通过被当成整体完成 | Work/Evidence 本地记录 + CLI 一致性与候选检查 |
| Agent 协作 | 委派范围不清、自证、并发覆盖、把输出当最终结论 | 有界任务协议 + 可选只读外部 transport；主 Agent 编排 |
| 安装与维护 | 升级覆盖配置、迁移丢历史、构建和生效混淆 | 预览、暂存验证、preimage、备份与范围明确的恢复工具 |

### 工程方法

| 能力 | 当前可用内容 | 实际边界与权威 |
|---|---|---|
| Understand | 核对目标、范围、验收和授权；自己查事实，只问影响交付的必要问题；复杂工作可画浅层范围和依赖、选首个端到端切片 | [Work Handling](../src/runtime/guidance/workflow.md)。不是自动需求分析器，也不强制访谈、结构图或新工件 |
| 根因调查 | 最小复现、逐项排除、沿数据流定位、可证伪假设、单变量验证、修复和回归 | [Engineering Methods](../src/runtime/guidance/engineering-methods.md#debugging)。诊断不充分时只能声明缓解与缺口 |
| 行为锁定 | RED → GREEN → REFACTOR → REGRESSION | [RED/GREEN](../src/runtime/guidance/engineering-methods.md#redgreen)。用于行为或回归风险，不要求所有文档修改先写测试 |
| 双维度审查 | 检查交付合同与工程质量；复核重要发现再决定是否采纳 | [Review](../src/runtime/guidance/engineering-methods.md#review)。两个维度不等于固定两个 Agent |
| 有界原型 | 为一个高成本未知取得可复现答案，再决定丢弃或转正式实现 | [Prototype](../src/runtime/guidance/engineering-methods.md#prototype)。原型结果不自动取得发布或采纳权 |
| 五类检查视角 | 价值与范围、系统与契约、体验、安全、性能 | [Lenses](../src/runtime/lenses/README.md)。挑相关问题，不按角色逐卡走流程；也不自带浏览器或性能测量工具 |

这些是协议能力。可检验 Agent 是否采用了方法、产出了有效结果，但不能把规则文件
存在或文本测试通过说成 Agent 必然遵守，更不能据此声称生产效率提升。

### 工作与证据

| 能力 | 工具提供什么 | 主 Agent 仍要负责什么 |
|---|---|---|
| Work 生命周期 | `work start/show/update/finish/cancel/continue`；默认一个记录，Plan 可选；continue 保留终结快照并开启新周期 | 维护当前业务目标、范围、决定和 Next。`update` 目前只更新进展与 active/blocked 状态；验收、候选路径和 owner 精确编辑原记录后复查 |
| 轻重选择 | 小任务留在对话；需要连续性的工作持久化；高风险完成需要当前候选测试与独立检查 | 依据影响选方式，不把一行修改扩成工件仪式，也不为省事降低高风险要求 |
| Milestone | 组织已有 Work，维护范围快照；结束检查非空范围和所有成员终结 | 核对 outcome / exit criteria。终结包含取消，取消不能算交付 |
| Evidence | `add/list/show`；research/review/test/provider/reflection；支持 Work 或 topic、正文或文件/stdin；新契约同名记录追加保留 | 记录实际检查的声明、环境、原始结果位置和未覆盖部分；人工输入的事实和身份需要复核 |
| 命令结果捕获 | `evidence run` 默认预览；显式执行后记录结果、时长、退出码和摘要；保留失败及同名重跑 | 命令是否有权执行、是否覆盖验收；按项目规则保存必要原始日志。工具不存原始参数/输出，也不保证已脱离进程组的子进程终止 |
| 候选新鲜度 | contract 4 在 schema 2 内绑定文件内容/模式、验收、owner、周期、Work/Plan 内容；同候选后续失败覆盖旧通过 | 文件路径 scope 不等于业务范围或动作权限；指纹不覆盖 Git ignored 文件或项目外系统副作用 |
| 状态与修复 | `status` 查看当前工作、Next 和当前候选的证据缺口；候选不可读明确显示 unchecked；`board status/doctor` 检查结构；历史缺口可逐条修复 | 区分结构健康、记录门禁与真实验收；`doctor --fix` 只补必要目录，不自动修任意历史或刷新 dashboard |

权威：[Evidence Contract](../src/runtime/guidance/evidence.md)、
[Milestones](../src/runtime/guidance/milestones.md)、[schema](../src/runtime/schemas/board-v2.json)。
实现入口：[work](../src/runtime/lib/commands/work.mjs)、[evidence](../src/runtime/lib/commands/evidence.mjs)、
[candidate](../src/runtime/lib/candidate.mjs)、[completion](../src/runtime/lib/completion-evidence.mjs)、
[board](../src/runtime/lib/commands/board.mjs)。
行为回归：[Work 合同](../tests/work-contract.test.mjs)、[并发保护](../tests/workflow-concurrency.test.mjs)、
[嵌套仓库](../tests/candidate-nested.test.mjs)、[输入与兼容](../tests/proof-input.test.mjs)。

### Agent 协作

| 能力 | 当前可用内容 | 边界 |
|---|---|---|
| 三种任务意图 | `explore` 查事实/方案、`build` 实现/整合、`check` 审查/验证；可组合或分配给多个 actor | [Intent Catalog](../src/runtime/catalog/intents.json) 描述责任与权限上限，不选模型、不排班、不授予权限 |
| 有界委派与交接 | 指定目标、读写范围、产物、验证、停止条件和允许动作；只传下个动作需要的上下文 | [Agent Collaboration](../src/runtime/guidance/agent-dispatch.md)。内容可简短合并，不要求填写完整表单或持久化第二份台账 |
| 并发与候选采纳 | 同一可变范围同时一个负责写入者；竞争候选隔离；主 Agent 核查并决定采纳 | 规则不自动创建 worktree、调度团队、解决冲突或合并候选；委派作者不代替主 Agent 自行采纳 |
| 独立复核 | 风险触发不同 actor 检查；明确输出可用性、回退和未覆盖范围 | [Independent Checks](../src/runtime/guidance/independent-checks.md)。普通自检允许；换 intent 不构成独立性。工具里的 actor 名称不是身份认证 |
| `cc` / `cx` transport | 本地检查及 tmux open/send/status/read/close；为相互调用提供可观察的只读第二意见入口 | [Transports](../src/runtime/providers/README.md)。本地可执行文件/tmux 可用不等于模型服务已验证；exit zero/稳定输出不代表任务完成；提示词只读不等于工具强制隔离 |

CatPaw 的外部 transport 不是主 Agent 的全部团队。宿主提供的 subagent、模型、工具
由主 Agent 在当前权限内选择；这些选择不是 CatPaw 的独立自动化产品能力。
对应回归：[intent](../tests/intent-catalog.test.mjs)、[transport](../tests/provider-session.test.mjs)。

### 安装与维护

| 能力 | 当前可用内容 | 边界 |
|---|---|---|
| 包构建与校验 | manifest 驱动 source → dist；校验文件、hash、链接、CLI | [源码构建](../scripts/build-runtime.mjs)、[验证](../scripts/verify-runtime.mjs)。构建不安装，installed 旧版本是 pending activation |
| Runtime 安装/恢复 | `inspect/plan/apply/recover`；绑定包和目标 preimage，暂存验证、保留 state/未知文件、备份与持久操作日志 | [Maintenance](../src/runtime/guidance/maintenance.md)。两个受保护 rename 有短暂不可用窗口；恢复遇到漂移拒绝覆盖 |
| Host adapter | 只合并一个 CATPAW managed block，保留其它内容、格式和权限；支持预览、备份、恢复 | 同一安装不自动更新每个宿主规则；它是薄入口，不是另一份 runtime |
| schema 1 → 2 | 保守补齐可推断 metadata、原件校验归档、链接处理、暂存校验、preimage 与备份 | [Migration](../src/runtime/migrations/schema-2.md)。身份/路径/结构不安全时拒绝；board 发布不具备 runtime/adapter 的进程中断恢复日志；任意旧目录不是通用自动导入 |
| 本机项目索引 | advisory registry 格式与安全维护规则；源码诊断脚本只读查看项目状态 | [Registry](../src/runtime/guidance/maintenance.md#project-registry)、[诊断脚本](../scripts/catpaw-project.mjs)。没有正式 registry mutation CLI，不是远程项目管理服务 |

对应回归：[runtime/adapter](../tests/runtime-operations.test.mjs)、[migration](../tests/migration-v2.test.mjs)、
[patch engine](../tests/patch-plan.test.mjs)、[registry diagnostics](../tests/catpaw-project.test.mjs)。
安装、adapter、索引和各项目迁移有各自范围；用户一次明确授权可以覆盖多个范围，
不因检查点重复索要同一授权。

## 应当精炼和加强什么

| 方向 | 产品取舍 |
|---|---|
| 保留核心 | 工程方法、五类检查问题、Work/Evidence、独立复核、候选新鲜度、恢复与历史保留都有独立价值 |
| 合并重复 | 执行规则保留一个权威；迁移细节集中在 migration，证据语义集中在 evidence，协作结果集中在 agent-dispatch；首页只呈现价值和入口 |
| 加强准确性 | 状态页与实际完成检查一致；每次检查结果可保留；帮助入口可发现正文文件、topic、类型和结果捕获；明确局部验收与真实链路的差别 |
| 控制流程成本 | 小任务无工件，Plan/Milestone 可选，委派说明可合并，Lens 按问题选，已有授权持续有效 |
| 保留兼容 | 旧 Proof/命令别名、schema 2、历史记录和诊断脚本仍可读；不为整齐删除用户可用能力 |
| 暂不扩展 | 自动调度/自动采纳、语义验收裁判、身份认证、新授权账本、强制场景台账、团队云同步、通用 registry 写 CLI |

判断是否继续增加能力：它能否减少一个已复现的错误、丢失的决定或重复操作；已有
机制是否足够；维护和上下文成本是否值得。`work update` 的契约字段编辑目前仍由
Agent 完成，先明确入口与候选失效规则，出现持续使用成本后再扩展现有命令。

## 怎样证明它有价值

| 代表性任务 | 应观察的结果 |
|---|---|
| 一个小型明确修复 | 不创建多余 Plan/台账；使用最短有效复现和验证，持续完成已有授权工作 |
| 多轮需求改变范围 | 同一 Work 更新当前验收与 Next；旧候选证据不会继续通过门禁；原始有效结果可说明范围后复用 |
| 本地通过、真实 Jira/钉钉未验收 | 两种事实分别保留；主 Agent 补完已授权真实链路，不能把局部 passed 当整项完成 |
| 独立审查发现问题后重跑 | 保留首次失败、修复和后续结果；同名检查不覆盖历史；检查者不顺手修改实现 |
| 中断后接手 | 从 Work 和来源恢复当前目标、决定、缺口和 Next；不要求用户重述已记录的事实 |
| 安装/迁移过程中目标漂移 | 拒绝覆盖，保留可恢复副本；source、installed 和项目状态分别报告 |

CLI 行为测试证明指定工具场景；协议审查证明规则一致性；真实 Agent 回归只能证明
被测宿主与场景。长期收益需要从实际任务观察目标漂移、错误完成声明、用户重复
说明和无效打断是否减少，不能用测试数量、文档行数或一次成功任务代替。
