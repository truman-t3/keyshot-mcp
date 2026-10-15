# Security / 安全说明

## English

KeyShot MCP runs KeyShot headless on the local computer. It can read local scene,
model, material, and environment files and can write rendered images or scene copies.

### Model-provider data flow

The Agent in an MCP client receives tool results, including scene metadata and
images returned by `keyshot_preview_render`. Depending on the client's implementation
and settings, those results may be sent to the user's selected model service.
The MCP client controls this data transmission; it is not an upload initiated by
KeyShot MCP. Review the client and model provider's privacy settings before using
private or customer work.

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

### Output protection

Writing tools reject existing files unless `overwrite: true` is explicitly supported
and requested. Input files declared in the call (including material assignments) and
all scene inputs in a render queue remain protected even when overwrite is enabled.
Path comparisons resolve links and detect hard-linked input aliases. Image and scene
outputs must not share the same file. Preview and saved-scene sync never overwrite.

Paths are checked before headless startup and again in the bridge immediately before
each save or render, including camera-generated names. These checks are not a filesystem
sandbox or a cross-process lock: do not run unrelated writers against the same output
files or modify their links while a task runs. Use a separate output folder per process.

Existing low-level workflows that previously replaced a file implicitly now need a new
destination or explicit `overwrite: true`; overwriting a declared input is not supported.

### Publication checks

Maintainers run `pnpm run check:public-safety` before a pull request or release.
CI rejects credential-like values, personal home paths, unreviewed image filenames,
scene/license files and suspicious PNG metadata in the tracked publication source.
Public example paths must be generic. New images require explicit review before being
added to the reviewed-image list; retain third-party credits and licenses.

The check is a rule-based guard, not proof that an asset is non-confidential. It does
not remove old commits, cached packages, uploaded release artifacts or public issue
attachments. Review Git history separately, use a GitHub no-reply commit email and
sanitize diagnostics before sharing: local file paths, scene names and KeyShot output
can identify a project even without a credential. If a real credential is exposed,
revoke it first; deleting a file from the latest commit is not sufficient.

### Reporting issues

Report vulnerabilities through the repository's
[private vulnerability form](https://github.com/truman-t3/keyshot-mcp/security/advisories/new)
before posting technical details publicly. Include the affected version, impact,
reproduction steps, and a safe proof of concept that contains no private assets.

---

## 中文

KeyShot MCP 在本机运行 KeyShot headless。它可以读取本地场景、模型、材质和环境
文件，也可以写入渲染图片或场景副本。

### 模型服务的数据流

MCP 客户端中的 Agent 会接收工具结果，包括场景检查返回的元数据和
`keyshot_preview_render` 返回的预览图片。这些内容可能根据客户端的实现与配置发送给
用户选择的模型服务。数据传输由 MCP 客户端处理，不是 KeyShot MCP 主动上传。
处理私有项目或客户项目之前，请先确认 MCP 客户端和模型服务商的隐私设置。

KeyShot MCP 本身不会上传文件、运行远程服务或收集遥测数据。它不会要求用户在提示词
中提供许可证密钥，也不开放任意 Python 执行。

### 安全使用

- 只连接可信的 MCP 客户端和模型服务。
- 只打开来源可信的场景、模型、材质和环境文件。
- 不要在提示词中填写许可证密钥、账号密码、私有 Token 或保密素材内容。
- 使用 KeyShot 已有的本机许可证配置。
- 除非明确需要并信任外部位置，否则保持 `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS` 关闭。
- 批准修改或最终渲染前先检查预览，并保留原始场景。

### 输出保护

写入工具默认拒绝覆盖已有文件，仅在工具支持且明确设置 `overwrite: true` 时允许替换。
本次调用声明的输入文件（包括材质赋值中的文件）和渲染队列中所有任务的输入场景，
即使开启覆盖也仍受保护。路径比较会解析链接，并识别输入文件的硬链接别名。
场景与图片不能写入同一文件；预览与保存同步始终不覆盖。

服务在启动后台进程前检查路径，bridge 在每次保存、渲染前再次检查，包括按相机名生成的路径。
这些检查不是文件系统沙箱或跨进程锁：任务运行期间不要让其他程序写同一输出文件，
也不要修改相关链接。多个进程应使用不同输出文件夹。

以前依赖底层工具隐式替换文件的流程，需要改用新路径或显式 `overwrite: true`；
覆盖本次声明的输入文件不受支持。

### 发布前检查

维护者在 PR 或发布前运行 `pnpm run check:public-safety`。CI 检查疑似凭据、个人用户目录、
未经复核的图片文件名、场景或许可证文件及 PNG 元数据。公开示例只用通用占位路径。
新图片经明确复核后才能加入已审核图片清单；保留第三方作者与许可说明。

规则扫描不能证明素材一定不保密，也不会删除旧提交、缓存发布包、Release 附件或公开
Issue 附件。Git 历史需要单独审查；提交使用 GitHub no-reply 邮箱。分享诊断前先脱敏，
本机路径、场景名和 KeyShot 输出即使不含密钥，也可能识别项目。真实凭据一旦公开，
应先撤销，仅从最新提交删除文件是不够的。

### 报告安全问题

请先通过仓库的
[私密安全报告入口](https://github.com/truman-t3/keyshot-mcp/security/advisories/new)
报告漏洞，不要直接公开技术细节。请说明受影响版本、影响、复现步骤，并确保验证材料
不包含私人资产。
