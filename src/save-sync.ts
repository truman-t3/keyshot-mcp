import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { normalizeOutputPath } from "./output-paths.js";
import { renderPreview } from "./preview.js";
import { localFailure, toolResponse } from "./result.js";
import { syncSavedSceneInputSchema } from "./schemas.js";
import type { KeyShotResult } from "./types.js";

type ToolResponse = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: "image/png" }
  >;
  structuredContent: Record<string, unknown>;
  isError: boolean;
};

export async function syncSavedScene(
  config: ServerConfig,
  rawArgs: unknown,
  previewFn = renderPreview,
): Promise<ToolResponse> {
  let copiedPath: string | undefined;
  try {
    const args = syncSavedSceneInputSchema.parse(rawArgs);
    const sourcePath = await resolveSavedScene(args.sourcePath);
    const sourceBefore = await describeFile(sourcePath);

    if (args.previousFingerprint === sourceBefore.fingerprint) {
      return toolResponse({
        ok: true,
        data: {
          changed: false,
          sourcePath,
          fingerprint: sourceBefore.fingerprint,
          size: sourceBefore.size,
          modifiedAt: sourceBefore.modifiedAt,
          synchronizedScene: null,
          previewEmbedded: false,
        },
        outputFiles: [],
        warnings: [],
        keyshotStdoutTail: "",
        error: null,
      }) as unknown as ToolResponse;
    }

    copiedPath = args.outputScenePath
      ? await normalizeOutputPath(config, args.outputScenePath)
      : await allocateSyncPath(config, sourcePath);
    if (await exists(copiedPath)) {
      throw new Error(
        `Output already exists and overwrite is false: ${copiedPath}`,
      );
    }
    if (samePath(sourcePath, copiedPath)) {
      throw new Error(
        "The synchronized scene copy must differ from sourcePath.",
      );
    }

    await fsp.mkdir(path.dirname(copiedPath), { recursive: true });
    await fsp.copyFile(sourcePath, copiedPath, fs.constants.COPYFILE_EXCL);

    const sourceAfter = await describeFile(sourcePath);
    if (
      sourceAfter.size !== sourceBefore.size ||
      sourceAfter.modifiedMs !== sourceBefore.modifiedMs ||
      sourceAfter.fingerprint !== sourceBefore.fingerprint
    ) {
      await fsp.rm(copiedPath, { force: true });
      copiedPath = undefined;
      throw new Error(
        "The KeyShot scene changed while it was being copied. Wait for saving to finish, then retry.",
      );
    }

    const baseData = {
      changed: true,
      sourcePath,
      fingerprint: sourceBefore.fingerprint,
      size: sourceBefore.size,
      modifiedAt: sourceBefore.modifiedAt,
      synchronizedScene: copiedPath,
    };

    if (args.includePreview === false) {
      return toolResponse({
        ok: true,
        data: { ...baseData, previewEmbedded: false },
        outputFiles: [copiedPath],
        warnings: [],
        keyshotStdoutTail: "",
        error: null,
      }) as unknown as ToolResponse;
    }

    const preview = (await previewFn(config, {
      scenePath: copiedPath,
      camera: args.camera,
      width: args.width,
      height: args.height,
      samples: args.samples,
      maxTimeSeconds: args.maxTimeSeconds,
    })) as unknown as ToolResponse;
    const previewResult = preview.structuredContent as KeyShotResult;
    const combined: KeyShotResult = {
      ...previewResult,
      data: {
        ...baseData,
        previewEmbedded: previewResult.ok,
        preview:
          previewResult.data && typeof previewResult.data === "object"
            ? (previewResult.data as Record<string, unknown>).preview
            : null,
      },
      outputFiles: uniquePaths([copiedPath, ...previewResult.outputFiles]),
    };
    return {
      ...preview,
      content: [
        { type: "text", text: JSON.stringify(combined, null, 2) },
        ...preview.content.filter((item) => item.type === "image"),
      ],
      structuredContent: { ...combined },
      isError: !combined.ok,
    };
  } catch (error) {
    const message = errorMessage(error);
    const suggestions = syncSuggestions(message);
    return toolResponse(
      localFailure(message, {
        outputFiles: copiedPath ? [copiedPath] : [],
        suggestions,
      }),
    ) as unknown as ToolResponse;
  }
}

export async function resolveSavedScene(sourcePath: string): Promise<string> {
  const resolved = path.resolve(sourcePath);
  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    throw new Error(`Saved KeyShot scene path not found: ${resolved}`);
  }
  if (stat.isFile()) {
    if (!isBip(resolved))
      throw new Error(
        `Saved KeyShot scene must use the .bip extension: ${resolved}`,
      );
    return resolved;
  }
  if (!stat.isDirectory())
    throw new Error(
      `Saved KeyShot scene path is not a file or directory: ${resolved}`,
    );

  const candidates = await Promise.all(
    (await fsp.readdir(resolved, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && isBip(entry.name))
      .map(async (entry) => {
        const filePath = path.join(resolved, entry.name);
        return { filePath, stat: await fsp.stat(filePath) };
      }),
  );
  candidates.sort(
    (left, right) =>
      right.stat.mtimeMs - left.stat.mtimeMs ||
      left.filePath.localeCompare(right.filePath),
  );
  if (!candidates[0])
    throw new Error(`No saved .bip scene was found in directory: ${resolved}`);
  return candidates[0].filePath;
}

async function describeFile(filePath: string) {
  const stat = await fsp.stat(filePath);
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", resolve);
  });
  const sha256 = hash.digest("hex");
  return {
    size: stat.size,
    modifiedMs: stat.mtimeMs,
    modifiedAt: stat.mtime.toISOString(),
    sha256,
    fingerprint: `sha256:${sha256}`,
  };
}

async function allocateSyncPath(
  config: ServerConfig,
  sourcePath: string,
): Promise<string> {
  const stem = path.parse(sourcePath).name;
  for (let sequence = 1; sequence < 10_000; sequence += 1) {
    const suffix = sequence === 1 ? "" : `-${sequence}`;
    const candidate = await normalizeOutputPath(
      config,
      `${stem}-synced${suffix}.bip`,
    );
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(
    "Could not find an available synchronized scene name after 9999 attempts.",
  );
}

function syncSuggestions(error: string): string[] {
  const normalized = error.toLowerCase();
  if (normalized.includes("changed while it was being copied")) {
    return [
      "Wait until KeyShot finishes saving the scene, then call keyshot_sync_saved_scene again.",
    ];
  }
  if (
    normalized.includes("no saved .bip") ||
    normalized.includes("not found")
  ) {
    return [
      "Save the scene as a .bip file, then provide that file path or its containing folder.",
    ];
  }
  return localFailure(error).suggestions ?? [];
}

function isBip(value: string): boolean {
  return path.extname(value).toLowerCase() === ".bip";
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  return normalize(left) === normalize(right);
}

async function exists(value: string): Promise<boolean> {
  try {
    await fsp.lstat(value);
    return true;
  } catch {
    return false;
  }
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values)];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
