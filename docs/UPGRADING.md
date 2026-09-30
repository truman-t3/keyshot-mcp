# Upgrading KeyShot MCP / KeyShot MCP 升级说明

## 0.13.0: MCP protocol update

KeyShot MCP 0.13.0 serves MCP `2026-07-28` over stdio through the official
TypeScript SDK v2 `serveStdio` entry. The same entry accepts legacy
`2025-11-25` clients. Configuration remains `npx -y keyshot-mcp@0.13.0` with the
existing KeyShot and output environment variables.

1. Update the pinned package version in your MCP client configuration.
2. Restart the MCP server or client so it loads the new package.
3. Run `keyshot_status`, inspect a saved scene, and request a preview.

All 19 tools, the product-render prompt and workflow resource remain available.
Results retain JSON text, structured content and preview image content. Local
output restrictions and saved-scene workflows remain in effect. Node.js 20 or
later is required.

The automated suite exercises the built stdio server with an SDK v2 client pinned
to `2026-07-28` and a real SDK v1 client using its legacy handshake. This validates
the protocol paths, not every third-party client's installation or UI behavior.

### MCP Events

This release does not advertise an `events` capability or implement ChatGPT event
subscriptions. [OpenAI's MCP Events integration](https://developers.openai.com/plugins/build/mcp-events)
also requires authenticated access, event discovery/subscription methods,
persistent subscriptions and signed HTTPS webhook delivery. These are a separate
integration from a local stdio protocol upgrade. No background monitoring,
remote endpoint or GUI bridge is enabled by upgrading.

### Object selection

Scene inspection now resolves native KeyShot object IDs into names, materials and
unique `objectPath` values. Use the returned path when multiple objects share a
name. Inspect again after renaming or reorganizing objects. Material changes
continue to save an output scene rather than modifying the source file in place.

## 0.13.0：MCP 协议升级

KeyShot MCP 0.13.0 使用官方 TypeScript SDK v2 的 `serveStdio` 入口，通过 stdio
支持 MCP `2026-07-28`。同一入口仍接受使用 `2025-11-25` 握手的旧客户端。
安装配置为 `npx -y keyshot-mcp@0.13.0`，沿用原有 KeyShot 和输出目录环境变量。

1. 将 MCP 客户端配置中的包版本更新到 0.13.0。
2. 重启 MCP 服务或客户端，以加载新版本。
3. 运行 `keyshot_status`，检查已保存场景，再请求预览。

19 个工具、产品渲染 Prompt 和工作流 Resource 均保留。结果继续提供 JSON 文本、
结构化数据和预览图片。本地输出安全限制及已保存场景工作流保持兼容，要求 Node.js 20
或更高版本。

自动测试使用锁定 `2026-07-28` 的 SDK v2 客户端，以及真正的 SDK v1 客户端连接构建后
的 stdio 服务。测试验证协议路径，不代表所有第三方客户端的安装和界面行为均已实测。

### MCP Events 事件订阅

本版不声明 `events` 能力，也未实现 ChatGPT 事件订阅。
[OpenAI 官方接入要求](https://developers.openai.com/plugins/build/mcp-events)还包括经过认证的
连接、事件发现与订阅接口、持久化订阅和签名 HTTPS webhook 投递。这是后续需要单独
实现的集成。升级本地协议不会自动开启后台监控、远程接口或 GUI 实时桥接。

### 对象选择

场景检查现在能将 KeyShot 原生对象 ID 解析为名称、材质和唯一的 `objectPath`。
遇到同名对象时，应使用检查结果中的路径；重命名或调整对象层级后，应重新读取场景。
材质修改继续保存到输出场景，避免直接改写原文件。
