# Model workflow evaluation / 模型工作流评估

This protocol evaluates an MCP client and model together. Passing unit tests does
not establish model quality or desktop-control support. Results are pending until
the tasks are run in both clients with recorded evidence.

本清单评估模型与 MCP 客户端的实际协作。单元测试通过不能证明模型表现或桌面控制能力。
两组任务均完成并留下记录后，才能得出对比结论。

## Setup / 准备

- Use the same MCP commit, KeyShot version, client version, and generated cube at
  `examples/demo/keyshot-mcp-cube.obj`. Record exact model IDs and reasoning settings.
- Start each run in a fresh conversation with the same Skill and prompt. Use a
  separate safe output directory per run and the same preview settings.
- Run each task three times per model. Record failed runs as well as successes.
- Use only generated assets. Review any logs before sharing them; omit credentials
  and personal paths. Preview images are processed by the configured model provider.

- 固定 MCP 提交、KeyShot 和客户端版本，使用仓库立方体；记录完整模型名称和推理设置。
- 每轮使用新对话、相同 Skill 和提示词、独立安全输出目录与相同预览参数。
- 每个模型每项任务运行三次，失败也计入结果。
- 仅使用生成资产；分享记录前移除凭据和个人路径，预览会交给配置的模型服务处理。

## Tasks / 任务

Run the same language version for both models. Substitute absolute fixture paths.
两种模型使用同一语言版本，将路径占位符替换为测试资产的绝对路径。

| ID  | Prompt / 提示词                                                                                                                      | Pass condition / 通过条件                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| T1  | Check whether KeyShot MCP is ready. / 检查 KeyShot MCP 是否准备就绪。                                                                | Reports actual diagnostic results; explains failures without claiming success. / 如实反馈诊断，失败时说明原因。                |
| T2  | Import `<cube.obj>` to a copy and show a preview; do not produce a final render yet. / 导入立方体并展示预览，暂不正式出图。          | Imports before preview, returns a visible image, preserves source. / 先导入再预览，保留源文件。                                |
| T3  | Inspect this preview and propose one camera adjustment; wait before applying it. / 检查预览，提出一项相机调整，先别执行。            | Describes visible evidence and concrete parameters; makes no edit. / 依据画面提出具体参数，不提前修改。                        |
| T4  | Apply that adjustment to a copy and show the new preview. / 把刚才的调整应用到副本并重新预览。                                       | Reuses approval, edits the identified camera, previews the returned copy. / 不重复索要确认，预览实际修改的副本。               |
| T5  | List available material presets and propose one for this object; wait for approval. / 列出可用材质预设，为该对象推荐一个，等待确认。 | Uses real preset names and scene object identifiers, never invents a material. / 使用真实预设和对象标识。                      |
| T6  | Render the approved scene at standard quality. / 按标准质量渲染已确认的场景。                                                        | Uses the approved scene, reports actual output and warnings, stops when complete. / 使用已确认场景，如实报告结果，完成后停止。 |

For T4, use the same approved camera adjustment in both model runs. For T6, use
the same approved scene. This separates execution reliability from design taste.

T4 两组使用同一项已批准的相机参数；T6 使用同一份已批准场景，以便比较执行可靠性。

## Record / 记录模板

Copy this block for each task and repetition. Pending is not a pass.
每项任务每轮填写一次，未执行不能标记通过。

```text
Date / 日期:
MCP commit and version / 提交与版本:
Model ID and reasoning / 模型与推理设置:
Client and KeyShot versions / 客户端与 KeyShot 版本:
Task and repetition / 任务与轮次:
Result / 结果: pending | pass | fail | blocked
Elapsed seconds / 总耗时:
Tool calls and retries / 工具调用与重试次数:
Unnecessary confirmation requests / 重复确认次数:
Actual image received / 是否收到图片:
Source preserved / 源文件是否保留:
Evidence and error / 证据与错误:
Visual judgment / 视觉判断: user review required
```

Compare success rate, median elapsed time, retries, unnecessary questions, and
unsupported visual claims. Keep subjective design preference separate. Report
cost only when client usage data is available; do not estimate it from elapsed time.

比较成功率、耗时中位数、重试、重复确认和无依据的画面描述；设计偏好另行记录。
费用仅引用客户端实际用量，不按耗时推算。

## Local baseline / 本地基线

On 2026-09-14, KeyShot 14.1.0.154 returned `ready: true` on the development
Windows machine. The generated cube was imported to a scene copy and rendered
at 960 x 540 with 16 samples. The preview response included PNG image content
and reported 179159 bytes. This was a direct tool smoke check, not a comparison
of GPT-5.6 and GPT-6. Both model evaluations and desktop interaction remain pending.

2026-09-14，开发机 KeyShot 14.1.0.154 状态检查通过，仓库立方体成功导入副本，
生成 960 x 540、16 samples 的预览，响应包含 PNG 图片内容，大小为 179159 字节。
这是直接工具验证；GPT-5.6、GPT-6 对照评估和桌面交互仍待执行。

## Desktop experiment / 桌面实验

Optional and separate: with an explicitly available desktop tool, test opening a
generated output folder and scene copy. Record the desktop provider and actual
outcome. This does not demonstrate persistent Live Bridge support or support in
other clients. The stable MCP workflow remains saved-scene and headless based.

可选独立实验：客户端确实提供桌面操作工具时，测试打开生成的输出目录和场景副本。
记录工具来源与实际结果，不据此宣称 Live Bridge 或其他客户端已经兼容。
