# CatPaw Policy

CatPaw 是 coding agent 的交付账本：用项目旁的本地文件，让“做完了”可核对、可续接。
它不规划任务、不编排 Agent、不授予权限。判断、取舍和最终交付由主 Agent 负责。

## 何时使用

项目有 `.catpaw/` 时遵循本文。小型、本地、可逆、一次会话能完成的事留在对话里，
不建 Work。跨会话、多步骤、涉及发布/迁移/数据/安全或用户要求跟踪的交付，建一个 Work。

## 四个名词

| 名词 | 含义 |
|---|---|
| Work | 一次交付：目标、验收、涉及的仓库、决定、Next，状态 open/blocked/done/dropped；可标 `risk: high` |
| Check | 一次针对验收的检查结果：passed/failed/blocked/not-run；self 或 independent；自动绑定当前 snapshot |
| Gap | 验收需要但尚未验证的部分：open，或经用户接受（accepted，写明理由） |
| Note | 其他带日期的记录：决定、发现、交接 |

snapshot 是每个涉及仓库的 `HEAD` 加未提交改动的哈希，由 CLI 计算；代码一变，旧 Check 就不再是当前的。

## 五条规则

1. 记录、Check、CLI 输出和 Agent 输出都不授予任何权限。权限只来自用户、项目和宿主规则。
2. Check 和 Note 只新增，已有记录不改写。后来的失败不能被更早的通过掩盖；通过只对当前 snapshot 有效。
3. 存在 open Gap 不能 done。用户接受的 Gap 保持可见，永远不等于通过。
4. `risk: high` 的 Work 完成还需要：当前 snapshot 上最近的 self Check 和 independent Check 都是 passed。
5. 同一可写范围同时只有一个写入者；independent Check 的执行者不是该范围的实现者。

`catpaw finish` 和 `catpaw gate` 机械执行规则 2–4；`WORK.md` 或 `LOG.md` 有无法解析的内容
（如写错格式的 Gap 行）时同样拒绝，修正格式即可。规则 1、5 和 Check 内容是否真实覆盖验收，由主 Agent 负责。

## 工作方式

- **开始**：`catpaw start "<标题>"`，`--risk high` 用于发布、迁移、外部/不可逆操作、数据完整性、
  安全或高影响契约；跨仓库用 `--repos .,../other`。在 `WORK.md` 写清 Goal、Acceptance 和 Next。
  只有会改变目标、范围、验收或权限的歧义才停下来问用户；其余自己查明。
- **执行中**：`WORK.md` 是当前状态，直接编辑并保持简短；过时内容删掉，历史进 `LOG.md`（schema 4 最新在前）。
  每完成一个有意义单元就更新 Next；新的决定用 `catpaw note` 记一笔。
- **检查**：能用命令验证的，让 CatPaw 代跑：`catpaw check <id> "<覆盖了什么>" -- <命令>`，
  结果由退出码决定，输出存到 `.catpaw/runs/`，失败自动入账；heredoc 或管道输入会转给命令并一起保存。无法用命令表达的（手动验证、
  生产观察、审查）才自报：`catpaw check <id> <result> "<覆盖了什么>"`，用 `--output` 指向原始结果。
  失败也要记录，而且要先记失败再修。读代码、进程启动、Agent 自称完成都不是 Check；
  命令能否覆盖验收仍由主 Agent 判断。
- **缺口**：验收范围内没有实际验证的部分都是 Gap，用 `catpaw gap <id> add` 记录：本地通过但真实服务、
  生产、某平台或某场景未验证，或某条验收没有跑。开发验收与生产交付不同：只做到开发验收就把生产验证列为 Gap。
  `WORK.md`、Next 或交付报告里写到“未验证、未测、未跑”的内容，必须逐条对应一个 Gap，不能只写在文字里。
  用户事先同意不做的部分，也先记 Gap 再由用户接受（理由引用用户原话），不要自行从 Acceptance 删除。
  不能替用户接受 Gap。
- **完成**：`catpaw finish <id>`。被拒绝时按输出补检查或补 Gap，不改记录绕过。
  交付报告分别说明：已验证什么、未验证什么（逐条对应 Gap）、做了哪些外部动作。
- **续接**：会话开始时先看 `catpaw status`（配置了 hook 时会自动注入），再看对应 Work 的 `WORK.md`；
  不让用户重述已记录的事实。

## 独立检查

`risk: high` 需要 independent Check：由没有参与实现的另一个 Agent、子 Agent 或人执行，
只读审查或验证当前 snapshot，结果由主 Agent 核对后用 `--independent --actor <名称>` 记录。
主 Agent 自己复查是 self Check。独立检查发现问题时，先记录 failed，再修，再重新检查。

## 命令

```text
catpaw init | start | status [id] | check [-- <命令>] | note | gap add|accept|close
catpaw finish | block | reopen | drop | gate [id] | hook session-start | convert | policy
```

参数以 `catpaw --help` 为准。普通写入立即生效；`convert` 默认预览，`--apply` 才执行。
