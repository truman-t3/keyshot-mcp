# GUI and Saved Scenes / GUI 与已保存场景

## English

The stable KeyShot MCP server runs a separate KeyShot headless process against
files. It does not attach to the open GUI, read unsaved edits, observe the current
GUI selection, or apply changes to the active viewport. `keyshot_status` reporting
ready only confirms the headless installation.

### Why the Live Prototype Was Not Released

On the tested KeyShot 14.1 installation, a persistent GUI bridge script kept
KeyShot Script Runner active. The script window blocked normal interaction until
the script returned. Ending the script removed the bridge that was waiting for
later Agent requests; it did not create a persistent, non-blocking connection.

`lux.sync()` processes pending operations, but is not a background-service or
GUI-plugin lifecycle. Calling scene APIs from an arbitrary worker thread was not
accepted as a safe workaround. The prototype therefore failed the project's
interactive-use requirement and remains experimental.

This describes the tested scripting approach, not a claim that every possible
official plugin or SDK integration is impossible. A supported non-blocking plugin
or main-thread callback could be evaluated separately. The project does not promise
realtime support based on an unverified interface.

### The Stable Workflow

1. Save the current scene in KeyShot.
2. Give the Agent the saved `.bip` path or one project folder.
3. Use `keyshot_sync_saved_scene` to create a safe copy and review a preview.
4. Make approved changes in copies through the headless tools.
5. Open an output scene in KeyShot when needed. It does not replace the active
   GUI scene automatically.

Sync is explicit, not automatic watching. Reuse the returned fingerprint to avoid
duplicate work. Local stdio protocol support also does not enable remote ChatGPT
Events delivery; see [upgrade notes](UPGRADING.md).

## 中文

稳定版通过独立 KeyShot headless 进程处理文件，不连接当前 GUI，不读取未保存编辑、
当前选择或视口，也不把修改直接显示在正在使用的窗口中。`keyshot_status` 准备就绪
只说明后台运行环境正常。

### 为什么没有发布 Live 原型

在实测的 KeyShot 14.1 中，GUI 桥接脚本为了等待后续 Agent 请求，需要长期保持运行。
Script Runner 因而持续占用，脚本窗口阻挡正常交互。结束脚本虽然关闭了窗口，也同时
结束了等待请求的桥接服务，并没有留下非阻塞连接。

`lux.sync()` 用于同步待处理操作，不是后台服务或 GUI 插件生命周期接口。通过普通
后台线程调用场景 API 未被当成安全替代方案。因此，这个原型没有满足正常交互的要求，
只保留为实验，不作为可用功能发布。

这里说明的是已经测试的脚本方案，并不是断言所有官方插件或 SDK 接入都不可能。
如果有受支持的非阻塞插件或主线程回调，可以另行验证；项目不据未经验证的接口承诺实时能力。

### 稳定的工作方式

1. 在 KeyShot 保存当前场景。
2. 把 `.bip` 路径或一个项目文件夹交给 Agent。
3. 用 `keyshot_sync_saved_scene` 同步安全副本，先看预览。
4. 批准后通过 headless 工具修改副本。
5. 需要时在 KeyShot 打开输出场景；不会自动替换当前 GUI 场景。

同步需要显式调用，不是自动监控。复用返回的内容指纹可避免重复处理。
支持本地 stdio 协议也不等于开启远程 ChatGPT Events，详见[升级说明](UPGRADING.md)。
