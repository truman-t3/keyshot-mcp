# 1.0 Release Draft / 1.0 发布草案

Unreleased preparation document. No release date, tag or publication is approved.
未发布准备文档，不代表已确定发布日期或批准打标签、发布。

## Release Notes Draft / 更新说明草案

KeyShot MCP 1.0 focuses on local, saved-scene product rendering: inspect a scene,
edit selected materials and cameras, review an Agent-visible preview, then render
a scene copy. The planned release preserves all 19 tools and existing inputs.

Compared with published 0.13.5, the candidate adds geometry-aware standard-view
framing for newly imported models and fixes custom camera coordinates being
overridden by the default preset. Dependency patches refresh the Zod/Vitest
baseline without a major SDK migration. See the final changelog at publication
for the exact included commits.

KeyShot MCP 1.0 聚焦本机已保存场景的产品渲染：检查场景、调整指定材质和相机、查看
Agent 可见预览，再从副本出图。计划保留全部 19 个工具及现有输入。

相对已发布的 0.13.5，候选代码新增按几何体适配的新模型标准视角取景，修复默认预设
覆盖自定义坐标，并更新 Zod/Vitest 安全修补基线，不进行 SDK 大版本迁移。最终包含
哪些提交，以发布时的 Changelog 为准。

## Proposed Stability Contract / 拟定稳定性承诺

- Preserve existing tool names and compatible input meanings throughout 1.x; document behavior corrections and deprecations in bilingual notes.
- Keep source-file protection, restricted output directories and explicit overwrite approval. A preview is not approval for a final render or an overwrite.
- Return actionable errors for unsupported APIs; do not silently report an edit as successful.
- Only claim tested environments listed in [Support](../SUPPORT.md). No realtime GUI or remote Events promise.

- 1.x 保留现有工具名称和兼容的输入含义；行为修正与弃用在双语说明中记录。
- 保留源文件保护、输出目录限制和明确覆盖授权；预览不代表已批准正式渲染或覆盖。
- API 不支持时给出可操作的错误，不静默返回编辑成功。
- 只声明[支持文档](../SUPPORT.md)列出的实测范围，不承诺实时 GUI 或远程 Events。

## Publication Checklist / 发布检查

- Complete candidate tests and record deferred GUI-client/independent-user acceptance explicitly. Obtain maintainer approval for any remaining validation gap.
- In one reviewed change, align package/lockfile, runtime, Registry metadata, Skill, README, generated docs and bilingual changelog with 1.0.0. Set the actual release date only then.
- Re-run release checks and package safety checks on the exact commit to tag. Do not reuse the earlier candidate tarball after metadata changes.
- After explicit authorization, publish through the existing OIDC workflow. Verify GitHub Release, npm and official MCP Registry separately; report partial failures honestly. Third-party directory caches are non-blocking.

- 完成候选版验证，明确记录后置的图形客户端与独立用户验收；剩余验证缺口需维护者批准。
- 在一次经审阅的变更中统一包与锁文件、运行时、Registry 元数据、Skill、README、生成文档和双语 Changelog 为 1.0.0，届时填写实际发布日期。
- 对最终打标签的提交重跑发布和打包安全检查，元数据更新后不能复用此前候选包。
- 明确授权后使用现有 OIDC 流程发布，分别核对 GitHub Release、npm、官方 MCP Registry；如部分失败需如实报告，第三方目录缓存不阻塞。
