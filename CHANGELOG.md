# Changelog

All notable changes to KeyShot MCP are documented in this file.

## [Unreleased]

- Fit standard-view cameras for newly imported products to world-space scene bounds and output aspect ratio with 10% edge padding. Preserve explicit camera coordinates/distances, base scenes and saved-scene framing; do not replace custom coordinates with the default Isometric preset.
- 新导入产品的标准视角按世界坐标包围盒与输出宽高比自动取景，四边预留 10% 空间；保留显式坐标、距离、基础场景及已有场景构图，修复默认 Isometric 预设覆盖自定义坐标的问题。

- Raise the Zod and Vitest minimum patch versions and refresh vulnerable SDK test dependencies while retaining the existing MCP SDK and Vitest major versions. Preserve all 19 public tools and their inputs.
- 提高 Zod 与 Vitest 的最低修补版本，更新 SDK 测试依赖链中的安全修复，保持现有 MCP SDK 和 Vitest 大版本；保留全部 19 个公开工具及其输入。

- Patch the development-only Vite dependency to 7.3.7 for GHSA-587h-7wmj-h5pm without upgrading Vitest's major version. Published runtime tools are unchanged.
- 将仅用于开发测试的 Vite 依赖修补至 7.3.7，处理 GHSA-587h-7wmj-h5pm，不升级 Vitest 大版本；已发布的运行时工具不变。

## [0.13.5] - 2026-10-20

### Installation and Diagnostics / 安装与诊断

- Isolate each bridge request in a private temporary subdirectory, clean it after execution, and return structured failures for local filesystem errors. Preserve completed diagnostic checks when startup throws; check temporary storage before launching KeyShot.
- 每次桥接请求使用独立临时子目录并在执行后清理；本地文件系统出错时返回结构化结果。启动抛异常时保留已完成的诊断，并在启动 KeyShot 前检查临时目录。

- Store bridge request/result files in the system temporary directory instead of the installed package, avoiding Windows path-length failures in nested installations.
- 将桥接请求与结果文件移到系统临时目录，避免 Windows 嵌套安装路径过长导致 KeyShot 无法写回结果。

### Publication Privacy / 发布隐私

- Add a redacted public-content check to CI and publication, including credential
  patterns, private paths, file names and PNG metadata. Reject unreviewed binary
  assets; extend ignore rules for local environment, credential, scene and license files.
- 为 CI 与发布流程增加脱敏的公开内容检查，覆盖疑似凭据、私人路径、文件名及 PNG 元数据；
  拦截未经复核的二进制素材，补全本地环境、凭据、场景和许可证文件忽略规则。
- Bound preview file reads before allocation and while reading, reject special-file
  output destinations, and check case variants and malformed PNG metadata containers.
- 预览读取在分配内存前和读取过程中均限制大小，拒绝特殊文件输出目标，并补查文件名
  大小写变体及损坏的 PNG 元数据容器。

### Output Safety / 输出安全

- Apply default no-overwrite protection to single renders, queued jobs, imports,
  scene edits and saves. Add optional `overwrite` to low-level writing tools without
  renaming tools or removing inputs. Declared input files and linked aliases remain
  protected even with overwrite enabled; scene and image outputs must be distinct.
- 将默认不覆盖保护统一到单张渲染、队列、导入、场景编辑与保存。底层写入工具增加可选
  `overwrite`，不改工具名称或删除参数；即使允许覆盖，也不能替换本次声明的输入文件及其
  链接别名，场景与图片不能写入同一文件。
- Recheck every generated camera output inside the bridge, protect every queue input,
  disambiguate selected-camera filenames and avoid deleting rejected preview outputs.
- bridge 在逐相机写入前重新检查路径，保护整个队列的输入场景，为清理后同名的指定相机
  生成不同文件名，并避免误删被拒绝的预览输出。

### Documentation / 文档

- Clarify the roles of the MCP client's Agent, client configuration and model provider in privacy notices; distinguish client-managed transmission from the local KeyShot MCP service.
- 明确隐私提示中 MCP 客户端 Agent、客户端配置与模型服务的职责，区分客户端处理的数据传输与本机 KeyShot MCP 服务。

## [0.13.1] - 2026-10-15

### Release Safety / 发布安全

- Validate bilingual release notes, built runtime version and current comparison links before npm publication. Block the release workflow while documentation still marks the version as pending. Add a bilingual 1.0 readiness checklist; external client and user validation remain pending.
- 在 npm 发布前校验双语更新说明、构建版本和当前比较链接；文档仍标记待发布时阻止正式发布。增加双语 1.0 验收清单，客户端及外部用户验证仍待完成。
- Add an opt-in material smoke test using generated geometry, an unsupported Wavefront MTL fixture, preset assignments, saved-scene reinspection, invalid-name rejection and source-file hashes. A native KeyShot material file can be tested locally without bundling it.
- 增加可选材质实机测试，覆盖生成模型、不支持的 Wavefront MTL、预设赋值、保存后复查、错误名称拒绝及源文件哈希保护。可在本地验证 KeyShot 原生材质文件，不随包分发。
- Classify empty/unsupported material-file loads as `MATERIAL_FILE_INVALID` and explain the difference between KeyShot native MTL and Wavefront companion files.
- 将空加载或不支持的材质文件归类为 `MATERIAL_FILE_INVALID`，解释 KeyShot 原生 MTL 与 OBJ 配套 Wavefront 文件的区别。

### Documentation / 文档

- Restore TypeScript and M8ven header badges, preset guidance, import-only and lens/environment examples, task serialization and early privacy reminders after auditing the README redesign.
- 核对改版前后内容，补回 TypeScript、M8ven 徽章，预设说明、仅导入及镜头/环境示例、任务串行说明，并前置隐私提醒。

- Add a bilingual request-to-render diagram with desktop and mobile layouts, using an object-level material change as the example.
- 增加中英文“一句话到出图”流程图，适配桌面和手机，以指定对象的材质替换说明预览、确认和输出流程。

### Changed / 变更

- Reorganize the bilingual README around designer setup, saved-scene workflows and
  a real component-material comparison. Replace the cube showcase with credited
  local renders of a Poly Haven CC0 lantern, retain the cube as a test fixture,
  and document reproduction and GUI boundaries separately. Add documentation,
  navigation, installation JSON and demo-image checks.
  围绕设计师安装、已保存场景流程与真实材质对比重整双语 README；展示改用注明来源的
  Poly Haven CC0 灯具实测图，立方体仅保留为测试夹具。独立补充复现与 GUI 边界说明，
  增加文档链接、导航、安装 JSON 和演示图片检查。

### Fixed / 修复

- Verify material names and actual object assignments before reporting success.
  Load single-material MTL files with KeyShot's in-project `loadMaterials` API;
  reject empty or ambiguous loads instead of treating file paths as material names.
  Correct the default clear-glass and matte-black-plastic library references while
  retaining existing preset labels. Add structured material error guidance.
  返回成功前校验材质名称与对象的实际材质；通过 KeyShot 的 `loadMaterials` 在场景内
  加载单材质 MTL 文件，空加载或多材质文件明确报错，不再把路径当成材质名称。
  保留预设名称，修正默认透明玻璃与哑光黑色塑料的材质库引用，并补充结构化修复建议。

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

[Unreleased]: https://github.com/truman-t3/keyshot-mcp/compare/v0.13.5...HEAD
[0.13.5]: https://github.com/truman-t3/keyshot-mcp/compare/v0.13.1...v0.13.5
[0.13.1]: https://github.com/truman-t3/keyshot-mcp/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.9.1...v0.10.0
