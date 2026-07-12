# System & Contracts Lens

## Use When

涉及架构边界、共享状态、API、持久化、并发、缓存、迁移、异步生命周期或跨模块
ownership 时使用。

## Questions

- 状态和决策分别由谁拥有，source of truth 在哪里？
- 输入、输出、不变量、失败语义与兼容边界是什么？
- 重试、乱序、重复、部分失败或恢复会不会改变 contract？
- 迁移与回滚是否保留数据、链接和行为语义？

## Evidence

用代码路径、schema、调用图、失败复现和边界测试证明判断。架构偏好本身不是
Evidence。
