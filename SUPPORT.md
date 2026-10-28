# Support / 支持

## English

### Tested Scope

- Real KeyShot validation: Windows 11 and KeyShot 14.1.0.154 with a working headless scripting license.
- Node.js 20 and 24 are covered by automated Windows/Ubuntu server tests. Ubuntu CI does not establish KeyShot rendering support on Linux.
- Stable workflow: local stdio, saved scenes, explicit object edits, previews and scene-copy rendering. Unsaved GUI edits, realtime GUI control and remote Events are not supported by the stable server.
- Other KeyShot versions and operating systems are unverified. Graphical MCP-client acceptance is tracked separately from SDK protocol tests.

Use the channel that matches the request:

- Installation and usage questions: [GitHub Discussions](https://github.com/truman-t3/keyshot-mcp/discussions)
- Reproducible bugs: [Bug report](https://github.com/truman-t3/keyshot-mcp/issues/new?template=bug-report.yml)
- Workflow proposals: [Feature request](https://github.com/truman-t3/keyshot-mcp/issues/new?template=feature-request.yml)
- Vulnerabilities: [Private security report](https://github.com/truman-t3/keyshot-mcp/security/advisories/new)

Before posting, run `keyshot_status` and remove license credentials, tokens,
customer names, private paths, scene files, models, and confidential renders.
Support is provided by the community on a best-effort basis. KeyShot product,
license, or account support must be requested from KeyShot.

## 中文

### 实测范围

- KeyShot 实机验证：Windows 11、KeyShot 14.1.0.154，需要可用的 headless 脚本许可证。
- Node.js 20、24 已纳入 Windows/Ubuntu 自动测试；Ubuntu CI 不代表已验证 Linux 上的 KeyShot 渲染。
- 稳定工作流为本地 stdio、已保存场景、指定对象编辑、预览和场景副本出图；稳定服务不支持未保存 GUI 修改、实时 GUI 控制或远程 Events。
- 其他 KeyShot 版本和操作系统未经实机验证。图形 MCP 客户端验收与 SDK 协议测试分开记录。

请根据问题选择对应入口：

- 安装和使用问题：[GitHub Discussions](https://github.com/truman-t3/keyshot-mcp/discussions)
- 可以复现的 Bug：[Bug 报告](https://github.com/truman-t3/keyshot-mcp/issues/new?template=bug-report.yml)
- 工作流建议：[功能建议](https://github.com/truman-t3/keyshot-mcp/issues/new?template=feature-request.yml)
- 安全漏洞：[私密安全报告](https://github.com/truman-t3/keyshot-mcp/security/advisories/new)

提交前请先运行 `keyshot_status`，并删除许可证、Token、客户名称、私人路径、
场景文件、模型和保密渲染图。社区维护者会尽力提供支持；KeyShot 软件、许可证
或账号问题需要联系 KeyShot 官方支持。
