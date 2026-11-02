# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是 coding agent 的交付账本：在项目旁保存本地文件，让 agent 说的“做完了”可以被核对，
下一个会话或 agent 可以接着做。

它不是任务板、方法库、Agent 编排器，也不是权限系统。判断由主 Agent 负责；CatPaw 记录验证了
什么、没验证什么，并拒绝记录不支持的完成。

## 四个概念

| 概念 | 含义 |
|---|---|
| Work | 一次交付：目标、验收、涉及的仓库、决定、Next；open/blocked/done/dropped；可标 `risk: high` |
| Check | 一次带日期的结果：passed/failed/blocked/not-run；self 或 independent；绑定所有涉及仓库的当前 snapshot |
| Gap | 验收需要但尚未验证的部分：open，或经用户接受（accepted，写明理由） |
| Note | 其他带日期的记录：决定、发现、交接 |

## 五条规则

1. 记录和工具输出不授予任何权限。
2. Check 和 Note 只追加；后来的失败不能被更早的通过掩盖，通过只对当前 snapshot 有效。
3. 有 open Gap 不能 done；被接受的 Gap 保持可见，永远不等于通过。
4. `risk: high` 还需要当前 snapshot 上通过的 self 和 independent Check。
5. 同一可写范围只有一个写入者；独立检查者不是实现者。

`catpaw finish` 和 `catpaw gate` 机械执行规则 2–4。完整的 Agent 规则见
[src/runtime/policy.md](src/runtime/policy.md)。

## 使用

```bash
npm install -g /path/to/catpaw
catpaw init
catpaw start "限制 Jira 流转权限" --risk high --repos .,../jira
catpaw check W-001 "单测与契约测试" -- npm test
catpaw check W-001 passed "安全审查" --independent --actor reviewer
catpaw gap W-001 add "生产钉钉链路未验证"
catpaw finish W-001
```

hook 会在会话开始时注入进行中的 Work（Claude Code），并在推送时拦截不一致的记录（Git pre-push）。
宿主接入、看板格式和 schema 2 转换见 [src/runtime/README.md](src/runtime/README.md)。

## 开发

```bash
npm test
```

设计依据在 [docs/](docs/README.md)；当前设计见
[ADR-0035](docs/decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md)。
CatPaw 不隶属于任何模型厂商或同名产品；见 [NOTICE.md](NOTICE.md) 和 [LICENSE](LICENSE)。
