# CatPaw Lenses

Lens 描述“需要什么判断”，Agent 描述“谁来提供判断”。CatPaw 只保留五个
稳定 Lens；工程质量、QA、发布、调试和复盘属于 lifecycle method，不再作为
独立角色树。

| Lens | Primary concern |
|---|---|
| [Value & Scope](value-scope.md) | 用户价值、问题定义、范围与顺序 |
| [System & Contracts](system-contracts.md) | 边界、ownership、数据流与不变量 |
| [Experience](experience.md) | UI/DX 的理解、完成、恢复与反馈 |
| [Security](security.md) | 信任、权限、输入、秘密与供应链 |
| [Performance](performance.md) | 基线、热点、资源成本与语义等价 |

按风险选择一个 primary Lens，再补真正相关的其它 Lens。不要为了“覆盖所有角色”
逐卡走流程。Lens finding 需要事实或验证支持，并遵守
[`Independent Checks`](../guidance/independent-checks.md)。
