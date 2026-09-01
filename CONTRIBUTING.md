# Contributing / 贡献指南

## English

Contributions are welcome from designers, developers, technical artists, and
testers. Useful contributions include:

- Testing a clean installation or another KeyShot release.
- Reproducing a workflow problem with generated or non-confidential assets.
- Improving designer-facing instructions and MCP client examples.
- Adding focused wrappers for documented KeyShot `lux` APIs.
- Improving tests, diagnostics, security, or release reliability.

Start with a GitHub Discussion for usage questions. Open an Issue before a large
implementation so the workflow, KeyShot API availability, compatibility, and safety
expectations can be agreed first.

### Development setup

Requirements: Node.js 20 or newer, pnpm 10, and Python 3.11 or newer.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
python -m unittest discover -s tests -p "test_*.py"
pnpm run format:check
python -m ruff check scripts tests
pnpm run docs:tools:check
node scripts/check-release.mjs
npm pack --dry-run
```

Run `pnpm run smoke:keyshot` only on a computer with a supported, licensed KeyShot
installation. Record the KeyShot version and operating system in the pull request.
CI on Linux validates the MCP and bridge logic; it does not verify KeyShot itself.

### Pull requests

- Keep changes focused and preserve existing tool names and inputs unless a breaking
  change has been discussed.
- Update tests, generated tool documentation, README, Skill, and changelog when the
  public interface changes.
- Use generated or clearly redistributable test assets.
- Explain real KeyShot validation when behavior depends on the `lux` API.
- Follow the pull request checklist and wait for CI to pass.

Never include proprietary KeyShot scenes, license data, customer assets, credentials,
private paths, or unpublished renders in Issues, Discussions, commits, or pull requests.
Report vulnerabilities through GitHub's private security reporting form.

## 中文

欢迎设计师、开发者、技术美术和测试人员参与。比较有价值的贡献包括：

- 在干净环境或其他 KeyShot 版本上测试安装。
- 使用项目生成或不保密的素材复现工作流问题。
- 改进面向设计师的说明和 MCP 客户端示例。
- 为官方文档公开的 KeyShot `lux` API 增加聚焦的工具封装。
- 改进测试、诊断、安全和发布可靠性。

普通使用问题请先在 GitHub Discussions 讨论。准备较大功能前请先创建 Issue，确认
工作流、KeyShot API 可用性、兼容范围和安全要求。

### 开发环境

需要 Node.js 20 或更高版本、pnpm 10，以及 Python 3.11 或更高版本。

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
python -m unittest discover -s tests -p "test_*.py"
pnpm run format:check
python -m ruff check scripts tests
pnpm run docs:tools:check
node scripts/check-release.mjs
npm pack --dry-run
```

只有在本机已安装并合法授权 KeyShot 时才运行 `pnpm run smoke:keyshot`，并在 PR 中
注明操作系统和 KeyShot 版本。Linux CI 只验证 MCP 与 Bridge 逻辑，不代表已经实测
KeyShot。

### Pull Request

- 保持改动聚焦；除非已讨论破坏性变更，否则保留现有工具名称和输入兼容性。
- 公共接口变化时同步测试、自动生成工具文档、README、Skill 和 Changelog。
- 只使用项目生成或明确允许再分发的测试素材。
- 依赖 `lux` 行为的改动需要说明真实 KeyShot 验证结果。
- 完成 PR 检查项并等待 CI 通过。

不要在 Issue、Discussion、提交或 PR 中包含专有 KeyShot 场景、许可证数据、客户资产、
账号凭据、私人路径或未公开渲染图。安全漏洞请通过 GitHub 私密安全报告提交。
