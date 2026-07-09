import { describe, expect, it } from "vitest";
import { normalizePresets, findMaterialPreset } from "../src/presets.js";

describe("normalizePresets", () => {
  it("parses the object-keyed shape", () => {
    const presets = normalizePresets({
      "Brushed Steel": { materialName: "Steel Brushed", description: "metal" },
      "Clear Glass": { materialPath: "C:/mats/glass.mtl" },
    });
    expect(presets).toHaveLength(2);
    expect(findMaterialPreset(presets, "Brushed Steel")?.materialName).toBe("Steel Brushed");
    expect(findMaterialPreset(presets, "Clear Glass")?.materialPath).toBe("C:/mats/glass.mtl");
  });

  it("parses the array shape", () => {
    const presets = normalizePresets([
      { name: "Matte Black", materialName: "Plastic Matte Black" },
    ]);
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("Matte Black");
  });

  it("drops entries that have neither materialName nor materialPath", () => {
    const presets = normalizePresets({
      Broken: { description: "no material reference" },
      Good: { materialName: "X" },
    });
    expect(presets.map((p) => p.name)).toEqual(["Good"]);
  });

  it("returns empty for junk input", () => {
    expect(normalizePresets(null)).toEqual([]);
    expect(normalizePresets(42)).toEqual([]);
    expect(normalizePresets("nope")).toEqual([]);
  });
});

describe("findMaterialPreset", () => {
  const presets = normalizePresets({ "Brushed Steel": { materialName: "Steel Brushed" } });

  it("matches exactly", () => {
    expect(findMaterialPreset(presets, "Brushed Steel")?.name).toBe("Brushed Steel");
  });

  it("matches case-insensitively as a fallback", () => {
    expect(findMaterialPreset(presets, "brushed steel")?.name).toBe("Brushed Steel");
  });

  it("returns undefined when not found", () => {
    expect(findMaterialPreset(presets, "Gold")).toBeUndefined();
  });
});
