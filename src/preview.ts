import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { normalizeOutputPath } from "./output-paths.js";
import { localFailure, toolImageResponse, toolResponse } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import { previewRenderInputSchema } from "./schemas.js";
import type { KeyShotResult } from "./types.js";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

type PreviewResponse =
  | ReturnType<typeof toolResponse>
  | ReturnType<typeof toolImageResponse>;

export async function renderPreview(
  config: ServerConfig,
  rawArgs: unknown,
  runKeyShot = runKeyShotSerialized,
): Promise<PreviewResponse> {
  let explicitOutput = false;
  let previewPath: string | undefined;

  try {
    const args = previewRenderInputSchema.parse(rawArgs);
    explicitOutput = args.outputPath !== undefined;
    previewPath = explicitOutput
      ? await normalizeOutputPath(config, args.outputPath!)
      : path.join(
          config.keyshotOutputDir,
          ".keyshot-mcp-preview",
          `preview-${Date.now()}-${crypto.randomUUID()}.png`,
        );

    if (await fileExists(previewPath)) {
      return toolResponse(
        localFailure(
          `Output already exists and overwrite is false: ${previewPath}`,
        ),
      );
    }

    await fs.mkdir(path.dirname(previewPath), { recursive: true });
    const width = args.width ?? 960;
    const height = args.height ?? 540;
    const samples =
      args.maxTimeSeconds === undefined ? (args.samples ?? 16) : undefined;
    const result = await runKeyShot(config, {
      operation: "render",
      scenePath: args.scenePath,
      outputPath: previewPath,
      camera: args.camera,
      width,
      height,
      samples,
      maxTimeSeconds: args.maxTimeSeconds,
      format: "png",
    });

    if (!result.ok) {
      await cleanupFailedTemporaryPreview(previewPath, explicitOutput);
      return toolResponse(result);
    }

    const image = await readPreviewPng(previewPath);
    const warnings = [...result.warnings];
    let outputFiles = explicitOutput
      ? uniquePaths([...result.outputFiles, previewPath])
      : [];
    let retainedPath: string | null = explicitOutput ? previewPath : null;

    if (!explicitOutput) {
      try {
        await fs.rm(previewPath, { force: true });
      } catch (error) {
        warnings.push(
          `Could not delete temporary preview; retained at ${previewPath}: ${errorMessage(error)}`,
        );
        outputFiles = uniquePaths([...result.outputFiles, previewPath]);
        retainedPath = previewPath;
      }
    }

    const responseResult: KeyShotResult = {
      ...result,
      data: {
        ...(isRecord(result.data) ? result.data : {}),
        preview: {
          width,
          height,
          bytes: image.byteLength,
          camera: args.camera ?? null,
          saved: explicitOutput,
          savedPath: retainedPath,
          imageEmbedded: true,
        },
      },
      outputFiles,
      warnings,
    };
    return toolImageResponse(responseResult, image.toString("base64"));
  } catch (error) {
    const failure = localFailure(errorMessage(error), {
      outputFiles: explicitOutput && previewPath ? [previewPath] : [],
      suggestions: previewSuggestions(errorMessage(error)),
    });
    if (!explicitOutput && previewPath) {
      try {
        await fs.rm(previewPath, { force: true });
      } catch (cleanupError) {
        failure.warnings.push(
          `Could not delete temporary preview; retained at ${previewPath}: ${errorMessage(cleanupError)}`,
        );
        failure.outputFiles.push(previewPath);
      }
    }
    return toolResponse(failure);
  }
}

export async function readPreviewPng(filePath: string): Promise<Buffer> {
  const image = await fs.readFile(filePath);
  if (image.byteLength > MAX_PREVIEW_BYTES) {
    throw new Error(
      `Preview PNG exceeds the 8 MiB MCP image limit (${image.byteLength} bytes).`,
    );
  }
  if (
    image.byteLength < PNG_SIGNATURE.byteLength ||
    !image.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
  ) {
    throw new Error("Preview output is not a valid PNG file.");
  }
  return image;
}

function previewSuggestions(error: string): string[] {
  const normalized = error.toLowerCase();
  if (
    normalized.includes("8 mib") ||
    normalized.includes("valid png") ||
    normalized.includes("read") ||
    normalized.includes("enoent") ||
    normalized.includes("no such file")
  ) {
    return ["Retry with a smaller width and height, or use fewer samples."];
  }
  return localFailure(error).suggestions ?? [];
}

async function cleanupFailedTemporaryPreview(
  filePath: string,
  explicitOutput: boolean,
): Promise<void> {
  if (!explicitOutput)
    await fs.rm(filePath, { force: true }).catch(() => undefined);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
