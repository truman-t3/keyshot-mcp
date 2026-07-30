import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";

export const LIVE_START_SCRIPT = "Start KeyShot MCP Live.py";
export const LIVE_SUPPORT_PACKAGE = "_keyshot_mcp_core";
export const LIVE_SUPPORT_SCRIPT = path.join(LIVE_SUPPORT_PACKAGE, "__init__.py");
export const LEGACY_LIVE_SUPPORT_SCRIPT = "_keyshot_mcp_core.py";
export const LIVE_CONFIG_FILE = "_keyshot_mcp_live_config.json";

export async function findLiveScriptDirectories(config: ServerConfig): Promise<string[]> {
  const candidates = new Set<string>();
  if (config.liveScriptDir) candidates.add(config.liveScriptDir);
  if (path.isAbsolute(config.keyshotHeadlessExe)) {
    candidates.add(path.resolve(path.dirname(config.keyshotHeadlessExe), "..", "Scripts"));
  }
  const existing: string[] = [];
  for (const candidate of candidates) {
    if (await isDirectory(candidate)) existing.push(candidate);
  }
  return existing;
}

export async function installLiveScripts(config: ServerConfig, explicitDir?: string): Promise<string> {
  const scriptDir = explicitDir ? path.resolve(explicitDir) : await resolveSingleScriptDirectory(config);
  await fs.mkdir(scriptDir, { recursive: true });
  const liveSource = await fs.readFile(config.liveBridgeScriptPath, "utf8");
  const configuredLiveSource = liveSource.replace(
    "INSTALLER_DISCOVERY_PATH = None",
    `INSTALLER_DISCOVERY_PATH = ${JSON.stringify(config.liveDiscoveryPath)}`,
  );
  if (configuredLiveSource === liveSource) {
    throw new Error("Live Bridge script is missing the installer discovery-path marker.");
  }
  await fs.mkdir(path.join(scriptDir, LIVE_SUPPORT_PACKAGE), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(scriptDir, LIVE_START_SCRIPT), configuredLiveSource, "utf8"),
    fs.copyFile(config.liveSupportScriptPath, path.join(scriptDir, LIVE_SUPPORT_SCRIPT)),
    fs.rm(path.join(scriptDir, LEGACY_LIVE_SUPPORT_SCRIPT), { force: true }),
    fs.writeFile(
      path.join(scriptDir, LIVE_CONFIG_FILE),
      `${JSON.stringify({ discoveryPath: config.liveDiscoveryPath }, null, 2)}\n`,
      "utf8",
    ),
  ]);
  return scriptDir;
}

export async function uninstallLiveScripts(config: ServerConfig, explicitDir?: string): Promise<string> {
  const scriptDir = explicitDir ? path.resolve(explicitDir) : await resolveSingleScriptDirectory(config);
  await Promise.all([
    fs.rm(path.join(scriptDir, LIVE_START_SCRIPT), { force: true }),
    fs.rm(path.join(scriptDir, LIVE_SUPPORT_PACKAGE), { recursive: true, force: true }),
    fs.rm(path.join(scriptDir, LEGACY_LIVE_SUPPORT_SCRIPT), { force: true }),
    fs.rm(path.join(scriptDir, LIVE_CONFIG_FILE), { force: true }),
  ]);
  return scriptDir;
}

async function resolveSingleScriptDirectory(config: ServerConfig): Promise<string> {
  const matches = await findLiveScriptDirectories(config);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error("Could not locate the KeyShot Scripts folder. Pass --scripts-dir with the folder shown in KeyShot Preferences > Folders.");
  }
  throw new Error(`Multiple KeyShot Scripts folders were found. Pass --scripts-dir with one of: ${matches.join(", ")}`);
}

async function isDirectory(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isDirectory();
  } catch {
    return false;
  }
}
