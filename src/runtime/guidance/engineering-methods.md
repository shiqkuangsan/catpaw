# Engineering Methods

CatPaw 在 Work 执行中按真实 trigger 选择工程方法。方法只能改变当前动作或 Proof
要求，不能改变内部 risk routing、扩大 authorization、创建新的 artifact 种类，或
接管 Work 的 accountable owner。

## Selection

- 遇到 bug、失败测试、异常输出、性能退化或 integration mismatch 时使用
  [Debugging](#debugging)。
- 实现 behavior-sensitive feature、bug fix 或高 regression risk 变更，并且存在可运行
  的测试或稳定复现入口时使用 [RED/GREEN](#redgreen)。
- 非简单变更进入 Check 时使用 [Review](#review)，分别检查 delivery contract 与
  engineering quality；是否拆成独立 actor/context 由信息增益和污染风险决定。
- 存在一个高成本未知、直接实施会放大返工时，使用 [Prototype](#prototype) 回答该
  问题；prototype 不是默认交付路径。
- 纯文档、声明式 configuration、generated output、一次性 migration snapshot 或
  exploratory spike 不强制 RED/GREEN；改用适合该 surface 的 parser、schema、build、
  smoke 或人工验收。Spike 得出可保留实现后，再为关键行为补 regression proof。
- 同一阶段和未变化的失败假设不重复加载方法；trigger 或证据要求变化后重新选择。

## Debugging

目标是建立能针对具体症状变红的 tight feedback loop，并用它证明 root cause。

1. `Loop`：读取完整错误与上下文，选择最小、快速、确定、Agent 可重复执行的入口；
   它必须命中具体症状并具备 red-capable 信号。只能在线上观察时，收集最小且已脱敏
   的 log/trace/HAR/metric，明确 inference 与 Proof gap，不伪造本地复现。
2. `Minimize`：逐项移除输入、配置与依赖；每次只改变一个变量，直到剩余元素都是
   load-bearing。最小化改变现象时，记录新的边界而不是强行维持原假设。
3. `Trace`：沿 recent change、数据流与 component boundary 追踪，比较同仓库 working
   example，定位第一个偏离 contract 的位置。
4. `Hypotheses`：搜索空间较宽时列出并排序 3–5 个可证伪假设；边界已窄时一个足够。
   每个假设都说明支持事实、反证信号与最低成本 probe。
5. `Probe`：验证一个假设或变量。临时 instrumentation 使用唯一 tag，性能问题使用
   可比较 metric；完成后移除 tag 和仅诊断用代码。展示命令、log、HAR 或截图前先
   redact credentials、tokens 与敏感用户数据。
6. `Fix`：在 source of truth 修复已证明的 root cause，避免顺手重构。未证明因果时
   只能交付显式 mitigation，并保留 diagnosis、recovery 与剩余风险。
7. `Verify`：重跑原始 loop、最小 regression 和 blast-radius 检查，确认 instrumentation
   已清理。缺少能表达正确 contract 的 seam 本身是 architecture finding。

连续三个合理修复仍失败，或每次都暴露新的跨边界耦合时，返回 Understand，重新检查
Plan 与 architecture；不要把第四次猜测伪装成正常进展。

## RED/GREEN

RED/GREEN 用于锁定期望行为，不是所有文件修改的通用仪式。

1. `RED`：先写最小 test 或 executable reproduction，observe expected fail，并确认它
   因目标行为缺失而失败；syntax、fixture 或环境错误不算有效 RED。
2. `GREEN`：实施能满足该 contract 的 smallest coherent change，observe pass，并确认
   最小验证覆盖了目标 contract。
3. `REFACTOR`：只在 GREEN 后清理结构；每个行为单元保持验证为绿。
4. `REGRESSION`：按影响面扩展测试，确认没有把局部通过误当成完整完成。

已存在实现、测试基础薄弱或无法安全回退时，不要求删除代码再 start over。先建立
可信的 characterization/reproduction，再明确记录无法证明 pre-change RED 的 gap。

## Review

Review 使用两个判断轴，不把 finding 数量当成质量：

- `Contract`：验收是否成立、必要行为是否遗漏、是否出现 scope creep，以及 Proof 是否
  真正支持完成声明。
- `Engineering`：是否符合 repository rules、boundary 与 invariants，并检查 correctness、
  failure path、security、performance 与 maintainability。

高污染风险或确有独立信息增益时，可让两个 actor/context 分别检查；否则同一 check
顺序完成即可。Primary agent 必须复现 material finding、去重并按影响排序，再修复到
fixed point 或明确记录剩余 gap；raw actor output 不是最终 verdict。

## Prototype

Prototype 每次只回答一个 material question，使用最快但仍具代表性的 surface，并设置
time/context bound。完成标准是问题得到可复现答案，而不是代码量。记录结论与限制后，
丢弃 prototype，或在单独的 Execute 决策中把有价值部分按正常 contract、测试与 review
转成实现；prototype 本身不授予 Git、adoption 或外部操作权限。

## Proof And Handoff

- 小型非持久 Work 只在当前上下文保留必要的 reproduction 与 verification。
- 持久 Work 将 contract、失败处理和验证命令写进内部 Plan；只有影响 completion
  判断的结果才通过 `proof add` 写入 typed Evidence。
- 不创建 method ledger、重复 plan、provider-specific artifact 或 skill invocation
  计数。衡量方法价值看 root cause 是否被证明、行为是否被锁定、finding 是否被采用，
  以及最终验证是否可复现。
