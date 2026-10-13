# Lantern Material Comparison / 灯具材质对比

## English

This example imports a textured model, identifies two objects, corrects the glass,
and renders two metal finishes without changing the glass between them.
It was tested on Windows 11 with KeyShot 14.1.0.154 on 2026-10-13.

### Download the Asset

Open [Lantern 01 on Poly Haven](https://polyhaven.com/a/Lantern_01) and choose the
**glTF / 2K** download with its dependencies. Keep the `.gltf`, `.bin` and `textures`
folder together. The evaluated bundle is approximately 3.04 MB with 33,902 triangles.
Save it in a trusted local folder, for example `C:/models/lantern`.

Model author: **Rajil Jose Macatangay**. Model and source textures use
[CC0](https://polyhaven.com/license), not the project's MIT code license.
The repository includes only its own KeyShot renders, not the source model or
official preview artwork. [Credits](../../assets/demo/lantern/ATTRIBUTION.md).

KeyShot and its local material library are separate requirements. The material
verification patch is currently in `main`, not npm 0.13.0; use the source build
for verified results until the next patch release is published.

### Ask an Agent

```text
Use the local Lantern_01_2k.gltf to demonstrate KeyShot MCP.
Check status, import it with centering and ground placement, then inspect objects.
Identify the glass and metal separately using their actual objectPath values.
Use the local Glass Basic White material for the glass and retain the brass texture.
Use Isometric at 62 degrees FOV and render a 1440x1080, 64-sample baseline to a copy.
Then change only the metal to Brushed Steel, keeping glass, camera and environment
unchanged. Save a second copy, render it with the same settings, and inspect both
scenes to confirm the actual assignments. Do not overwrite existing outputs.
```

### Tool Sequence

1. `keyshot_status`: confirm `ready: true`.
2. `keyshot_import_model`: provide the full glTF path, enable `centerGeometry`,
   `snapToGround`, `adjustCameraLookAt`, `adjustEnvironment`, and save to
   `lantern-demo/imported.bip` under `KEYSHOT_OUTPUT_DIR`.
3. `keyshot_inspect_scene`: identify the metal and glass `objectPath` values.
4. `keyshot_product_render`: open the imported scene and use the baseline payload
   below, replacing the input scene path and inspected object path.
5. Run `keyshot_product_render` on the returned brass scene, replacing the metal
   with `Steel Brushed` or the `Brushed Steel` preset. Keep the camera and environment
   unchanged and use new output names.
6. Inspect both saved scenes. Confirm only the metal assignment changed.
   `keyshot_preview_render` can return either view directly to the Agent.

#### Baseline Payload

```json
{
  "scenePath": "C:/path/to/KeyShot MCP Outputs/lantern-demo/imported.bip",
  "materialAssignments": [
    {
      "objectPath": "<glass objectPath returned by inspection>",
      "materialName": "Glass Basic White"
    }
  ],
  "cameraPresetName": "Isometric",
  "cameraName": "Lantern Hero",
  "fieldOfView": 62,
  "qualityPreset": "standard",
  "width": 1440,
  "height": 1080,
  "outputScenePath": "lantern-demo/brass.bip",
  "outputPath": "lantern-demo/brass.png",
  "overwrite": false
}
```

The steel pass uses the actual returned `savedScene` as `scenePath`, one assignment
to the inspected **metal** path, the same width/height/quality, and
`lantern-demo/steel.bip` / `lantern-demo/steel.png` as outputs. Omit new camera or
environment settings to retain the baseline setup.

### What to Check

- Both objects appear; neither the handle nor base is clipped.
- The glass is visibly transparent and has the same material in both scenes.
- Only the metal object's finish changes.
- Images and scenes stay inside the configured output root.
- Existing explicit outputs are not overwritten; choose fresh names on reruns.

The imported glTF glass was dark/opaque before correction. The demonstration does
not claim perfect shader migration. Library names depend on the installed KeyShot
version; inspect the local library if a name is missing. The model has intentional
vintage wear and is not a clean CAD benchmark. Source textures and the installed
startup environment remain local dependencies; do not redistribute a generated
`.bip` as a self-contained scene without checking them.

## 中文

本示例导入带贴图的模型，检查两个对象，修正玻璃，再只替换金属材质形成对比图。
2026-10-13 已在 Windows 11 + KeyShot 14.1.0.154 实机验证。

### 下载素材

在 [Poly Haven 模型页](https://polyhaven.com/a/Lantern_01)选择 **glTF / 2K**，
连同依赖文件下载。`.gltf`、`.bin` 和 `textures` 文件夹要保持相对位置。
本次测试包约 3.04 MB、33,902 个三角面，可放在 `C:/models/lantern` 等可信本地目录。

作者 **Rajil Jose Macatangay**，模型与原贴图采用 [CC0](https://polyhaven.com/license)，
不改用项目代码的 MIT 许可。仓库只包含本地生成的渲染图，没有源模型、官方预览图、
KeyShot 材质库文件或场景包。[素材说明](../../assets/demo/lantern/ATTRIBUTION.md)。

需要本机 KeyShot 和材质库。材质校验修复目前在 `main`，尚未进入 npm 0.13.0；
下一补丁版发布前，请用源码版验证。

### 复制给 Agent

```text
用本地 Lantern_01_2k.gltf 演示 KeyShot MCP。
先检查状态，居中贴地导入，再检查对象，使用实际 objectPath 分别识别玻璃和金属。
玻璃使用本机 Glass Basic White，保留原黄铜贴图；用 Isometric、62 度视野角，
输出 1440x1080、64 samples 的基准图并保存场景副本。
再只把金属改为 Brushed Steel，保持玻璃、相机和环境不变，用相同参数生成第二张图。
重新检查两个保存的场景，确认实际材质；所有结果放在允许目录，不覆盖已有输出。
```

### 执行顺序

1. `keyshot_status` 确认 `ready: true`。
2. `keyshot_import_model` 使用模型完整路径，开启居中、贴地、调整观察点和环境，
   保存到允许目录中的 `lantern-demo/imported.bip`。
3. `keyshot_inspect_scene` 获取金属和玻璃的完整 `objectPath`。
4. `keyshot_product_render` 用上方 JSON 建立黄铜基准图。把占位符换成实际场景路径
   和玻璃对象路径，输出 `lantern-demo/brass.bip`、`brass.png`。
5. 打开工具返回的实际 `savedScene`，再用 `keyshot_product_render` 只给金属应用
   `Steel Brushed`，或使用 `Brushed Steel` 预设。保持相机、环境和渲染参数不变，
   输出 `lantern-demo/steel.bip`、`steel.png`。
6. 检查保存后的两个场景，确认只有金属材质发生变化；预览工具可直接把图返回给 Agent。

### 验收与限制

模型应完整入画，玻璃透明，前后玻璃材质一致，只有金属外观变化。输出只在允许目录。
重复执行请换新名称，不覆盖已有文件。

原始 glTF 的玻璃导入后偏黑、不透明，需要显式修正。演示不表示所有着色器会自动完整
迁移，也不是自动设计判断。其他 KeyShot 材质库可能使用不同名称。
该模型有刻意的做旧和凹痕，不作为干净 CAD 精度样本。生成场景仍引用本地贴图与
KeyShot 启动环境，检查依赖及许可前不作为完整场景包分发。
