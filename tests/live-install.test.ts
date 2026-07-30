import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import {
  installLiveScripts,
  LEGACY_LIVE_SUPPORT_SCRIPT,
  LIVE_CONFIG_FILE,
  LIVE_START_SCRIPT,
  LIVE_SUPPORT_PACKAGE,
  LIVE_SUPPORT_SCRIPT,
  uninstallLiveScripts,
} from "../src/live-install.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe("Live Companion installer", () => {
  it("copies the scripts and a shared discovery configuration, then removes them", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "keyshot-live-install-"));
    temporary.push(root);
    const source = path.join(root, "source");
    const scripts = path.join(root, "KeyShot Scripts");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "live.py"), "# live\nINSTALLER_DISCOVERY_PATH = None\n");
    await fs.writeFile(path.join(source, "core.py"), "# core");
    await fs.mkdir(scripts, { recursive: true });
    await fs.writeFile(path.join(scripts, LEGACY_LIVE_SUPPORT_SCRIPT), "# legacy core");
    const config = makeConfig(source, scripts);

    await expect(installLiveScripts(config, scripts)).resolves.toBe(path.resolve(scripts));
    await expect(fs.readFile(path.join(scripts, LIVE_START_SCRIPT), "utf8")).resolves.toContain(
      `INSTALLER_DISCOVERY_PATH = ${JSON.stringify(config.liveDiscoveryPath)}`,
    );
    await expect(fs.readFile(path.join(scripts, LIVE_SUPPORT_SCRIPT), "utf8")).resolves.toBe("# core");
    await expect(fs.stat(path.join(scripts, LEGACY_LIVE_SUPPORT_SCRIPT))).rejects.toThrow();
    const installedConfig = JSON.parse(await fs.readFile(path.join(scripts, LIVE_CONFIG_FILE), "utf8"));
    expect(installedConfig.discoveryPath).toBe(config.liveDiscoveryPath);

    await uninstallLiveScripts(config, scripts);
    await expect(fs.stat(path.join(scripts, LIVE_START_SCRIPT))).rejects.toThrow();
    await expect(fs.stat(path.join(scripts, LIVE_SUPPORT_PACKAGE))).rejects.toThrow();
    await expect(fs.stat(path.join(scripts, LIVE_CONFIG_FILE))).rejects.toThrow();
  });
});

function makeConfig(source: string, scriptDir: string): ServerConfig {
  return {
    projectRoot: source,
    keyshotHeadlessExe: path.join(source, "bin", "keyshot_headless.exe"),
    keyshotOutputDir: path.join(source, "outputs"),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1000,
    tmpDir: path.join(source, "tmp"),
    bridgeScriptPath: path.join(source, "core.py"),
    materialPresetsPath: path.join(source, "materials.json"),
    cameraPresetsPath: path.join(source, "cameras.json"),
    liveBridgeScriptPath: path.join(source, "live.py"),
    liveSupportScriptPath: path.join(source, "core.py"),
    liveDiscoveryPath: path.join(source, "session.json"),
    liveScriptDir: scriptDir,
  };
}
