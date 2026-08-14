# Milestones

Milestone 是可选的多 Work 分组，用来让相关 Work 围绕一个连续目标推进，减少每
完成一项就重新询问“下一步”。它不是用户必须学习的第四个核心概念，也不替代
Work 或 Proof。

## Use When

- 一个 outcome 明确包含多个相关 Work Item；
- 工作需要连续推进数轮或跨多个 checkpoint；
- 用户说“推进这一阶段”“后面连续做”“统一收口”；
- 单项局部最优可能偏离整体 exit criteria。

单一、短 Work 默认不建 Milestone。

## Contract

Milestone 记录：ID、status、title、outcome/non-goals、managed Scope、exit
criteria、verification entry、需要用户协助的点、close summary、remaining risk
与 next phase。

Allowed status：`active | blocked | done | cancelled`。Scope 只引用已有 Work
Item；每个 Work 仍独立保存内部 routing、Plan 与 typed Evidence。

## CLI

```text
catpaw milestone start --id <id> --title <title>
catpaw milestone show  --id <id>
catpaw milestone add   --milestone <id> --work <work-id>
catpaw milestone finish --id <id>
catpaw milestone cancel --id <id>
```

`milestone close --status done|cancelled` remains compatible.

默认 dry-run；写入需要 `--apply`。Done close 要求 Scope 非空且全部 Work 已进入
terminal status。Cancelled 不伪造 completion claim。

## Continuous Progress

开始前固定 outcome、non-goals、Scope 和 exit criteria。执行中每完成一个 Work
就更新 artifact 与 Milestone Scope，然后继续下一个已授权单元；只在产品判断、
外部操作、新授权或 blocker 时停下。Close 时统一报告完成项、验证、风险和下一
phase，不让用户再追问当前到了哪里。
