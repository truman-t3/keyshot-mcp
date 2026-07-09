import fs from "node:fs/promises";
import type { ServerConfig } from "./config.js";

export type MaterialPreset = {
  name: string;
  materialName?: string;
  materialPath?: string;
  description?: string;
};

/**
 * Load the material preset library from disk.
 *
 * The registry file (see config.materialPresetsPath, overridable with the
 * KEYSHOT_MATERIAL_PRESETS env var) may use either of two shapes:
 *
 *   1. Object keyed by preset name:
 *      { "Brushed Steel": { "materialName": "Steel Brushed", "description": "..." } }
 *
 *   2. Array of presets:
 *      [ { "name": "Brushed Steel", "materialName": "Steel Brushed" } ]
 *
 * A missing file is treated as an empty library (not an error), so the feature
 * works out of the box before the user creates any presets.
 */
export async function loadMaterialPresets(config: ServerConfig): Promise<MaterialPreset[]> {
  let raw: string;
  try {
    raw = await fs.readFile(config.materialPresetsPath, "utf8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Material presets file is not valid JSON: ${config.materialPresetsPath}`);
  }

  return normalizePresets(parsed);
}

export function normalizePresets(parsed: unknown): MaterialPreset[] {
  const entries: MaterialPreset[] = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : undefined;
        if (name) entries.push(toPreset(name, record));
      }
    }
  } else if (parsed && typeof parsed === "object") {
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        entries.push(toPreset(name, value as Record<string, unknown>));
      }
    }
  }

  return entries.filter((preset) => preset.materialName || preset.materialPath);
}

function toPreset(name: string, record: Record<string, unknown>): MaterialPreset {
  return {
    name,
    materialName: typeof record.materialName === "string" ? record.materialName : undefined,
    materialPath: typeof record.materialPath === "string" ? record.materialPath : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

export function findMaterialPreset(
  presets: MaterialPreset[],
  name: string,
): MaterialPreset | undefined {
  const lower = name.toLowerCase();
  return (
    presets.find((preset) => preset.name === name) ??
    presets.find((preset) => preset.name.toLowerCase() === lower)
  );
}
