# CatPaw Runtime

CatPaw 为主 Agent 提供工作协议、工程方法、项目记忆和本地工具，帮助它持续推进，并保留可核对的
完成依据。主 Agent 负责判断、编排和最终采纳；CLI 负责可重复的记录与一致性检查。

```text
Understand -> Execute -> Check -> Finish
```

## 日常入口

先读 [Runtime Policy](runtime-policy.md)。恢复已有工作时运行 `catpaw status`；
参数以 `catpaw <command> --help` 为准。小任务留在对话，需要连续性时才建一份 Work。
计划默认内联，不另建重复台账。Evidence 支撑具体声明，Proof 是兼容称呼；
Approval 表示用户权限边界，记录与工具结果不能授予权限。

| 要做什么 | 命令入口 | 按需读取 |
|---|---|---|
| 开始、推进或结束工作 | `work` | [Work Handling](guidance/workflow.md) |
| 调查根因、锁定行为、审查或做有界原型 | Agent 按需执行 | [Engineering Methods](guidance/engineering-methods.md) |
| 选择价值、系统、体验、安全或性能检查问题 | Agent 按风险选择 | [Lenses](lenses/README.md) |
| 记录或捕获验证结果 | `evidence` | [Evidence Contract](guidance/evidence.md) |
| 组织多个相关工作 | `milestone` | [Milestones](guidance/milestones.md) |
| 查看 `explore`、`build`、`check` 委派任务类型 | `intent` | [Agent Collaboration](guidance/agent-dispatch.md) |
| 取得独立检查、选择回退并报告缺口 | 主 Agent 委派 | [Independent Checks](guidance/independent-checks.md) |
| 调用只读 `cc` / `cx` 第二意见 | `transport` | [Agent Transports](providers/README.md) |
| 检查或维护工作板 | `board` | [Maintenance](guidance/maintenance.md) |
| 安装、更新或恢复 runtime / adapter | `runtime` / `adapter` | [AI Install](AI-INSTALL.md) |

写操作默认 dry-run，显式 `--apply` 才执行；这不替代对应动作的授权。
`evidence run` 默认也只预览，执行成功仅证明命令运行结果，不能证明验收充分。
候选有效性、记录一致性与实际完成分别核对，具体见 [Evidence Contract](guidance/evidence.md)。

`catpaw` 是命令路径的简称：源码中为 `src/runtime/bin/catpaw.mjs`，安装后为
`~/.catpaw/bin/catpaw.mjs`；用 Node 运行。CatPaw 不自动修改 `PATH`。

## 存储与兼容

项目 `.catpaw/` 保存 `work/`、可选 `plans/` / `milestones/`、`evidence/` 和
`index.md`。它是项目记忆，不是 runtime 副本；共享与保留方式由项目决定。

工作板仍用 schema 2。新 Work 的 contract 4 绑定候选、验收和周期；
`work continue` 保留历史完成并开启新周期。旧记录保留原有语义，旧 runtime 可能
拒绝新字段；无需批量迁移。Schema 1 导入可保留隔离的 `legacy/schema-1/` 校验归档。

`proof add|list|show`、`work close`、`milestone close`、`agent ...` 和
`work start --mode tracked|gated` 继续兼容。内部 metadata 不要求用户操作；
存储契约由 [Schema 2](schemas/board-v2.json) 持有，CLI help 说明可用参数。

## 安装边界

已安装 runtime 位于 `~/.catpaw/`。源码、dist、installed runtime、host adapter
和项目工作板分别管理；构建不等于激活。一项授权不自动扩展到其它范围，已有完整
授权则连续执行。安装与恢复流程见 [AI Install](AI-INSTALL.md) 和
[Maintenance](guidance/maintenance.md)。
