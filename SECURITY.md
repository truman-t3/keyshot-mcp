# Security / 安全说明

## English

This MCP server runs KeyShot headless on the local machine. Its experimental Live Companion can also modify the unsaved scene currently open in the KeyShot GUI.

### Safe Use

- Only connect this server to MCP clients you trust.
- Only open scene/model/material files from trusted sources.
- Do not put license keys, account passwords, or private tokens in prompts.
- Prefer using the local KeyShot license configuration instead of passing license details through environment variables.
- The Live Companion binds only to `127.0.0.1`, rotates its session token on every start, and rejects arbitrary Python commands.
- Live edits are not saved automatically. Keep KeyShot native undo enabled and save a copy before high-risk changes.

### Reporting Issues

If you find a security issue, open a private advisory or contact the project maintainer directly before posting details publicly.

---

## 中文

这个 MCP 服务会在本机运行 KeyShot headless。实验性的 Live Companion 还可以修改当前 KeyShot GUI 中尚未保存的场景。

### 安全使用建议

- 只把这个服务连接到你信任的 MCP 客户端。
- 只打开来源可信的场景、模型和材质文件。
- 不要在提示词里输入许可证密钥、账号密码或私人 token。
- 优先使用本机已经配置好的 KeyShot 授权，不建议通过环境变量传递许可证细节。
- Live Companion 只绑定 `127.0.0.1`，每次启动都会更换会话令牌，并拒绝任意 Python 命令。
- 实时修改默认不保存。请保持 KeyShot 原生撤销可用，高风险修改前应保存副本。

### 报告安全问题

如果发现安全问题，请先通过私密方式联系维护者，不要直接公开细节。
