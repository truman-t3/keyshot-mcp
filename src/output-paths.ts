import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import type { KeyShotRequest } from "./types.js";

const OUTPUT_FIELDS = ["outputPath", "outputDir", "outputScenePath"] as const;

export async function normalizeOutputPaths(
  config: ServerConfig,
  request: KeyShotRequest,
): Promise<KeyShotRequest> {
  await fs.mkdir(config.keyshotOutputDir, { recursive: true });
  const normalized: KeyShotRequest = { ...request };

  for (const field of OUTPUT_FIELDS) {
    const value = request[field];
    if (typeof value !== "string" || value.length === 0) continue;
    normalized[field] = await normalizeOutputPath(config, value);
  }

  return normalized;
}

export async function normalizeOutputPath(config: ServerConfig, value: string): Promise<string> {
  const candidate = path.resolve(config.keyshotOutputDir, value);
  if (config.keyshotAllowExternalOutputs) return candidate;

  const outputRoot = await realpathWithMissingTail(config.keyshotOutputDir);
  const resolvedCandidate = await realpathWithMissingTail(candidate);
  if (!isWithin(outputRoot, resolvedCandidate)) {
    throw new Error(
      `Output path must stay inside KEYSHOT_OUTPUT_DIR (${config.keyshotOutputDir}): ${value}. ` +
        "Set KEYSHOT_ALLOW_EXTERNAL_OUTPUTS=true only if external writes are intentional.",
    );
  }

  return candidate;
}

async function realpathWithMissingTail(inputPath: string): Promise<string> {
  let current = path.resolve(inputPath);
  const missing: string[] = [];

  while (!(await exists(current))) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missing.unshift(path.basename(current));
    current = parent;
  }

  const realBase = await fs.realpath(current);
  return path.resolve(realBase, ...missing);
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(normalizeCase(root), normalizeCase(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function normalizeCase(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

async function exists(value: string): Promise<boolean> {
  try {
    await fs.lstat(value);
    return true;
  } catch {
    return false;
  }
}
