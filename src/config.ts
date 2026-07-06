import path from "node:path";
import { fileURLToPath } from "node:url";

export type ServerConfig = {
  projectRoot: string;
  keyshotHeadlessExe: string;
  keyshotOutputDir: string;
  keyshotLicenseArgs: string[];
  keyshotTimeoutMs: number;
  tmpDir: string;
  bridgeScriptPath: string;
};

const DEFAULT_KEYSHOT_EXE = "D:\\keyshot2025_183972\\bin\\keyshot_headless.exe";
const DEFAULT_TIMEOUT_MS = 600_000;

export function getConfig(): ServerConfig {
  const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

  const keyshotOutputDir = path.resolve(
    process.env.KEYSHOT_OUTPUT_DIR ?? path.join(projectRoot, "outputs"),
  );

  return {
    projectRoot,
    keyshotHeadlessExe: process.env.KEYSHOT_HEADLESS_EXE ?? DEFAULT_KEYSHOT_EXE,
    keyshotOutputDir,
    keyshotLicenseArgs: splitWindowsArgs(process.env.KEYSHOT_LICENSE_ARGS ?? ""),
    keyshotTimeoutMs: parsePositiveInt(process.env.KEYSHOT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    tmpDir: path.join(projectRoot, "work", "tmp"),
    bridgeScriptPath: path.join(projectRoot, "scripts", "keyshot_bridge.py"),
  };
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
