# Internal Acceptance / 内部技术验收

## Status, 2026-11-20 / 当前状态

**Local functional regression and the refreshed full dependency audit passed.**
[PR #46](https://github.com/truman-t3/keyshot-mcp/pull/46) and its merge into
`main` passed Windows/Ubuntu CI on Node.js 20/24 and CodeQL. No advisory was
muted; graphical-client revalidation remains separate.

**本地功能回归和复查后的完整依赖审计均通过。** PR #46 及其合并后的 `main` 均通过
Windows/Ubuntu × Node.js 20/24 CI 和 CodeQL。未忽略告警；图形客户端复验单独记录。

This record covers the source fixes prepared for 1.0.1, based on 1.0.0. Tested
rendering scope: Windows 11, KeyShot 14.1.0.154, and Node.js 24.22.1.
No new OS or KeyShot-version support is claimed.

本记录覆盖为 1.0.1 准备的源码修复，基于 1.0.0。渲染实测范围为
Windows 11、KeyShot 14.1.0.154、Node.js 24.22.1，不扩大系统或 KeyShot 版本支持声明。

## Fixes and Regression / 修复与回归

- Preserve the canonical material preset name in the actual MCP response. Test
  both structured content and JSON text, case-insensitive preset lookup, assignment
  failure and unknown presets. Actual saved-scene reinspection confirms the material.
  / 实际 MCP 返回中保留规范预设名；覆盖结构化与文本结果、大小写查找、赋值失败和未知
  预设，并在真实保存后复查实际材质。
- Reject missing render cameras and a false camera-activation result before
  rendering. A real queue test exposed the old silent fallback; after the fix it
  returns two successes and one failure, retaining the two successful files.
  / 渲染前拒绝不存在的相机或切换失败；真实队列测试发现了原来的静默回退，修复后准确
  返回两项成功、一项失败，保留两张成功图片。
- Keep existing-scene cameras unchanged. Prompt, Skill and README guidance require
  matching preview/final aspect ratios and a new preview when the ratio changes.
  / 保留已有场景相机；Prompt、Skill 和 README 要求预览与出图比例一致，改变比例后重新预览。
- Distinguish MCP image delivery from actual client display. Offer tool-detail
  expansion or an explicitly saved safe PNG; never link a deleted temporary image
  or upload it elsewhere merely to display it.
  / 区分 MCP 图片返回和实际显示；可展开详情或明确另存安全 PNG，不链接已删除的临时图，
  不为显示图片而上传到其他服务。

November 18 local tests: **226 TypeScript tests passed; 90 Python tests passed, 2 skipped**.
The skips concern POSIX named pipes and unavailable Windows file-symlink permission;
they are not passes. Windows hard-link and directory-junction protections have
separate coverage. Remote Windows/Ubuntu and Node.js 20/24 results are tracked
separately in the pull request checks.

11 月 18 日本地测试：**TypeScript 226 项通过；Python 90 项通过、2 项跳过**。跳过项为 POSIX
命名管道和当前 Windows 无文件软链接权限，不计作通过；硬链接和目录联接有独立覆盖。
远端 Windows/Ubuntu、Node.js 20/24 结果以 PR 检查为准。

The real stdio MCP regression makes 15 calls, covering three numbered product
outputs, temporary and saved PNGs, existing-output rejection, two imported objects
with duplicate names, ambiguous-name rejection, one-object-only material changes,
two cameras, a partial-failure queue and unchanged source hashes. All passed after
the camera fix. The original 14-step KeyShot smoke also passed.

真实 stdio MCP 回归包含 15 次调用：连续三次自动编号、临时与保存 PNG、拒绝覆盖、
两个同名导入对象、拒绝歧义名称、只修改指定对象、双相机、队列部分失败及源文件哈希
保持。相机修复后全部符合预期，原有 14 步 KeyShot smoke 也通过。

The same 15-call regression passed against a separately installed local npm
tarball, using its own entry, bridge and generated fixture. Both runs produced
eight PNGs each; all 16 decoded correctly at 320x240 within their output roots.
The default product image was also visually checked for complete framing.
The 61-file package content scan found no privacy/credential matches, and the
isolated npm production dependency audit reported no known findings.

独立安装本地 npm 压缩包后，同一组 15 次回归也通过，使用安装包自身的入口、bridge
和生成资产。两轮各产生八张 PNG，共 16 张均可解码、为 320x240 且位于允许输出目录，
默认产品图片也已目视确认完整入画。61 个包文件的公开内容扫描未发现隐私/凭据命中，
独立 npm 生产依赖审计无已知告警。

The material smoke passed glass/plastic assignments, saved-scene reinspection and
rejection of unknown names and invalid Wavefront companion files. The optional
native-material-file case was not supplied and remains skipped. The output-safety
smoke passed default collision rejection, source protection and explicit replacement
of distinct copies only. Formatting, Ruff, tool-doc drift and release-metadata
consistency checks passed.

材质 smoke 通过玻璃/塑料赋值、保存后复查，以及未知名称和无效 Wavefront 配套材质文件
拒绝；可选的原生材质文件案例未提供，本轮跳过。输出保护 smoke 通过默认拒绝重名、
源文件保护和仅明确覆盖独立副本。格式、Ruff、工具文档漂移及发布元数据一致性检查通过。

## Graphical Clients / 图形客户端

Published 1.0.0 was exercised on November 16-18 in the original desktop host
(OpenAI.Codex 26.1111.2228.0, UI branded ChatGPT) and WorkBuddy 5.11.3 with Hy4.
The original host's black MCP image was confirmed visible after expanding details.
WorkBuddy visibly displayed blue, black and final saved PNGs in its local file
viewer. A separate inline display of WorkBuddy's temporary MCP image was not
established; the model's claim alone does not prove it.

11 月 16-18 日，已发布的 1.0.0 在原桌面宿主（OpenAI.Codex 26.1111.2228.0，界面品牌
为 ChatGPT）及 WorkBuddy 5.11.3 / Hy4 中完成核心流程。前者的黑色 MCP 图片经用户确认
展开详情后可见；后者的蓝色、黑色和最终保存 PNG 在本地文件查看器中实际可见。
WorkBuddy 临时 MCP 图片的独立内嵌显示未确证，不以模型文字声称作为显示证据。

These are two clients, not three. They are maintainer-run checks, not independent
designer trials or GUI Live Bridge acceptance. The unreleased patch was tested
through actual SDK stdio calls; it has not been installed into both graphical
clients. WorkBuddy showed long model waits and retries; latency reliability remains
unmeasured. Independent fresh-install trials remain deferred.

这是两款客户端，不将桌面宿主的品牌名称重复计数；属于维护者验证，不是独立设计师
试用或 GUI Live Bridge 验收。未发布补丁通过真实 SDK stdio 调用测试，尚未安装到两款
图形客户端复验。WorkBuddy 出现过长等待和重试，尚无延迟可靠性结论；独立全新安装试用仍后置。

## Security Gate / 安全门禁

On November 18, the production-only audit reported no findings. Pinning Hono
4.13.16 and node-server 2.1.6 cleared seven development-chain advisories. The
full audit still failed on [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
one picomatch advisory affecting two versions in the Vite/Vitest development chain.

11 月 18 日，仅生产依赖的审计无告警。固定 Hono 4.13.16 和 node-server 2.1.6
后清除了开发依赖链上的七项告警。完整审计当时仍未通过：剩余的是一项 picomatch
公告，命中 Vite/Vitest 开发依赖链中的两个版本。

On November 19, a full `pnpm audit` rerun after GitHub withdrew that advisory on
November 18 reported no findings. The lockfile was unchanged and no advisory was
ignored. This is a dated audit result, not a claim that picomatch received a patch
or that the dependencies are vulnerability-free.

GitHub 于 11 月 18 日撤回该公告。11 月 19 日重跑完整的 `pnpm audit`，结果无告警，
没有改动锁文件或忽略公告。这仅是本次审计的结果，不代表 picomatch 已发布补丁，
也不代表依赖不存在漏洞。

Audit results are time-specific. No claim is made that historical releases,
attachments or Git history were comprehensively re-audited in this functional run.

审计仅代表本次时点；本轮功能验证不等于再次全面审查历史发布、附件或 Git 历史。

## Reproduce / 复现

Use a development checkout with its pinned pnpm and development dependencies,
then configure a supported, locally licensed KeyShot headless executable. The
extra acceptance script is a development helper, not a new MCP tool or a runtime
dependency for normal npm users. Each run uses a fresh output subdirectory and
only the repository-generated cube. Models, scenes, images and raw logs stay local.

使用源码开发目录、固定版本 pnpm 和完整开发依赖，配置本机已授权的 KeyShot headless。
新增验收脚本仅用于开发测试，不增加 MCP 工具或普通 npm 用户的运行时依赖。每次使用
独立输出子目录和仓库生成立方体，模型、场景、图片及原始日志仅留本地。

```text
pnpm install --frozen-lockfile
pnpm run build
pnpm run smoke:keyshot:acceptance
pnpm run smoke:keyshot
pnpm run smoke:keyshot:materials
pnpm run smoke:keyshot:outputs
pnpm audit
pnpm audit --prod
```

Before release, verify the final revision in remote CI, including the dependency
audit. Record graphical-client revalidation separately. These checks do not imply
realtime GUI control or remote Events support.

发布前以最终提交的远端 CI（含依赖审计）为准；图形客户端复验单独记录。
这些检查不代表支持实时 GUI 或远程 Events。

For an isolated installation of the locally packed candidate, run the development
helper with `--package-root <installed package directory>`. It uses the installed
entry and generated fixture, not replacement files from the source checkout.

本地候选压缩包隔离安装后，可给开发验收脚本传入 `--package-root <已安装的包目录>`；
此时运行已安装包的入口和测试资产，不用源码文件替换安装内容。
