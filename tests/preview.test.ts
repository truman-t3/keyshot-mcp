import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../src/config.js";
import {
  MAX_PREVIEW_BYTES,
  readPreviewPng,
  renderPreview,
} from "../src/preview.js";
import { previewRenderInputSchema } from "../src/schemas.js";
import type { KeyShotRequest, KeyShotResult } from "../src/types.js";

const roots: string[] = [];
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("preview schema", () => {
  it("accepts documented boundaries and rejects conflicts", () => {
    expect(
      previewRenderInputSchema.parse({
        scenePath: "scene.bip",
        width: 64,
        height: 1080,
        samples: 64,
      }),
    ).toBeTruthy();
    expect(() =>
      previewRenderInputSchema.parse({ scenePath: "scene.bip", width: 63 }),
    ).toThrow();
    expect(() =>
      previewRenderInputSchema.parse({
        scenePath: "scene.bip",
        maxTimeSeconds: 61,
      }),
    ).toThrow();
    expect(() =>
      previewRenderInputSchema.parse({
        scenePath: "scene.bip",
        samples: 16,
        maxTimeSeconds: 2,
      }),
    ).toThrow();
    expect(() =>
      previewRenderInputSchema.parse({
        scenePath: "scene.bip",
        outputPath: "preview.jpg",
      }),
    ).toThrow();
  });
});

describe("preview response", () => {
  it("returns text, structured content, and an embedded PNG, then deletes the temporary file", async () => {
    const config = await makeConfig();
    let request: KeyShotRequest | undefined;
    const response = await renderPreview(
      config,
      { scenePath: "scene.bip" },
      async (_config, nextRequest) => {
        request = nextRequest;
        await fs.writeFile(String(nextRequest.outputPath), PNG);
        return success([String(nextRequest.outputPath)]);
      },
    );

    expect(request).toMatchObject({
      width: 960,
      height: 540,
      samples: 16,
      format: "png",
    });
    expect(response.content.map((item) => item.type)).toEqual([
      "text",
      "image",
    ]);
    expect(response.structuredContent.data).toMatchObject({
      preview: {
        width: 960,
        height: 540,
        bytes: PNG.byteLength,
        saved: false,
        imageEmbedded: true,
      },
    });
    expect(response.structuredContent.outputFiles).toEqual([]);
    await expect(fs.access(String(request?.outputPath))).rejects.toThrow();
  });

  it("uses time mode without injecting default samples", async () => {
    const config = await makeConfig();
    let request: KeyShotRequest | undefined;
    await renderPreview(
      config,
      { scenePath: "scene.bip", maxTimeSeconds: 10 },
      async (_config, nextRequest) => {
        request = nextRequest;
        await fs.writeFile(String(nextRequest.outputPath), PNG);
        return success([String(nextRequest.outputPath)]);
      },
    );
    expect(request?.maxTimeSeconds).toBe(10);
    expect(request?.samples).toBeUndefined();
  });

  it("preserves an explicit safe PNG and refuses existing files", async () => {
    const config = await makeConfig();
    const response = await renderPreview(
      config,
      { scenePath: "scene.bip", outputPath: "saved.png" },
      async (_config, request) => {
        await fs.writeFile(String(request.outputPath), PNG);
        return success([String(request.outputPath)]);
      },
    );
    expect(response.structuredContent.outputFiles).toEqual([
      path.join(config.keyshotOutputDir, "saved.png"),
    ]);
    expect(response.structuredContent.data).toMatchObject({
      preview: { saved: true },
    });

    const second = await renderPreview(config, {
      scenePath: "scene.bip",
      outputPath: "saved.png",
    });
    expect(second.isError).toBe(true);
    expect(second.structuredContent.errorCode).toBe("OUTPUT_EXISTS");
  });

  it("rejects paths outside the safe output directory", async () => {
    const config = await makeConfig();
    const response = await renderPreview(config, {
      scenePath: "scene.bip",
      outputPath: "../escape.png",
    });
    expect(response.isError).toBe(true);
    expect(response.structuredContent.errorCode).toBe(
      "OUTPUT_OUTSIDE_ALLOWED_DIRECTORY",
    );
  });

  it("rejects invalid and oversized PNG files", async () => {
    const config = await makeConfig();
    await fs.mkdir(config.keyshotOutputDir, { recursive: true });
    const invalid = path.join(config.keyshotOutputDir, "invalid.png");
    await fs.writeFile(invalid, "not png");
    await expect(readPreviewPng(invalid)).rejects.toThrow("valid PNG");

    const large = path.join(config.keyshotOutputDir, "large.png");
    await fs.writeFile(
      large,
      Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(MAX_PREVIEW_BYTES)]),
    );
    await expect(readPreviewPng(large)).rejects.toThrow("8 MiB");
  });

  it("returns a clear read error when KeyShot reports success without a PNG", async () => {
    const config = await makeConfig();
    const response = await renderPreview(
      config,
      { scenePath: "scene.bip" },
      async () => success([]),
    );
    expect(response.isError).toBe(true);
    expect(response.structuredContent.suggestions).toContain(
      "Retry with a smaller width and height, or use fewer samples.",
    );
  });

  it("reports and locates a temporary preview when cleanup fails", async () => {
    const config = await makeConfig();
    const remove = vi
      .spyOn(fs, "rm")
      .mockRejectedValueOnce(new Error("file is locked"));
    const response = await renderPreview(
      config,
      { scenePath: "scene.bip" },
      async (_config, request) => {
        await fs.writeFile(String(request.outputPath), PNG);
        return success([String(request.outputPath)]);
      },
    );
    expect(remove).toHaveBeenCalled();
    expect(response.structuredContent.warnings[0]).toContain("retained at");
    expect(response.structuredContent.outputFiles).toHaveLength(1);
    expect(response.structuredContent.data).toMatchObject({
      preview: { saved: false, imageEmbedded: true },
    });
  });
});

async function makeConfig(): Promise<ServerConfig> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "keyshot-preview-test-"),
  );
  roots.push(root);
  return {
    projectRoot: root,
    keyshotHeadlessExe: "keyshot_headless.exe",
    keyshotOutputDir: path.join(root, "outputs"),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1_000,
    tmpDir: path.join(root, "tmp"),
    bridgeScriptPath: path.join(root, "bridge.py"),
    materialPresetsPath: path.join(root, "materials.json"),
    cameraPresetsPath: path.join(root, "cameras.json"),
  };
}

function success(outputFiles: string[]): KeyShotResult {
  return {
    ok: true,
    data: {},
    outputFiles,
    warnings: [],
    keyshotStdoutTail: "",
    error: null,
  };
}
