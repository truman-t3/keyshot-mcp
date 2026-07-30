import type { ServerConfig } from "./config.js";
import { installLiveScripts, uninstallLiveScripts } from "./live-install.js";
import { readLiveDiscovery, removeStaleDiscovery, runLiveSerialized } from "./live-client.js";

export async function runLiveCli(args: string[], config: ServerConfig): Promise<boolean> {
  const command = args[0];
  if (!command || !["install-live", "uninstall-live", "live-status", "live-stop"].includes(command)) return false;

  try {
    if (command === "install-live" || command === "uninstall-live") {
      const scriptDir = optionValue(args, "--scripts-dir");
      const installedDir = command === "install-live"
        ? await installLiveScripts(config, scriptDir)
        : await uninstallLiveScripts(config, scriptDir);
      console.log(command === "install-live"
        ? `Installed KeyShot MCP Live scripts in: ${installedDir}\nOpen KeyShot and run '${"Start KeyShot MCP Live"}' from the Scripts list.`
        : `Removed KeyShot MCP Live scripts from: ${installedDir}`);
      return true;
    }

    if (command === "live-status") {
      const discovery = await readLiveDiscovery(config.liveDiscoveryPath);
      const result = await runLiveSerialized(config, { operation: "live_status" });
      console.log(JSON.stringify({ discovery: { ...discovery, token: "<redacted>" }, result }, null, 2));
      process.exitCode = result.ok ? 0 : 1;
      return true;
    }

    const result = await runLiveSerialized(config, { operation: "live_stop" });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return true;
  } catch (error) {
    const removed = await removeStaleDiscovery(config.liveDiscoveryPath);
    console.error(`${errorMessage(error)}${removed ? " Removed a stale discovery file." : ""}`);
    process.exitCode = 1;
    return true;
  }
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a folder path.`);
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
