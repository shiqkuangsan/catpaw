# Engineering Methods

CatPaw 在 Work 执行中按真实 trigger 选择工程方法。方法只能改变当前动作或 Proof
要求，不能改变内部 risk routing、扩大 authorization、创建新的 artifact 种类，或
接管 Work 的 accountable owner。

## Selection

- 遇到 bug、失败测试、异常输出、性能退化或 integration mismatch 时使用
  [Debugging](#debugging)。
- 实现 behavior-sensitive feature、bug fix 或高 regression risk 变更，并且存在可运行
  的测试或稳定复现入口时使用 [RED/GREEN](#redgreen)。
- 纯文档、声明式 configuration、generated output、一次性 migration snapshot 或
  exploratory spike 不强制 RED/GREEN；改用适合该 surface 的 parser、schema、build、
  smoke 或人工验收。Spike 得出可保留实现后，再为关键行为补 regression proof。
- 同一阶段和未变化的失败假设不重复加载方法；trigger 或证据要求变化后重新选择。

## Debugging

目标是证明 root cause，而不是快速堆叠看似相关的修复。

1. `Reproduce`：读取完整错误与上下文，用最小稳定入口复现；不能稳定复现时先收集
   观测数据，不猜。
2. `Trace`：沿 recent change、数据流与 component boundary 追踪 root cause；寻找同仓库
   中的 working example，定位第一个偏离 contract 的位置。
3. `Hypothesis`：一次写出一个可证伪假设，并说明现有 evidence 为什么支持它。
4. `Probe`：用最小诊断或单变量变化验证假设；失败后形成新假设，不在旧 patch 上
   继续叠加猜测。
5. `Fix`：在 source of truth 修复 root cause，避免顺手重构和无关 cleanup。
6. `Verify`：重新运行原始 reproduction、最小相关测试和 blast radius 所需回归。

连续三个合理修复仍失败，或每次都暴露新的跨边界耦合时，返回 Think/Plan 并检查
architecture；不要把第四次猜测伪装成正常进展。

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

## Proof And Handoff

- 小型非持久 Work 只在当前上下文保留必要的 reproduction 与 verification。
- 持久 Work 将 contract、失败处理和验证命令写进内部 Plan；只有影响 completion
  判断的结果才通过 `proof add` 写入 typed Evidence。
- 不创建 method ledger、重复 plan、provider-specific artifact 或 skill invocation
  计数。衡量方法价值看 root cause 是否被证明、行为是否被锁定、finding 是否被采用，
  以及最终验证是否可复现。
