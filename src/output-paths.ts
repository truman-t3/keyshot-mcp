import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import type { KeyShotRequest } from "./types.js";

const OUTPUT_FIELDS = ["outputPath", "outputDir", "outputScenePath"] as const;
const INPUT_FIELDS = new Set([
  "scenePath",
  "sourcePath",
  "modelPath",
  "baseScenePath",
  "materialPath",
  "environmentPath",
]);

export function inputFilePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(inputFilePaths);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    if (INPUT_FIELDS.has(key) && typeof entry === "string") return [entry];
    if (key === "_protectedInputPaths" && Array.isArray(entry))
      return entry.filter((item): item is string => typeof item === "string");
    return inputFilePaths(entry);
  });
}

export async function assertOutputFilesSafe(
  request: KeyShotRequest,
): Promise<void> {
  const inputs = inputFilePaths(request);
  const outputs = [request.outputScenePath, request.outputPath].filter(
    (value): value is string => typeof value === "string",
  );
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    for (const input of inputs) {
      if (await sameFile(output, input))
        throw new Error(`Output must not replace an input file: ${output}`);
    }
    for (const previous of outputs.slice(0, index)) {
      if (await sameFile(output, previous))
        throw new Error(
          `Output paths must refer to different files: ${output}`,
        );
    }
    try {
      const stat = await fs.lstat(output);
      let target = stat;
      if (stat.isSymbolicLink()) {
        try {
          target = await fs.stat(output);
        } catch {
          throw new Error(`Output file path must be a regular file: ${output}`);
        }
      }
      if (target.isDirectory())
        throw new Error(`Output file path is a directory: ${output}`);
      if (!target.isFile())
        throw new Error(`Output file path must be a regular file: ${output}`);
      if (request.overwrite !== true)
        throw new Error(
          `Output already exists and overwrite is false: ${output}`,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function sameFile(first: string, second: string): Promise<boolean> {
  if (
    normalizeCase(await realpathWithMissingTail(first)) ===
    normalizeCase(await realpathWithMissingTail(second))
  )
    return true;
  try {
    const a = await fs.stat(first, { bigint: true });
    const b = await fs.stat(second, { bigint: true });
    return a.ino !== 0n && a.dev === b.dev && a.ino === b.ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

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

export async function normalizeOutputPath(
  config: ServerConfig,
  value: string,
): Promise<string> {
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
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
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
