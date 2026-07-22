import { describe, expect, it } from "vitest";
import { applyRenderQuality, QUALITY_PRESETS } from "../src/quality.js";

describe("render quality presets", () => {
  it("defines reproducible preview, standard, and final settings", () => {
    expect(QUALITY_PRESETS.preview).toEqual({ width: 960, height: 540, samples: 16 });
    expect(QUALITY_PRESETS.standard).toEqual({ width: 1920, height: 1080, samples: 64 });
    expect(QUALITY_PRESETS.final).toEqual({ width: 3840, height: 2160, samples: 256 });
  });

  it("keeps lower-level requests unchanged when no preset is selected", () => {
    expect(applyRenderQuality({ scenePath: "scene.bip" })).toEqual({ scenePath: "scene.bip" });
  });

  it("applies a selected or default preset", () => {
    expect(applyRenderQuality({ qualityPreset: "preview" })).toMatchObject({
      width: 960,
      height: 540,
      samples: 16,
    });
    expect(applyRenderQuality({}, "standard")).toMatchObject({
      qualityPreset: "standard",
      width: 1920,
      height: 1080,
      samples: 64,
    });
  });

  it("lets explicit fields override individual preset values", () => {
    expect(applyRenderQuality({ qualityPreset: "final", width: 2000, samples: 80 })).toMatchObject({
      width: 2000,
      height: 2160,
      samples: 80,
    });
  });

  it("uses max time instead of preset samples", () => {
    const result = applyRenderQuality({ qualityPreset: "preview", maxTimeSeconds: 12 });
    expect(result.maxTimeSeconds).toBe(12);
    expect(result.samples).toBeUndefined();
  });
});
