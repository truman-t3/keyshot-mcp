# Material Assignment / 材质应用

## English

Material tools target one object by name or full scene-tree path. Prefer paths
when names are duplicated. They save a new scene only after the assignment is
confirmed; they do not replace every object's material or change the GUI scene.

- `materialName` must exactly match a material in the scene or local KeyShot
  library. Missing names fail explicitly.
- `materialPath` must point to a native single-material KeyShot MTL file supported by the local
  KeyShot installation. The bridge uses `loadMaterials` to load it into the
  current headless project, not into the user's persistent material library.
  A Wavefront OBJ companion `.mtl` is a different format and cannot be substituted.
  Empty/unsupported loads return `MATERIAL_FILE_INVALID` with repair guidance.
- Files that fail to load, return no material names, or contain multiple materials
  are rejected. Export one material per file rather than relying on implicit selection.
- Results include `previousMaterial` and `appliedMaterial`. KeyShot may append a
  numbered suffix such as ` #1` when creating an unlinked material copy.
- Unconfirmed assignments report failure and do not save the output scene.

Default preset labels remain unchanged. Their KeyShot 14.1 library references are
`Steel Brushed`, `Soft Rough Black`, and `Glass Basic White`. Custom libraries or
other KeyShot versions may use different names; configure a custom preset file
through `KEYSHOT_MATERIAL_PRESETS` rather than assuming all installations match.

Material files and KeyShot's bundled library assets are not distributed by this
project. Keep the applicable third-party asset licenses separate from the MIT
license for KeyShot MCP. Imported glTF shaders may require adjustment; a successful
model import does not guarantee perfect material migration.

## 中文

材质工具按对象名称或完整场景树路径操作，名称重复时应使用完整路径。只有确认材质实际
生效后才保存输出场景，不批量覆盖所有对象，也不修改用户正在打开的 GUI 场景。

- `materialName` 必须与当前场景或本机 KeyShot 材质库中的名称完全一致，不存在时明确报错。
- `materialPath` 使用本机支持的 KeyShot 原生单材质 MTL 文件，通过 `loadMaterials` 加载到当前后台
  场景，不写入用户的持久材质库。
  OBJ 配套的 Wavefront `.mtl` 是另一种格式，不能混用；空加载或不支持的文件返回
  `MATERIAL_FILE_INVALID` 和修复建议。
- 文件损坏、没有返回材质名称或包含多个材质时停止操作，不默认选择第一项。
- 结果包含 `previousMaterial`（原材质）与 `appliedMaterial`（实际应用的材质）。
  KeyShot 创建未关联副本时可能自动追加 ` #1` 等编号。
- 无法确认应用结果时返回失败，不保存输出场景。

默认预设名称不变；KeyShot 14.1 的实际材质引用分别为 `Steel Brushed`、
`Soft Rough Black`、`Glass Basic White`。其他版本或自定义材质库名称可能不同，
可通过 `KEYSHOT_MATERIAL_PRESETS` 指定自己的预设文件。

项目不分发 KeyShot 官方材质库文件；外部模型的许可也不改用项目 MIT 许可。
glTF 导入后的材质可能需要修正，不能把模型导入成功理解为所有材质自动完整迁移。
