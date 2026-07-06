# Security / 安全说明

## English

This MCP server runs KeyShot headless on the local machine. It can read scene/model files and write rendered images or saved scenes.

### Safe Use

- Only connect this server to MCP clients you trust.
- Only open scene/model/material files from trusted sources.
- Do not put license keys, account passwords, or private tokens in prompts.
- Prefer using the local KeyShot license configuration instead of passing license details through environment variables.

### Reporting Issues

If you find a security issue, open a private advisory or contact the project maintainer directly before posting details publicly.

---

## 中文

这个 MCP 服务会在本机运行 KeyShot 无界面程序。它可以读取场景、模型、材质文件，也可以写入渲染图片或保存后的场景文件。

### 安全使用建议

- 只把这个服务连接到你信任的 MCP 客户端。
- 只打开来源可信的场景、模型和材质文件。
- 不要在提示词里输入许可证密钥、账号密码或私人 token。
- 优先使用本机已经配置好的 KeyShot 授权，不建议通过环境变量传递许可证细节。

### 报告安全问题

如果发现安全问题，请先通过私密方式联系维护者，不要直接公开细节。
