# GitHub Publishing Guide / GitHub 发布指南

## English

This is the simple non-developer path for publishing this project.

### 1. Create an Empty GitHub Repository

Go to GitHub and create a new public repository named:

```text
keyshot-mcp
```

Choose:

- Public
- Do not add README
- Do not add license
- Do not add `.gitignore`

Those files already exist in this folder.

### 2. Upload This Folder

Upload the contents of this folder:

```text
C:\path\to\keyshot-mcp
```

Do not upload:

- `node_modules`
- `work`
- private KeyShot scenes
- private renders
- license files or account information

### 3. Replace Local Paths In Examples

The example below is a generic template:

```text
examples/codex.example.json
```

Users must replace the placeholder paths with their own paths.

### 4. Recommended GitHub Description

```text
MCP server for controlling KeyShot Studio through headless scripting.
```

Recommended topics:

```text
mcp, keyshot, rendering, design-tools, model-context-protocol
```

### 5. First Release Name

```text
v0.1.0
```

---

## 中文

这是给非研发用户看的 GitHub 发布步骤。

### 1. 创建一个空的 GitHub 仓库

打开 GitHub，新建一个公开仓库，名字建议：

```text
keyshot-mcp
```

创建时选择：

- Public / 公开
- 不要添加 README
- 不要添加 license
- 不要添加 `.gitignore`

这些文件项目里已经有了。

### 2. 上传这个文件夹

上传这个文件夹里的内容：

```text
C:\path\to\keyshot-mcp
```

不要上传：

- `node_modules`
- `work`
- 私人的 KeyShot 场景
- 私人的渲染结果
- 许可证文件、账号信息或授权信息

### 3. 替换示例里的本机路径

下面这个文件是通用模板：

```text
examples/codex.example.json
```

用户需要把里面的占位路径换成自己电脑上的路径。

### 4. 推荐 GitHub 简介

```text
MCP server for controlling KeyShot Studio through headless scripting.
```

推荐标签：

```text
mcp, keyshot, rendering, design-tools, model-context-protocol
```

### 5. 第一个版本名

```text
v0.1.0
```
