# Publishing Guide / 发布指南

## English

This guide is for maintainers. Users install the npm package through the
[README](README.md); they do not upload a local workspace to GitHub.

### Before a Pull Request

1. Inspect `git status --short` and the complete diff, including filenames.
2. Run `pnpm run check:public-safety`, type checks, tests, formatting, generated
   documentation checks and npm package inspection. See [Contributing](CONTRIBUTING.md).
3. Use generic example paths. Do not add local configuration, credentials, license
   files, scenes, logs, screenshots or unreviewed renders. Keep asset credits intact.
4. Check the commit identity. Use your own GitHub username and the no-reply address
   provided by GitHub **Settings > Emails**, not a personal mailbox. Changing the
   identity affects future commits, not existing history.
5. Push a focused branch and wait for the PR's cross-platform CI and CodeQL checks.

Do not drag an entire working folder into a browser upload or publish a ZIP of it.
Git ignore rules do not protect files manually uploaded through another application.

### Release

Follow the [release readiness checklist](docs/RELEASE-READINESS.md). Align all version
fields and installation examples, add English and Chinese release notes, and validate
the exact version with `node scripts/check-release.mjs <version> --ready`.

Only after release authorization and successful CI, merge and push `v<version>`.
The existing workflow uses GitHub OIDC/Trusted Publishing for npm and the official
MCP Registry. Do not add npm tokens or license credentials to the repository.
Verify the GitHub Release, npm package and Registry entry separately.

### If Private Data Was Published

Stop publication and revoke exposed credentials first. Removing the current file
does not erase Git history, previously published packages, release attachments or
external caches. Review those locations separately. History rewriting, force pushes
and changes to published tags require explicit approval and a recovery plan.
See [Security](SECURITY.md) for private vulnerability reporting.

---

## 中文

本指南面向维护者。普通用户按 [README](README.md) 安装 npm 包，无需把本机工作目录上传到 GitHub。

### 提交 PR 前

1. 检查 `git status --short` 和完整差异，包括文件名。
2. 运行 `pnpm run check:public-safety`、类型检查、测试、格式与自动生成文档检查，
   并检查实际 npm 包内容。命令见[贡献指南](CONTRIBUTING.md)。
3. 示例使用通用占位路径；不加入本机配置、凭据、许可证、场景、日志、截图或未经复核
   的渲染图，保留素材作者和许可说明。
4. 检查提交身份，使用本人的 GitHub 用户名及 **Settings > Emails** 提供的 no-reply
   邮箱，不使用个人邮箱。修改身份只影响后续提交，不会删除历史邮箱。
5. 推送聚焦的分支，等待 PR 的跨平台 CI 与 CodeQL 通过。

不要在浏览器中整文件夹拖拽上传，也不要把本机工作目录打成 ZIP 发布。
Git 忽略规则无法保护通过其他应用手动上传的文件。

### 正式发布

按[正式版验收清单](docs/RELEASE-READINESS.md)统一版本字段与安装示例，补充中英文
更新说明，运行 `node scripts/check-release.mjs <version> --ready` 校验准确版本。

只有获得发布授权且 CI 通过后，才合并并推送 `v<version>` 标签。现有流程通过 GitHub
OIDC/Trusted Publishing 发布 npm 和官方 MCP Registry，不在仓库中保存 npm Token 或
许可证凭据。发布后分别核对 GitHub Release、npm 包和 Registry 条目。

### 已经公开了私人信息时

先停止发布并撤销暴露的凭据。删除当前文件不会抹除 Git 历史、旧 npm 包、Release
附件或外部缓存，需分别检查。重写历史、强制推送及修改已发布标签，需要明确授权与
恢复方案。私密安全问题按[安全说明](SECURITY.md)报告。
