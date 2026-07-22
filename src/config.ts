import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export type ServerConfig = {
  projectRoot: string;
  keyshotHeadlessExe: string;
  keyshotOutputDir: string;
  keyshotAllowExternalOutputs: boolean;
  keyshotLicenseArgs: string[];
  keyshotTimeoutMs: number;
  tmpDir: string;
  bridgeScriptPath: string;
  materialPresetsPath: string;
  cameraPresetsPath: string;
};

const DEFAULT_KEYSHOT_EXE = process.platform === "win32" ? "keyshot_headless.exe" : "keyshot_headless";
const DEFAULT_TIMEOUT_MS = 600_000;

export function getConfig(): ServerConfig {
  const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

  const keyshotOutputDir = path.resolve(process.env.KEYSHOT_OUTPUT_DIR ?? defaultOutputDir());

  return {
    projectRoot,
    keyshotHeadlessExe: process.env.KEYSHOT_HEADLESS_EXE ?? DEFAULT_KEYSHOT_EXE,
    keyshotOutputDir,
    keyshotAllowExternalOutputs: parseBoolean(process.env.KEYSHOT_ALLOW_EXTERNAL_OUTPUTS),
    keyshotLicenseArgs: splitWindowsArgs(process.env.KEYSHOT_LICENSE_ARGS ?? ""),
    keyshotTimeoutMs: parsePositiveInt(process.env.KEYSHOT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    tmpDir: path.join(projectRoot, "work", "tmp"),
    bridgeScriptPath: path.join(projectRoot, "scripts", "keyshot_bridge.py"),
    materialPresetsPath: path.resolve(
      process.env.KEYSHOT_MATERIAL_PRESETS ?? path.join(projectRoot, "presets", "materials.json"),
    ),
    cameraPresetsPath: path.resolve(
      process.env.KEYSHOT_CAMERA_PRESETS ?? path.join(projectRoot, "presets", "cameras.json"),
    ),
  };
}

export function defaultOutputDir(): string {
  return path.join(os.homedir(), "Documents", "KeyShot MCP Outputs");
}

function parseBoolean(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitWindowsArgs(value: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if ((ch === '"' || ch === "'") && quote === null) {
      quote = ch;
      continue;
    }
    if (ch === quote) {
      quote = null;
      continue;
    }
    if (/\s/.test(ch) && quote === null) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (current) args.push(current);
  return args;
}
