import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { normalizeOutputPath, normalizeOutputPaths } from "../src/output-paths.js";

let root: string;
let outputDir: string;

function config(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    projectRoot: root,
    keyshotHeadlessExe: "keyshot_headless.exe",
    keyshotOutputDir: outputDir,
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1000,
    tmpDir: path.join(root, "tmp"),
    bridgeScriptPath: path.join(root, "bridge.py"),
    materialPresetsPath: path.join(root, "presets.json"),
    ...overrides,
  };
}

describe("output path safety", () => {
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "keyshot-paths-"));
    outputDir = path.join(root, "outputs");
    mkdirSync(outputDir, { recursive: true });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("places relative paths and legal subdirectories under the output directory", async () => {
    expect(await normalizeOutputPath(config(), "preview.png")).toBe(path.join(outputDir, "preview.png"));
    expect(await normalizeOutputPath(config(), path.join("renders", "preview.png"))).toBe(
      path.join(outputDir, "renders", "preview.png"),
    );
  });

  it("accepts an absolute path inside the output directory", async () => {
    const target = path.join(outputDir, "scene.bip");
    expect(await normalizeOutputPath(config(), target)).toBe(target);
  });

  it.each(["parent traversal", "adjacent same-prefix directory", "external absolute path"])(
    "rejects %s",
    async (label) => {
      const target = label === "parent traversal"
        ? path.join("..", "escape.png")
        : label === "adjacent same-prefix directory"
          ? path.join(root, "outputs-other", "escape.png")
          : path.join(root, "external", "escape.png");
      await expect(normalizeOutputPath(config(), target)).rejects.toThrow("KEYSHOT_OUTPUT_DIR");
    },
  );

  it("allows external paths only with the compatibility switch", async () => {
    const target = path.join(root, "external", "allowed.png");
    expect(await normalizeOutputPath(config({ keyshotAllowExternalOutputs: true }), target)).toBe(target);
  });

  it("normalizes every supported output field", async () => {
    const result = await normalizeOutputPaths(config(), {
      operation: "render",
      outputPath: "image.png",
      outputDir: "batch",
      outputScenePath: "scene.bip",
    });
    expect(result.outputPath).toBe(path.join(outputDir, "image.png"));
    expect(result.outputDir).toBe(path.join(outputDir, "batch"));
    expect(result.outputScenePath).toBe(path.join(outputDir, "scene.bip"));
  });

  it("rejects a symlink or junction that escapes the output directory", async () => {
    const external = path.join(root, "external-target");
    const link = path.join(outputDir, "linked");
    mkdirSync(external, { recursive: true });
    try {
      symlinkSync(external, link, process.platform === "win32" ? "junction" : "dir");
    } catch {
      return;
    }
    await expect(normalizeOutputPath(config(), path.join("linked", "escape.png"))).rejects.toThrow(
      "KEYSHOT_OUTPUT_DIR",
    );
  });

  it.skipIf(process.platform !== "win32")("handles Windows drive-letter casing consistently", async () => {
    const target = path.join(outputDir, "case.png");
    const swapped = target[0] === target[0].toUpperCase()
      ? target[0].toLowerCase() + target.slice(1)
      : target[0].toUpperCase() + target.slice(1);
    await expect(normalizeOutputPath(config(), swapped)).resolves.toBe(swapped);
  });
});
