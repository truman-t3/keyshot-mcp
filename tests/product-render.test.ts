import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { prepareProductRenderRequest } from "../src/product-render.js";
import { productRenderSchema } from "../src/schemas.js";

let root: string;
let config: ServerConfig;

describe("product render request preparation", () => {
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "keyshot-product-render-"));
    const presets = path.join(root, "presets");
    mkdirSync(presets, { recursive: true });
    writeFileSync(path.join(presets, "materials.json"), JSON.stringify({ Steel: { materialName: "Steel Brushed" } }));
    writeFileSync(path.join(presets, "cameras.json"), JSON.stringify({
      Isometric: { standardView: "isometric" },
      Hero: { position: [1, 2, 3], lookAt: [0, 0, 0], up: [0, 1, 0] },
    }));
    config = {
      projectRoot: root,
      keyshotHeadlessExe: "keyshot_headless.exe",
      keyshotOutputDir: path.join(root, "outputs"),
      keyshotAllowExternalOutputs: false,
      keyshotLicenseArgs: [],
      keyshotTimeoutMs: 1000,
      tmpDir: path.join(root, "tmp"),
      bridgeScriptPath: path.join(root, "bridge.py"),
      materialPresetsPath: path.join(presets, "materials.json"),
      cameraPresetsPath: path.join(presets, "cameras.json"),
    };
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("prepares conservative defaults for a new model", async () => {
    const input = productRenderSchema.parse({ modelPath: "C:/models/My Speaker.obj" });
    const request = await prepareProductRenderRequest(config, input);
    expect(request.outputScenePath).toBe("My-Speaker-product.bip");
    expect(request.outputPath).toBe("My-Speaker-product.png");
    expect(request.standardView).toBe("isometric");
    expect(request.cameraName).toBe("Product Hero");
    expect(request.centerGeometry).toBe(true);
    expect(request.overwrite).toBe(false);
  });

  it("preserves an existing scene unless controls are requested", async () => {
    const input = productRenderSchema.parse({ scenePath: "C:/scenes/watch.bip", renderMode: "allCameras" });
    const request = await prepareProductRenderRequest(config, input);
    expect(request.outputScenePath).toBe("watch-product.bip");
    expect(request.outputDir).toBe("watch-renders");
    expect(request.cameraName).toBeUndefined();
    expect(request.centerGeometry).toBeUndefined();
  });

  it("resolves material and absolute camera presets while retaining lens overrides", async () => {
    const input = productRenderSchema.parse({
      scenePath: "watch.bip",
      cameraPresetName: "hero",
      focalLength: 85,
      materialAssignments: [{ objectName: "Case", presetName: "steel" }],
    });
    const request = await prepareProductRenderRequest(config, input);
    expect(request.position).toEqual([1, 2, 3]);
    expect(request.focalLength).toBe(85);
    expect(request.materialAssignments).toEqual([
      expect.objectContaining({ objectName: "Case", presetName: "Steel", materialName: "Steel Brushed" }),
    ]);
  });

  it("reports missing presets with available names", async () => {
    const input = productRenderSchema.parse({ modelPath: "m.obj", cameraPresetName: "Missing" });
    await expect(prepareProductRenderRequest(config, input)).rejects.toThrow("Available: Isometric, Hero");
  });
});
