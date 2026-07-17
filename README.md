# KeyShot MCP

[![MCP Badge](https://lobehub.com/badge/mcp/truman-t3-keyshot-mcp)](https://lobehub.com/mcp/truman-t3-keyshot-mcp)
[![GitHub Release](https://img.shields.io/github/v/release/truman-t3/keyshot-mcp)](https://github.com/truman-t3/keyshot-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

English | [中文](#中文说明)

A local MCP server for controlling KeyShot Studio through KeyShot headless scripting.

It lets an AI app that supports MCP ask KeyShot to inspect scenes, render images, import models, change materials, adjust cameras, set environments, and save scenes.

Optimized for Windows-based KeyShot Studio product visualization workflows.

Unlike GUI-only automation scripts, this project targets KeyShot headless workflows and keeps a stable MCP interface for AI agents.

## Who This Is For

- Designers who want AI-assisted KeyShot rendering.
- Developers who want a simple stdio MCP bridge for KeyShot.
- Teams that already have KeyShot licenses configured on their machines.

This project does not include KeyShot, does not bypass licensing, and does not store license keys.

## What It Can Do

- Check whether KeyShot headless can start.
- Inspect a `.bip` or supported KeyShot scene file.
- Render a scene to an image.
- Batch render multiple named cameras from one scene.
- Automatically discover and render every camera in one scene.
- Import a model into a scene.
- Apply a material to an object.
- Create or update a camera.
- Apply reusable standard or custom camera presets.
- Set an environment when the installed KeyShot version exposes that function.
- Save a scene to a new file.

## Example Workflows

- Batch render multiple camera views from one KeyShot scene.
- Test several material options on the same product model.
- Generate product hero images with consistent resolution and output naming.
- Import a model, apply a material preset, set a camera, and render in one AI instruction.

## Workflow

![KeyShot MCP Workflow](assets/workflow.svg)

## Requirements

- KeyShot Studio with `keyshot_headless` support.
- Node.js 20 or newer.
- A valid KeyShot license already configured on the computer.

## Compatibility

| Platform | KeyShot Version | Node Version | Status |
| --- | --- | --- | --- |
| Windows 11 | KeyShot Studio 2025 / 14.1 | Node 22 | Tested |
| macOS | Not tested | - | Need contributors |
| Linux | Not tested | - | Need contributors |

## Install

### Install the published npm package

```bash
npm install -g keyshot-mcp
```

The current release line is `0.6.0`. The published package is the easiest option
when you only want to use the MCP server. You still need KeyShot Studio and a
local KeyShot license.

### Install from source

```bash
npm install
npm run build
```

### Three MCP configuration options

Use exactly one of these approaches:

**Global npm installation** (`npm install -g keyshot-mcp`):

```json
{"mcpServers":{"keyshot":{"command":"keyshot-mcp","env":{"KEYSHOT_HEADLESS_EXE":"/absolute/path/to/keyshot_headless"}}}}
```

**No installation, run with npx**:

```json
{"mcpServers":{"keyshot":{"command":"npx","args":["-y","keyshot-mcp@0.6.0"],"env":{"KEYSHOT_HEADLESS_EXE":"/absolute/path/to/keyshot_headless"}}}}
```

**Run from a cloned source directory** (after `npm install && npm run build`):

```json
{"mcpServers":{"keyshot":{"command":"node","args":["/absolute/path/to/keyshot-mcp/dist/index.js"],"env":{"KEYSHOT_HEADLESS_EXE":"/absolute/path/to/keyshot_headless"}}}}
```

## Copy-Paste Setup Prompt for an Agent

If you use Codex or another coding agent, you can copy this prompt and let the agent install the MCP server for you:

```text
Install KeyShot MCP 0.6.0 from npm and configure it in my MCP client.

Please:
1. Find my KeyShot headless executable path.
2. Add a keyshot MCP server using npx -y keyshot-mcp@0.6.0.
3. Set KEYSHOT_HEADLESS_EXE to the detected keyshot_headless path.
4. Test the setup by running the keyshot_status tool.
5. Tell me the exact config that was added and whether the status check passed.

Do not store license keys or account passwords. Use my existing local KeyShot license configuration.
```

## Configure

Set the path to your KeyShot headless executable.

Windows PowerShell example:

```powershell
$env:KEYSHOT_HEADLESS_EXE="C:\Program Files\KeyShot Studio\bin\keyshot_headless.exe"
```

macOS/Linux shell example:

```bash
export KEYSHOT_HEADLESS_EXE="/Applications/KeyShot Studio.app/Contents/MacOS/keyshot_headless"
```

Then test startup:

```bash
npm run status
```

## MCP Client Example

Add a server like this to your MCP client config:

```json
{
  "mcpServers": {
    "keyshot": {
      "command": "node",
      "args": ["/absolute/path/to/keyshot-mcp/dist/index.js"],
      "env": {
        "KEYSHOT_HEADLESS_EXE": "/absolute/path/to/keyshot_headless"
      }
    }
  }
}
```

A generic Codex configuration template is in:

```text
examples/codex.example.json
```

## Codex Configuration

For Codex, add a `keyshot` MCP server entry to your Codex MCP configuration and point it to the built server file:

```json
{
  "mcpServers": {
    "keyshot": {
      "command": "node",
      "args": ["/absolute/path/to/keyshot-mcp/dist/index.js"],
      "env": {
        "KEYSHOT_HEADLESS_EXE": "/absolute/path/to/keyshot_headless"
      }
    }
  }
}
```

Use `examples/codex.example.json` as a starting point and replace all paths with paths on your own computer.

## Prompt Examples

```text
Render the current KeyShot scene into three views: front, 45-degree perspective, and top-down. Use 1920x1080 resolution and save the outputs to the configured output folder.
```

```text
Import the model file at /path/to/model.step, apply a brushed metal material to the main housing, set a 45-degree camera, and render a product hero image.
```

```text
Inspect this KeyShot scene and summarize the available objects, cameras, materials, and renderable outputs.
```

```text
List the cameras in this KeyShot scene, create or update a camera named "Hero",
save the scene to a new file, and render one preview from that camera.
```

```text
Find every camera in this KeyShot scene and render all views to the all-cameras
output folder. Continue if one camera fails and report the result for each view.
```

```text
List the available camera presets, apply the Isometric preset as a camera named
"Catalog Isometric", save a new scene, and render a preview from that camera.
```

## Environment Variables

- `KEYSHOT_HEADLESS_EXE`: path to `keyshot_headless` or `keyshot_headless.exe`.
- `KEYSHOT_OUTPUT_DIR`: default output folder for renders.
- `KEYSHOT_LICENSE_ARGS`: optional KeyShot headless license arguments. Empty by default.
- `KEYSHOT_TIMEOUT_MS`: operation timeout in milliseconds. Default: `600000`.
- `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS`: allow output paths outside `KEYSHOT_OUTPUT_DIR`. Default: `false`.
- `KEYSHOT_CAMERA_PRESETS`: camera preset JSON file. Default: `presets/cameras.json`.

By default every output file must stay inside `KEYSHOT_OUTPUT_DIR`. Relative paths
are placed there automatically. Set the compatibility switch to `true` only when
an external output location is intentional; input scenes and models are unrestricted.

`samples` and `maxTimeSeconds` select different KeyShot render modes. Provide one
or the other, not both.

## MCP Tools

- `keyshot_status`
- `keyshot_inspect_scene`
- `keyshot_list_cameras`: list available camera names in a scene (handy before batch rendering)
- `keyshot_render`: render a single image
- `keyshot_batch_render`
- `keyshot_render_all_cameras`: discover and render every camera in a scene; continues after individual failures by default
- `keyshot_render_queue`: run several render jobs sequentially (stops at first failure unless `continueOnError`)
- `keyshot_import_model`
- `keyshot_apply_material`
- `keyshot_list_material_presets`: list presets from the material preset library
- `keyshot_apply_material_preset`: apply a named preset from the library to an object
- `keyshot_set_camera`
- `keyshot_list_camera_presets`: list standard and custom camera presets
- `keyshot_apply_camera_preset`: create or update a named camera from a preset
- `keyshot_set_environment`
- `keyshot_save_scene`

### Render every camera automatically

`keyshot_render_all_cameras` discovers camera names from the open scene and renders
them in one KeyShot headless session. `continueOnError` defaults to `true`, so a
failed camera is reported without blocking the remaining views. Safe duplicate
filenames receive `-2`, `-3`, and later suffixes. Existing files are preserved
unless `overwrite` is set to `true`. KeyShot's internal, non-activatable
`last_active` placeholder is reported and skipped.

### Material preset library

`keyshot_apply_material_preset` reads a small JSON registry so you can reuse named
looks instead of remembering exact KeyShot material names. Default location:
`presets/materials.json` (override with the `KEYSHOT_MATERIAL_PRESETS` env var).

```json
{
  "Brushed Steel": { "materialName": "Steel Brushed", "description": "metal parts" },
  "Clear Glass": { "materialPath": "C:/materials/glass_clear.mtl" }
}
```

Each preset must have a `materialName` or a `materialPath`. Use
`keyshot_list_material_presets` to see what is available.

### Camera preset library

The built-in `presets/cameras.json` provides Front, Back, Left, Right, Top,
Bottom, and Isometric standard views. Use `keyshot_list_camera_presets` to list
them and `keyshot_apply_camera_preset` to create or update a named camera.

Set `KEYSHOT_CAMERA_PRESETS` to a user-managed JSON file for custom presets:

```json
{
  "Front": { "standardView": "front" },
  "Hero": {
    "position": [4.5, 3.5, 4.5],
    "lookAt": [0, 0, 0],
    "up": [0, 1, 0],
    "description": "Custom absolute product camera"
  }
}
```

A preset file may use the object format shown above or an array whose entries
include a `name`. Each preset must contain either one supported `standardView`,
or both `position` and `lookAt`. Preset files are read-only to this MCP server.

## MCP Prompts and Resources

- Prompt: `keyshot_product_render`
- Resource: `keyshot://workflow`

Each tool returns JSON with:

- `ok`
- `data`
- `outputFiles`
- `warnings`
- `keyshotStdoutTail`
- `error`

## Notes

KeyShot's Python `lux` API changes across versions. This server keeps the MCP interface stable and returns a clear error when an installed KeyShot version does not expose a requested headless function.

## Roadmap

- [x] Auto-discover and batch render all cameras in a scene
- [x] Material preset library
- [x] Camera preset templates
- [x] Sequential render queue
- [x] Safer output directory restrictions
- [ ] More tested KeyShot versions
- [ ] macOS compatibility verification
- [x] Claude Desktop / Cursor / Codex config examples

## Real KeyShot demo

![KeyShot MCP generated cube demo](assets/demo/keyshot-mcp-demo.png)

The demo uses only the generated geometry in `examples/demo`. To reproduce the
status, import, inspect, two-camera creation, save, discovery, and PNG-render workflow locally:

```bash
npm run smoke:keyshot
```

## License

MIT

---

# 中文说明

[English](#keyshot-mcp) | 中文

这是一个本地 KeyShot MCP 服务，可以让支持 MCP 的 AI 工具通过 KeyShot 的无界面脚本能力控制 KeyShot Studio。

简单说：你可以让 AI 帮你检查 KeyShot 场景、渲染图片、导入模型、替换材质、调整相机、设置环境并保存场景。

本项目优先面向 Windows 环境下的 KeyShot Studio 产品渲染自动化流程。

与仅面向界面操作的自动化脚本不同，本项目优先面向 KeyShot 无界面工作流，并为 AI Agent 提供稳定的 MCP 工具接口。

## 适合谁使用

- 希望用 AI 辅助 KeyShot 渲染的设计师。
- 想要 KeyShot MCP 桥接工具的开发者。
- 已经在电脑上配置好 KeyShot 授权的团队。

这个项目不包含 KeyShot，不绕过 KeyShot 授权，也不会保存许可证密钥。

## 能做什么

- 检查 KeyShot 无界面程序是否能启动。
- 检查 `.bip` 或 KeyShot 支持的场景文件。
- 把场景渲染成图片。
- 从同一个场景批量渲染多个指定相机。
- 自动发现并渲染场景中的全部相机。
- 把模型导入场景。
- 给对象替换材质。
- 创建或更新相机。
- 应用可复用的标准或自定义相机预设。
- 在当前 KeyShot 版本支持时设置环境。
- 把场景保存为新文件。

## 典型使用场景

- 批量渲染同一个 KeyShot 场景的多个相机视角。
- 对同一个产品模型快速测试多组材质方案。
- 统一输出产品首图、封面图、详情页渲染图。
- 用一句自然语言完成导入模型、替换材质、设置相机、渲染出图。

## 工作流程

![KeyShot MCP Workflow](assets/workflow.svg)

## 使用要求

- 已安装支持 `keyshot_headless` 的 KeyShot Studio。
- Node.js 20 或更新版本。
- 电脑上已经配置好有效的 KeyShot 授权。

## 版本兼容表

| 平台 | KeyShot 版本 | Node 版本 | 状态 |
| --- | --- | --- | --- |
| Windows 11 | KeyShot Studio 2025 / 14.1 | Node 22 | 已测试 |
| macOS | 未测试 | - | 需要贡献者 |
| Linux | 未测试 | - | 需要贡献者 |

## 安装

### 安装已发布的 npm 包

```bash
npm install -g keyshot-mcp
```

当前发布版本为 `0.6.0`。如果你只是想使用 MCP 服务，直接安装 npm 包最简单。
电脑仍需要安装 KeyShot Studio，并且已经配置好本地 KeyShot 授权。

### 从源码安装

```bash
npm install
npm run build
```

### 三种独立配置方式

下面三种方式选择一种即可：

**全局 npm 安装**（先运行 `npm install -g keyshot-mcp`）：

```json
{"mcpServers":{"keyshot":{"command":"keyshot-mcp","env":{"KEYSHOT_HEADLESS_EXE":"C:/KeyShot/bin/keyshot_headless.exe"}}}}
```

**免安装，直接使用 npx**：

```json
{"mcpServers":{"keyshot":{"command":"npx","args":["-y","keyshot-mcp@0.6.0"],"env":{"KEYSHOT_HEADLESS_EXE":"C:/KeyShot/bin/keyshot_headless.exe"}}}}
```

**使用本地源码**（先运行 `npm install && npm run build`）：

```json
{"mcpServers":{"keyshot":{"command":"node","args":["C:/path/to/keyshot-mcp/dist/index.js"],"env":{"KEYSHOT_HEADLESS_EXE":"C:/KeyShot/bin/keyshot_headless.exe"}}}}
```

## 复制给 Agent 的安装提示词

如果你使用 Codex 或其他编程 Agent，可以复制下面这段话，让 Agent 帮你安装和配置 MCP：

```text
请帮我安装 KeyShot MCP 0.6.0，并添加到我的 MCP 客户端。

请你：
1. 查找我电脑上的 KeyShot headless 可执行文件路径。
2. 使用 npx -y keyshot-mcp@0.6.0 添加 keyshot MCP server。
3. 把 KEYSHOT_HEADLESS_EXE 设置为检测到的 keyshot_headless 路径。
4. 用 keyshot_status 工具测试是否配置成功。
5. 最后告诉我实际添加的配置，以及状态检查是否通过。

不要保存许可证密钥、账号密码或授权信息。直接使用我电脑上已有的 KeyShot 本地授权配置。
```

## 配置

需要告诉 MCP 服务 KeyShot 无界面程序在哪里。

Windows PowerShell 示例：

```powershell
$env:KEYSHOT_HEADLESS_EXE="C:\Program Files\KeyShot Studio\bin\keyshot_headless.exe"
```

macOS/Linux 示例：

```bash
export KEYSHOT_HEADLESS_EXE="/Applications/KeyShot Studio.app/Contents/MacOS/keyshot_headless"
```

然后测试能否启动：

```bash
npm run status
```

## MCP 客户端配置示例

把类似下面的配置加到你的 MCP 客户端里：

```json
{
  "mcpServers": {
    "keyshot": {
      "command": "node",
      "args": ["/absolute/path/to/keyshot-mcp/dist/index.js"],
      "env": {
        "KEYSHOT_HEADLESS_EXE": "/absolute/path/to/keyshot_headless"
      }
    }
  }
}
```

通用 Codex 配置模板在：

```text
examples/codex.example.json
```

## Codex 配置

如果你使用 Codex，请在 Codex 的 MCP 配置里添加一个 `keyshot` 服务，并指向构建后的服务文件：

```json
{
  "mcpServers": {
    "keyshot": {
      "command": "node",
      "args": ["/absolute/path/to/keyshot-mcp/dist/index.js"],
      "env": {
        "KEYSHOT_HEADLESS_EXE": "/absolute/path/to/keyshot_headless"
      }
    }
  }
}
```

`examples/codex.example.json` 是通用配置模板。使用时请把里面的路径换成自己电脑上的路径。

## 提示词示例

```text
把当前 KeyShot 场景渲染成三个视角：正视图、45 度透视图和俯视图。分辨率为 1920x1080，并保存到默认输出文件夹。
```

```text
导入 /path/to/model.step，给主体外壳应用拉丝金属材质，设置 45 度相机，并渲染一张产品主视觉图。
```

```text
检查当前 KeyShot 场景，并总结场景中的对象、相机、材质和可渲染输出。
```

```text
列出当前 KeyShot 场景中的相机，创建或更新一个名为“Hero”的相机，
把场景保存为新文件，并用这个相机渲染一张预览图。
```

```text
自动找出这个 KeyShot 场景里的全部相机，把所有视角渲染到 all-cameras 文件夹。
某个相机失败时继续处理其他相机，最后告诉我每个视角的结果。
```

```text
列出可用的相机预设，把 Isometric 等距预设应用为名为“目录等距视图”的相机，
保存一份新场景，并用这个相机渲染预览图。
```

## 环境变量

- `KEYSHOT_HEADLESS_EXE`：`keyshot_headless` 或 `keyshot_headless.exe` 的路径。
- `KEYSHOT_OUTPUT_DIR`：默认渲染输出文件夹。
- `KEYSHOT_LICENSE_ARGS`：可选的 KeyShot 无界面许可证参数，默认留空。
- `KEYSHOT_TIMEOUT_MS`：单次操作超时时间，单位毫秒，默认 `600000`。
- `KEYSHOT_MATERIAL_PRESETS`：材质预设库 JSON 文件路径，默认 `presets/materials.json`。
- `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS`：是否允许写到默认输出目录之外，默认 `false`。
- `KEYSHOT_CAMERA_PRESETS`：相机预设 JSON 文件路径，默认 `presets/cameras.json`。

默认情况下，所有输出图片和场景都必须写入 `KEYSHOT_OUTPUT_DIR`，相对路径会自动放入该目录。
只有确实需要写到外部目录时才设置为 `true`；输入场景和模型路径不受此限制。

`samples` 和 `maxTimeSeconds` 是两种不同的 KeyShot 渲染模式，请二选一，不要同时传入。

## MCP 工具

- `keyshot_status`：检查 KeyShot 是否能启动。
- `keyshot_inspect_scene`：检查场景内容。
- `keyshot_list_cameras`：列出场景中所有相机名称（批量渲染前很有用）。
- `keyshot_render`：渲染单张图片。
- `keyshot_batch_render`：批量渲染多个相机视角。
- `keyshot_render_all_cameras`：自动发现并渲染场景中的全部相机，默认单个视角失败后继续。
- `keyshot_render_queue`：顺序执行多个渲染任务（默认遇错即停，设置 `continueOnError` 可继续）。
- `keyshot_import_model`：导入模型。
- `keyshot_apply_material`：替换材质。
- `keyshot_list_material_presets`：列出材质预设库中的预设。
- `keyshot_apply_material_preset`：把预设库中的某个命名材质应用到物体上。
- `keyshot_set_camera`：设置相机。
- `keyshot_list_camera_presets`：列出标准和自定义相机预设。
- `keyshot_apply_camera_preset`：用预设创建或更新命名相机。
- `keyshot_set_environment`：设置环境。
- `keyshot_save_scene`：保存场景。

### 自动渲染全部相机

`keyshot_render_all_cameras` 会在同一次 KeyShot 无界面运行中自动读取场景相机并逐个渲染。
`continueOnError` 默认是 `true`，因此单个相机失败不会阻止其他视角；同名安全文件会自动添加
`-2`、`-3` 等编号。除非设置 `overwrite: true`，否则不会覆盖已有图片。KeyShot 内部不能激活的
`last_active` 占位项会被列出并跳过。

### 材质预设库

`keyshot_apply_material_preset` 会读取一个小的 JSON 注册表，让你用"好记的名字"复用材质，
而不必记住 KeyShot 里精确的材质名。默认位置：`presets/materials.json`
（可用环境变量 `KEYSHOT_MATERIAL_PRESETS` 覆盖）。

```json
{
  "拉丝钢": { "materialName": "Steel Brushed", "description": "金属件默认材质" },
  "透明玻璃": { "materialPath": "C:/materials/glass_clear.mtl" }
}
```

每个预设必须包含 `materialName` 或 `materialPath`。用 `keyshot_list_material_presets` 查看有哪些预设。

### 相机预设库

内置的 `presets/cameras.json` 包含 Front、Back、Left、Right、Top、Bottom 和
Isometric 七个 KeyShot 标准视角。使用 `keyshot_list_camera_presets` 查看预设，
使用 `keyshot_apply_camera_preset` 创建或更新命名相机。

把 `KEYSHOT_CAMERA_PRESETS` 指向用户自己的 JSON 文件即可添加自定义预设：

```json
{
  "正视图": { "standardView": "front" },
  "产品主视角": {
    "position": [4.5, 3.5, 4.5],
    "lookAt": [0, 0, 0],
    "up": [0, 1, 0],
    "description": "自定义绝对坐标相机"
  }
}
```

预设文件既可以使用上面的对象格式，也可以使用每项包含 `name` 的数组格式。
每个预设只能选择一种形式：填写一个受支持的 `standardView`，或者同时填写
`position` 与 `lookAt`。MCP 只读取预设文件，不会自动修改它。

## MCP 提示词和资源

- 提示词：`keyshot_product_render`
- 资源：`keyshot://workflow`

每个工具都会返回 JSON，包含：

- `ok`：是否成功。
- `data`：主要结果。
- `outputFiles`：生成的文件。
- `warnings`：警告信息。
- `keyshotStdoutTail`：KeyShot 输出摘要。
- `error`：错误信息。

## 说明

KeyShot 的 Python `lux` API 会随版本变化。这个 MCP 会尽量保持对外工具名称稳定；如果当前 KeyShot 版本不支持某个无界面功能，会返回明确错误，而不是假装成功。

## 路线图

- [x] 自动发现并批量渲染场景中的所有相机
- [x] 材质预设库
- [x] 相机预设模板
- [x] 顺序渲染队列
- [x] 更安全的输出目录限制
- [ ] 测试更多 KeyShot 版本
- [ ] 验证 macOS 兼容性
- [x] 补充 Claude Desktop / Cursor / Codex 配置示例

## 真实 KeyShot Demo

![KeyShot MCP 自动生成的立方体 Demo](assets/demo/keyshot-mcp-demo.png)

Demo 只使用 `examples/demo` 中项目自己生成的几何体，不包含客户模型或第三方素材。
设置好 `KEYSHOT_HEADLESS_EXE` 后可复现状态检查、导入、检查场景、创建两个相机、自动发现、保存和真实 PNG 渲染：

```bash
npm run smoke:keyshot
```

## 测试

项目带了两套测试，不依赖真实的 KeyShot 也能跑：

- **TypeScript 测试（Vitest）**：覆盖配置读取、参数校验（schemas）、结果封装，以及用"假 KeyShot"跑通一次成功路径并验证 `work/tmp` 临时文件会被清理。

  ```bash
  npm install
  npm test
  ```

- **Python bridge 测试（unittest）**：用假的 `lux` 对象验证 `import_model` 会真正打开基础场景、`set_camera` 在拿不到相机对象时不会崩溃并回退到 `lux` 级 API。

  ```bash
  python tests/test_bridge.py
  ```

## 开源协议

MIT

## Star History / 星标趋势

![Star History Chart](assets/star-history.svg)

This chart is generated from GitHub stargazer data and refreshed by GitHub Actions.

这张图由 GitHub star 数据生成，并通过 GitHub Actions 定时刷新。
