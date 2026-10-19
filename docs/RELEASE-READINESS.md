# Release Readiness / 正式版验收

## Unreleased: Output Safety / 未发布：输出安全

Local validation on 2026-10-15; this is not a published release. Remote CI results
are tracked in the pull request checks.
2026-10-15 本地验证；此变更尚未正式发布，远端 CI 结果在 PR 检查项中追踪。

- Default no-overwrite protection covers low-level saves, edits, renders and queue
  jobs; explicit overwrite never permits declared input-file or linked-alias replacement.
  / 默认不覆盖扩展到底层保存、编辑、渲染和队列；允许覆盖也不能替换本次声明的输入文件及其链接。
- TypeScript: 209 tests passed. Python: 79 tests, 77 passed; file-symlink permission
  and POSIX named-pipe tests skipped on Windows. Windows junction and hard-link
  checks passed separately.
  / TypeScript 209 项通过；Python 79 项中 77 项通过，Windows 上跳过文件软链接权限和
  POSIX 命名管道两项；目录联接和硬链接检查单独通过。
- KeyShot 14.1.0.154: output-protection smoke and all 14 original smoke steps passed;
  input scene and generated OBJ hashes stayed unchanged. Glass/plastic presets and
  a local native MTL passed saved-scene reinspection; invalid material inputs were
  rejected. / 输出保护和原有 14 步实机测试通过，输入场景及生成 OBJ 哈希未变；玻璃、塑料
  预设及本地原生 MTL 保存后复查通过，无效材质输入被拒绝。
- Follow-up preview review: embedded and explicitly saved 320x240 PNGs passed in
  KeyShot 14.1; temporary files were removed and the source hash was unchanged.
  Oversized and growing-file reads are bounded by automated tests.
  / 追加预览复核：KeyShot 14.1 返回并保存 320x240 PNG，临时文件已清理，源文件哈希
  不变；自动测试覆盖超大文件与读取期间增长的大小限制。
- Build, formatting, Ruff, tool/platform input-schema drift checks, release metadata,
  dependency audit and npm pack passed locally. / 构建、格式、Ruff、工具文档与平台输入
  Schema 漂移检查、发布元数据、依赖审计及 npm 打包本地通过。
- Public-content scanning covers filenames, private paths, known credential formats,
  unreviewed binary assets and PNG metadata. It is a prevention rule set, not proof
  that Git history or previously published artifacts contain no private information.
  / 公开内容扫描覆盖文件名、私人路径、常见凭据格式、未经复核的二进制素材和 PNG 元数据；
  这是预防规则，不代表历史提交或过去的发布资产已无私人信息。
- Remote Windows/Ubuntu Node.js 20/24 CI and CodeQL must pass before merging.
  / 合并前必须通过 Windows/Ubuntu、Node.js 20/24 CI 与 CodeQL。

This is not a 1.0 acceptance result. Fresh installations, two real MCP clients,
independent designer feedback and representative framing checks remain outstanding.
这不是 1.0 验收通过结论；干净安装、两款真实客户端、独立设计师反馈及代表性构图仍待验证。

### Isolated Package Check / 独立安装包检查

On 2026-10-19, a local tarball was installed with pnpm 10.17.1 and lifecycle
scripts disabled into a separate directory on Windows 11 / Node.js 24.19.0.
The first KeyShot run failed because result paths beneath the nested package
directory exceeded the embedded Python path limit. Bridge exchange files now use
the system temporary directory. With the fix, the installed package passed all
14 KeyShot 14.1 smoke steps, including two cameras, standard/preview quality and
numbered repeated outputs. SDK stdio checks also returned all 19 tools and an
embedded preview PNG; the temporary image was removed and the source hash stayed
unchanged. No development server files were substituted into the installation.
The installed output-protection smoke also passed, covering existing outputs,
source preservation and explicit replacement of copies only.

2026-10-19，使用 pnpm 10.17.1 禁用生命周期脚本，将本地打包文件安装到独立目录，
测试环境为 Windows 11 / Node.js 24.19.0。首次启动发现包目录嵌套过深，使 KeyShot
内嵌 Python 无法写回结果；现已将通信文件移到系统临时目录。修复后的安装包通过
KeyShot 14.1 全部 14 步测试，包括双相机、标准及预览质量、重复输出自动编号。
SDK stdio 检查返回全部 19 个工具及预览 PNG，临时图片已删除，源场景哈希不变。
未用开发目录文件替换安装包内容。
安装包的输出保护实测也已通过，包括已有文件冲突、输入文件保护和仅明确覆盖副本。

This is maintainer-run package integration evidence, not a clean operating-system
installation, npm/npx installation acceptance, two graphical client tests or
independent designer validation. / 这是维护者执行的安装包集成验证，不等于干净系统、
npm/npx 安装、两款图形客户端或独立设计师验收通过。

## 0.13.1 Validation Record / 版本验证记录

**Validation baseline: 2026-10-15. Publication results are tracked separately. / 验证基线：2026-10-15；发布结果独立追踪。**

This patch ships verified material assignments and the documentation improvements
already merged into `main`. It preserves all 19 tool names, inputs and local output
boundaries. It does not add material search, GUI control, remote Events or a new SDK
major version. Check results below are evidence, not a claim that all clients work.

本补丁整理已合并的材质实际赋值修复和文档更新，保留 19 个工具、输入和本地输出边界。
不加入材质搜索、GUI 控制、远程 Events 或 SDK 大版本升级。自动测试通过不代表所有
客户端、系统和 KeyShot 版本都已经实测。

| Gate / 检查项                                                          | Status / 状态                      | Evidence / 依据                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local types, tests, format and metadata / 本地类型、测试、格式及元数据 | Passed locally / 本地通过          | 2026-10-15: 145 TS + 67 Python; build, formatting, Ruff, docs, metadata and dependency audit / 构建、格式、文档、元数据及依赖审计通过                                                                                          |
| KeyShot 14.1 full smoke / 完整实机测试                                 | Passed locally / 本地通过          | Windows 11, 14.1.0.154: 14 steps, 2 cameras, standard/preview, automatic numbering / 14 步、双相机、两档质量及自动编号通过                                                                                                     |
| Material assignments / 材质实际赋值                                    | Passed locally / 本地通过          | Glass/plastic presets and a local native MTL reopened correctly; invalid names/Wavefront rejected; source hashes unchanged / 玻璃、塑料及本地原生 MTL 复查正确，错误输入拒绝，源文件哈希不变                                   |
| Windows/Ubuntu, Node 20/24 CI and CodeQL                               | Required before merge / 合并前必需 | Verify the release PR checks in [GitHub Actions](https://github.com/truman-t3/keyshot-mcp/actions/workflows/ci.yml); no tag until all checks pass / 全部检查通过后才打标签                                                     |
| npm tarball / 发布包                                                   | Passed locally / 本地通过          | Bridge, presets, Skill, docs, generated negative fixture and images included; no generated scenes or native library files / 必需文件完整，不含生成场景或原生库文件                                                             |
| User approval and release authorization / 用户复核及发布授权           | Authorized / 已授权                | 2026-10-15: publish only after validation; bilingual notes required / 仅验证通过后发布，保留双语说明                                                                                                                           |
| npm, GitHub Release, MCP Registry                                      | Track independently / 独立追踪     | [GitHub v0.13.1](https://github.com/truman-t3/keyshot-mcp/releases/tag/v0.13.1), [npm 0.13.1](https://www.npmjs.com/package/keyshot-mcp/v/0.13.1), and the official Registry; report any failure separately / 任一失败单独报告 |

The full smoke verifies execution and distinct, nonblank images, not general-purpose
composition quality. Its fixed Isometric settings crop the cube tightly. Keep
preview review mandatory; automatic fit/framing needs separate acceptance before 1.0.
完整测试验证执行成功、图像可见且视角不同，不代表通用自动构图通过；固定 Isometric
参数下立方体取景偏紧。仍需预览确认，1.0 前应单独验收完整入画与留白。
Native materials were read from the local installation only; no library file was copied or uploaded.
原生材质仅在本机读取，未复制进仓库或上传。

### Publication Procedure / 发布步骤

1. Complete local checks and real KeyShot validation; review only generated assets.
2. Obtain approval to push the release PR, then require all CI checks to pass.
3. Before final release approval, remove the README pending marker and replace its
   candidate notices with release wording; update the upgrade/demo notices and this
   checklist, and set the actual release date in Changelog.
4. Run `node scripts/check-release.mjs 0.13.1 --ready`. Until step 3 it must fail.
5. With explicit authorization, merge and tag `v0.13.1`. The existing OIDC workflow
   publishes npm, creates bilingual GitHub notes and then publishes MCP Registry.
6. Verify all three versions separately. Registry/platform failures must be reported,
   not described as complete. Third-party directory cache refresh is non-blocking.

**中文步骤**

1. 完成本地检查和 KeyShot 实机验证，仅使用生成资产。
2. 获准后推送发布 PR，并等待全部 CI 通过。
3. 最终发布批准前，移除 README 待发布标记，更新升级说明、演示文档和本清单的待发布提示；Changelog 填实际发布日期。
4. 运行 `node scripts/check-release.mjs 0.13.1 --ready`；第 3 步完成前应被阻止。
5. 经明确授权后合并并打 `v0.13.1` 标签，现有 OIDC 流程发布 npm、创建双语 Release，
   随后登记 MCP Registry。
6. 分别核对三个版本，失败必须如实报告；第三方目录缓存更新不阻塞正式发布。

## 1.0 Acceptance / 1.0 验收目标

These are proposed release gates, not completed work or a promised date.
以下为建议验收门槛，不是已经完成的结果，也不承诺发布日期。

- **Fresh installation:** at least 3 independent designers complete setup, diagnosis,
  preview and final output, with problems recorded. / **全新安装：** 至少 3 位独立设计师
  完成安装、诊断、预览及出图，记录遇到的问题。
- **Client compatibility:** test two actual MCP clients, recording versions and
  image delivery; SDK tests alone do not count. / **客户端兼容：** 实测两款客户端，记录
  版本和图片显示结果，不能用 SDK 协议测试替代。
- **Representative workflows:** multi-object material changes, duplicate names,
  Chinese paths, multiple cameras and repeated outputs. / **代表性工作流：** 多对象材质、
  同名对象、中文路径、多相机与重复出图。
- **Failure recovery:** missing materials/files, output conflicts, timeout, partial
  batch failure and source preservation. / **失败恢复：** 材质或文件缺失、重名、超时、
  批量部分失败和源文件保护。
- **Stable support contract:** explicit tested OS/KeyShot versions, backward-compatible
  tools and upgrade/rollback instructions. / **稳定支持范围：** 明确实测系统和 KeyShot
  版本、工具兼容承诺、升级及回退方法。

GUI control and remote Events are not prerequisites for a headless-first 1.0.
Do not imply those features are supported because local tests pass.
后台工作流的 1.0 不以 GUI 或远程 Events 为前提，也不因本地测试通过就宣称支持它们。
