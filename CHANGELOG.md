# Changelog

All notable changes to KeyShot MCP are documented in this file.

## [Unreleased]

## [0.13.0] - 2026-09-30

### Added / 新增

- Support MCP protocol `2026-07-28` over stdio with the official TypeScript SDK v2.
  Existing SDK v1 clients can continue to connect using `2025-11-25`.
  使用官方 TypeScript SDK v2，通过 stdio 支持 MCP `2026-07-28`；旧 SDK v1
  客户端仍可使用 `2025-11-25` 连接。
- Add child-process protocol tests for both client generations, covering all
  19 tools, preset results, prompts, resources and invalid tool arguments.
  新增真实子进程协议测试，覆盖新旧客户端、19 个工具、预设结果、提示词、资源和无效输入。

### Changed / 变更

- Upgrade schema validation to Zod 4 and generate parameter documentation through
  its public JSON Schema API. Tool names, input parameters and output safety rules
  remain compatible. Test runs build the stdio entry before exercising it.
  升级至 Zod 4，使用公开 JSON Schema 接口生成参数文档；工具名称、输入参数和输出安全
  规则保持兼容。测试会先构建，再检查实际 stdio 入口。
- Add bilingual upgrade guidance and release notes. MCP Events subscriptions are
  not implemented in this release; protocol support alone does not enable them.
  增加双语升级说明和发布说明。本版未实现 MCP Events 订阅，协议升级不会自动开启事件推送。

### Fixed / 修复

- Resolve native KeyShot object IDs through the scene tree so scene inspection
  returns actual object names and assigned materials instead of numeric IDs.
  修复场景检查把对象 ID 当成名称、无法读取已分配材质的问题。
- Apply materials using KeyShot's material-name and object-ID parameters. Reject
  ambiguous object names; use the `objectPath` returned by scene inspection to
  select a specific object. Inspect again after renaming or reorganizing objects.
  修正材质赋值参数；同名对象需使用场景检查返回的 `objectPath` 精确选择。
  重命名或调整对象层级后，应重新检查场景以获取路径。

## [0.12.1] - 2026-09-02

### Security

- Updated the MCP SDK dependency baseline to pull patched Hono, Hono Node
  server, `fast-uri`, and `ip-address` runtime dependencies.
- Refreshed the development lockfile to use patched PostCSS and Nano ID releases.

### Changed

- Updated the Node.js and Python setup actions used by CI and release workflows.
- CI and release validation now reject high-severity dependency vulnerabilities.

## [0.12.0] - 2026-09-01

### Added

- Structured bug and feature request forms, a pull request checklist, support
  guidance, code ownership, and a bilingual community code of conduct.
- Weekly Dependabot updates for npm and monthly updates for GitHub Actions.
- CodeQL analysis for JavaScript and TypeScript changes and a weekly scheduled scan.

### Changed

- Contribution guidance now describes the complete validation suite, real KeyShot
  testing expectations, compatibility rules, and confidential-asset restrictions.
- Security guidance now links directly to GitHub private vulnerability reporting.
- Release validation now checks that required community health files remain present.

## [0.11.0] - 2026-08-12

### Added

- `keyshot_sync_saved_scene`, which detects the newest saved `.bip`, copies it to
  a collision-safe output, returns a content fingerprint, and optionally embeds a
  preview.
- Machine-readable interaction-mode diagnostics so Agents can explain that stable
  tools work on saved scenes rather than an unsaved GUI session.
- An original KeyShot MCP project mark and a clearer README introduction,
  navigation, highlights, and bilingual positioning for easier recognition.

### Changed

- README, Agent Skill, and MCP workflow guidance now explain the tested KeyShot
  Script Runner limitation and recommend the saved-scene synchronization workflow.

## [0.10.0] - 2026-08-11

### Added

- `keyshot_preview_render`, which embeds a bounded PNG preview in the MCP response.
- A generated 18-tool reference at `docs/TOOLS.md`.
- Documentation drift, formatting, Python lint, and release-integrity checks.

### Changed

- Tool metadata now comes from a shared catalog used by the server, tests, and documentation.
- The recommended workflow now includes an Agent-visible preview and user confirmation before standard or final rendering.
- Release automation pins MCP Publisher v1.7.9 and reports Registry failures without undoing a successful npm publication.

### Security

- Documented that scene metadata and preview images may be sent by an MCP client to its configured model provider.

[Unreleased]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.1...HEAD
[0.12.1]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.9.1...v0.10.0
