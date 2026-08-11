# Security / 安全说明

## English

KeyShot MCP runs KeyShot headless on the local computer. It can read local scene,
model, material, and environment files and can write rendered images or scene copies.

### Model-provider data flow

MCP clients normally send tool inputs and results to the model service selected by
the user. Scene metadata returned by inspection tools and images returned by
`keyshot_preview_render` may therefore leave the local computer through that MCP
client. Review the client and model provider's privacy settings before using private
or customer work.

KeyShot MCP itself does not upload files, run a remote service, or collect telemetry.
It never requires license keys in prompts and does not expose arbitrary Python
execution.

### Safe use

- Connect the server only to MCP clients and model providers you trust.
- Open only scene, model, material, and environment files from trusted sources.
- Do not put license keys, account passwords, private tokens, or confidential asset
  contents in prompts.
- Use KeyShot's existing local license configuration.
- Keep `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS` disabled unless an external destination is
  explicitly required and trusted.
- Review a preview before approving edits or final renders, and preserve source scenes.

### Reporting issues

Report vulnerabilities through a private GitHub security advisory before posting
technical details publicly.

---

## 中文

KeyShot MCP 在本机运行 KeyShot headless。它可以读取本地场景、模型、材质和环境
文件，也可以写入渲染图片或场景副本。

### 模型服务的数据流

MCP 客户端通常会把工具输入和结果发送给用户选择的模型服务。因此，场景检查工具
返回的元数据，以及 `keyshot_preview_render` 返回的预览图片，可能通过 MCP 客户端
离开本机。处理私有项目或客户项目之前，请先确认 MCP 客户端和模型服务商的隐私设置。

KeyShot MCP 本身不会上传文件、运行远程服务或收集遥测数据。它不会要求用户在提示词
中提供许可证密钥，也不开放任意 Python 执行。

### 安全使用

- 只连接可信的 MCP 客户端和模型服务。
- 只打开来源可信的场景、模型、材质和环境文件。
- 不要在提示词中填写许可证密钥、账号密码、私有 Token 或保密素材内容。
- 使用 KeyShot 已有的本机许可证配置。
- 除非明确需要并信任外部位置，否则保持 `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS` 关闭。
- 批准修改或最终渲染前先检查预览，并保留原始场景。

### 报告安全问题

请先通过 GitHub 私密安全公告报告漏洞，不要直接公开技术细节。
