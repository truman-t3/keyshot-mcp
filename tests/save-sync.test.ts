import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { resolveSavedScene, syncSavedScene } from "../src/save-sync.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("saved scene synchronization", () => {
  it("copies a saved scene to a collision-safe output and returns a fingerprint", async () => {
    const { config, source, output } = await fixture();
    const response = await syncSavedScene(config, {
      sourcePath: source,
      includePreview: false,
    });
    const result = response.structuredContent as any;

    expect(result.ok).toBe(true);
    expect(result.data.changed).toBe(true);
    expect(result.data.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.data.synchronizedScene).toBe(
      path.join(output, "design-synced.bip"),
    );
    await expect(
      fs.readFile(result.data.synchronizedScene, "utf8"),
    ).resolves.toBe("scene-v1");
  });

  it("uses one newer file in a directory and numbers automatic collisions", async () => {
    const { config, root, output } = await fixture();
    const older = path.join(root, "older.bip");
    const newer = path.join(root, "newer.BIP");
    await fs.writeFile(older, "old");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fs.writeFile(newer, "new");
    await fs.writeFile(path.join(output, "newer-synced.bip"), "occupied");

    expect(await resolveSavedScene(root)).toBe(newer);
    const response = await syncSavedScene(config, {
      sourcePath: root,
      includePreview: false,
    });
    const result = response.structuredContent as any;
    expect(result.data.synchronizedScene).toBe(
      path.join(output, "newer-synced-2.bip"),
    );
  });

  it("returns unchanged without copying or previewing when the fingerprint matches", async () => {
    const { config, source } = await fixture();
    const first = await syncSavedScene(config, {
      sourcePath: source,
      includePreview: false,
    });
    const fingerprint = (first.structuredContent as any).data.fingerprint;
    const preview = vi.fn();
    const second = await syncSavedScene(
      config,
      { sourcePath: source, previousFingerprint: fingerprint },
      preview as any,
    );
    const result = second.structuredContent as any;
    expect(result.data.changed).toBe(false);
    expect(result.outputFiles).toEqual([]);
    expect(preview).not.toHaveBeenCalled();
  });

  it("embeds preview content and keeps only the synchronized scene", async () => {
    const { config, source } = await fixture();
    const preview = vi.fn(async () => ({
      content: [
        { type: "text", text: "preview" },
        { type: "image", data: "cG5n", mimeType: "image/png" },
      ],
      structuredContent: {
        ok: true,
        data: { preview: { width: 960, height: 540 } },
        outputFiles: [],
        warnings: [],
        keyshotStdoutTail: "",
        error: null,
      },
      isError: false,
    }));
    const response = await syncSavedScene(
      config,
      { sourcePath: source },
      preview as any,
    );
    const result = response.structuredContent as any;
    expect(preview).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ scenePath: result.data.synchronizedScene }),
    );
    expect(response.content.some((item) => item.type === "image")).toBe(true);
    expect(result.data.previewEmbedded).toBe(true);
    expect(result.outputFiles).toEqual([result.data.synchronizedScene]);
  });

  it("rejects missing scenes, non-bip inputs, unsafe outputs, and explicit collisions", async () => {
    const { config, root, source, output } = await fixture();
    const textFile = path.join(root, "notes.txt");
    await fs.writeFile(textFile, "x");
    await fs.writeFile(path.join(output, "fixed.bip"), "occupied");

    for (const args of [
      { sourcePath: path.join(root, "missing.bip"), includePreview: false },
      { sourcePath: textFile, includePreview: false },
      {
        sourcePath: source,
        outputScenePath: "../escape.bip",
        includePreview: false,
      },
      {
        sourcePath: source,
        outputScenePath: "fixed.bip",
        includePreview: false,
      },
    ]) {
      const result = (await syncSavedScene(config, args))
        .structuredContent as any;
      expect(result.ok).toBe(false);
    }
  });
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "keyshot-sync-test-"));
  roots.push(root);
  const output = path.join(root, "outputs");
  await fs.mkdir(output);
  const source = path.join(root, "design.bip");
  await fs.writeFile(source, "scene-v1");
  const config: ServerConfig = {
    projectRoot: root,
    keyshotHeadlessExe: "keyshot_headless.exe",
    keyshotOutputDir: output,
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1_000,
    tmpDir: path.join(root, "tmp"),
    bridgeScriptPath: path.join(root, "bridge.py"),
    materialPresetsPath: path.join(root, "materials.json"),
    cameraPresetsPath: path.join(root, "cameras.json"),
  };
  return { config, root, source, output };
}
