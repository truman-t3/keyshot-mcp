import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findCameraPreset,
  loadCameraPresets,
  normalizeCameraPresets,
  STANDARD_CAMERA_VIEWS,
} from "../src/camera-presets.js";
import type { ServerConfig } from "../src/config.js";

const tempRoots: string[] = [];

function config(cameraPresetsPath: string): ServerConfig {
  return {
    projectRoot: path.dirname(cameraPresetsPath),
    keyshotHeadlessExe: "keyshot_headless",
    keyshotOutputDir: path.join(path.dirname(cameraPresetsPath), "outputs"),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1000,
    tmpDir: path.join(path.dirname(cameraPresetsPath), "tmp"),
    bridgeScriptPath: path.join(path.dirname(cameraPresetsPath), "bridge.py"),
    materialPresetsPath: path.join(path.dirname(cameraPresetsPath), "materials.json"),
    cameraPresetsPath,
  };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("camera presets", () => {
  it("normalizes all seven standard views from an object registry", () => {
    const input = Object.fromEntries(
      STANDARD_CAMERA_VIEWS.map((view) => [view, { standardView: view.toUpperCase() }]),
    );
    const presets = normalizeCameraPresets(input);
    expect(presets).toHaveLength(7);
    expect(presets.every((preset) => preset.type === "standard")).toBe(true);
    expect(presets.map((preset) => preset.type === "standard" && preset.standardView)).toEqual(
      STANDARD_CAMERA_VIEWS,
    );
  });

  it("normalizes an array with a custom absolute camera", () => {
    const presets = normalizeCameraPresets([
      {
        name: "Hero",
        position: [4, 3, 4],
        lookAt: [0, 0, 0],
        up: [0, 1, 0],
        description: "custom",
      },
    ]);
    expect(presets).toEqual([
      {
        name: "Hero",
        type: "absolute",
        position: [4, 3, 4],
        lookAt: [0, 0, 0],
        up: [0, 1, 0],
        description: "custom",
      },
    ]);
  });

  it("drops incomplete, ambiguous, and unsupported entries", () => {
    const presets = normalizeCameraPresets({
      MissingLookAt: { position: [1, 2, 3] },
      Ambiguous: { standardView: "front", position: [1, 2, 3], lookAt: [0, 0, 0] },
      Unknown: { standardView: "diagonal" },
      Good: { standardView: "isometric" },
    });
    expect(presets.map((preset) => preset.name)).toEqual(["Good"]);
  });

  it("finds names exactly and case-insensitively", () => {
    const presets = normalizeCameraPresets({ Isometric: { standardView: "isometric" } });
    expect(findCameraPreset(presets, "Isometric")?.name).toBe("Isometric");
    expect(findCameraPreset(presets, "isometric")?.name).toBe("Isometric");
    expect(findCameraPreset(presets, "missing")).toBeUndefined();
  });

  it("loads a custom file and reports invalid JSON", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "camera-presets-"));
    tempRoots.push(root);
    const file = path.join(root, "cameras.json");
    await writeFile(file, JSON.stringify({ Front: { standardView: "front" } }), "utf8");
    await expect(loadCameraPresets(config(file))).resolves.toHaveLength(1);
    await writeFile(file, "{broken", "utf8");
    await expect(loadCameraPresets(config(file))).rejects.toThrow("not valid JSON");
  });

  it("treats a missing custom file as an empty library", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "camera-presets-"));
    tempRoots.push(root);
    await expect(loadCameraPresets(config(path.join(root, "missing.json")))).resolves.toEqual([]);
  });
});
