# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 为 coding agent 提供轻量工作协议、工程方法、项目记忆和本地工具。
它帮助主 Agent 把事情持续做完，并留下可核对的完成依据。

主 Agent 负责判断、编排和最终采纳；CatPaw 提供工作连续性、工程方法和保持记录一致的
工具。重要选择和权限仍由用户掌握。

## 为什么需要它

| 工作中的难点 | CatPaw 提供什么 |
|---|---|
| 换会话、换 Agent 后需要重新交代 | 一份 Work 保留目标、决定、进展、缺口和 Next。 |
| 本地测试通过，实际交付还没验证 | Evidence 说明验证了什么、对应哪个候选、还缺什么。 |
| 高风险改动需要另一双眼睛 | 独立检查挑战实现，主 Agent 核实发现并决定如何处理。 |
| 每个内部步骤都在重复请示 | 已有授权跨步骤有效，新增边界才需要新的决定。 |

这些机制一起发挥作用：记忆保住目标，证据支撑声明，权限边界让执行持续推进。
衡量价值看少丢了多少决定、少报了多少未经验证的完成、少打断了多少次用户，
而不是多写了多少流程记录。

## 日常怎么工作

```text
Understand -> Execute -> Check -> Finish
```

Agent 理清结果，在授权内执行，检查实际效果，再交代交付状态。新事实出现时可以
回到前一步；目标清楚就直接推进，不做固定问询。

小型、本地、可逆的任务留在对话。需要连续性的工作在 `.catpaw/` 留一份 Work，
计划默认写在其中；独立 Plan 和 Milestone 按需使用。工程方法和协作细则只在影响
下一步动作或验收依据时加载。

例如，某项改动本地测试已通过，真实服务联调尚未完成。Agent 应保留这个缺口，
继续完成已授权的验证，并在交付时分别说明实现、验收和部署状态。记录变绿本身
不能证明已经交付。

## 完整能力

| 能力域 | 内容 |
|---|---|
| 工程方法 | 需求理解与切片、根因调查、RED/GREEN、合同与工程审查、有界原型、五类检查视角 |
| 工作与证据 | Work 生命周期、可选 Plan/Milestone、Evidence 记录和命令捕获、候选新鲜度、历史续接 |
| Agent 协作 | explore/build/check、有界委派与交接、独立复核、并发写入边界、cc/cx transport |
| 安装与维护 | 工作板检查和迁移、runtime/adapter 预览与恢复、构建验证、本机项目索引 |

[产品能力全景](docs/product-capabilities.md) 逐项说明可用能力、实现入口、真实边界和
设计取舍。工程方法依靠 Agent 执行；记录、指纹和维护操作由 CLI 提供。

## 关键价值

- **记忆就在项目旁。** 本地文件让能访问它们的后续会话或宿主恢复决定和证据。
  能否共享取决于项目如何保存这些文件；被 Git 忽略的本地工作板不会自动成为团队记忆。
- **证据对应具体候选。** 高风险完成要求当前范围、验收和周期的测试与独立检查通过，
  后续失败覆盖旧通过。CLI 检查记录与候选有效性；覆盖是否充分、事实是否真实、
  检查者是否独立，仍由主 Agent 核对。
- **协作由主 Agent 编排。** 主 Agent 选择人员、模型、顺序、回退和最终采纳。
  `explore`、`build`、`check` 限定委派任务，每个可变范围同时只有一个写入者。
  需要第二意见时，可使用 CatPaw 的只读 `cc` / `cx` 入口。
- **流程随任务轻重变化。** 从最轻的安全方式开始，复用有效证据，按需读取细则，
  只记录会影响后续行动的事实。

## 从这里开始

已安装 runtime 时：

```bash
node ~/.catpaw/bin/catpaw.mjs status
node ~/.catpaw/bin/catpaw.mjs --help
```

CatPaw 不修改 `PATH`。源码仓库使用 `src/runtime/bin/catpaw.mjs`。
写操作默认 dry-run；`--apply` 在已有授权内执行指定操作。

[Runtime 使用指南](src/runtime/README.md) 提供工作、证据、协作和维护入口，
[Runtime Policy](src/runtime/runtime-policy.md) 持有执行规则。Evidence 是首选名称；
Proof 和 Approval 分别保留为证据、用户权限边界的兼容称呼。记录和工具成功都不授予权限。

## 构建与安装

Source runtime：**4.0.2（尚未发布）**。项目工作板使用 **schema 2**；
兼容细节见 [Runtime 使用指南](src/runtime/README.md)。

```bash
node --test
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Activation 是 machine-local 状态。构建不会自动 install、apply 或 migrate。
源码、生成的 `dist`、已安装 runtime、host adapter 和项目工作板各有独立边界。
获得安装或升级授权后，按 [AI-INSTALL.md](AI-INSTALL.md) 执行。

维护者入口：[docs/README.md](docs/README.md)、[CONTRIBUTING.md](CONTRIBUTING.md)。
CatPaw 不隶属于任何模型厂商或同名产品；见 [NOTICE.md](NOTICE.md) 和 [LICENSE](LICENSE)。
