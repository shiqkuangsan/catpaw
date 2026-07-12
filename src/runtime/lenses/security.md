# Security Lens

## Use When

涉及身份、权限、秘密、外部输入、文件边界、网络、依赖、CI/CD、供应链或可能
扩大 blast radius 的操作时使用。

## Questions

- trust boundary、主体、权限与最小授权是什么？
- 恶意、重复、超大、过期或路径穿越输入会发生什么？
- secret、日志、缓存、artifact 与错误信息会不会泄露敏感数据？
- 依赖、hook、plugin、脚本和外部动作是否可验证、可撤销？

## Evidence

引用实际配置、权限、攻击路径、扫描或负向测试。没有证据时明确标记未知，不把
“默认安全”当作结论。
