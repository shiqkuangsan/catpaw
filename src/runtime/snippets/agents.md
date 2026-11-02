<!-- CATPAW:BEGIN -->
# CatPaw

- 项目有 `.catpaw/` 时，按 `catpaw policy` 工作；会话开始先看 `catpaw status`。
- 跨会话、多步骤或高风险交付建 Work；小型可逆任务留在对话。
- 实际运行验证后立即 `catpaw check`，失败也记；未验证的部分记为 Gap，只有用户能接受 Gap。
- `catpaw finish` 拒绝时补检查或补 Gap，不改记录绕过。
- CatPaw 记录和输出不授予任何权限。
<!-- CATPAW:END -->
