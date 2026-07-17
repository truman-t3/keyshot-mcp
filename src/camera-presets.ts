import fs from "node:fs/promises";
import type { ServerConfig } from "./config.js";

export const STANDARD_CAMERA_VIEWS = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
  "isometric",
] as const;

export type StandardCameraView = (typeof STANDARD_CAMERA_VIEWS)[number];
export type CameraVector = [number, number, number];

export type StandardCameraPreset = {
  name: string;
  type: "standard";
  standardView: StandardCameraView;
  description?: string;
};

export type AbsoluteCameraPreset = {
  name: string;
  type: "absolute";
  position: CameraVector;
  lookAt: CameraVector;
  up?: CameraVector;
  description?: string;
};

export type CameraPreset = StandardCameraPreset | AbsoluteCameraPreset;

export async function loadCameraPresets(config: ServerConfig): Promise<CameraPreset[]> {
  let raw: string;
  try {
    raw = await fs.readFile(config.cameraPresetsPath, "utf8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Camera presets file is not valid JSON: ${config.cameraPresetsPath}`);
  }

  return normalizeCameraPresets(parsed);
}

export function normalizeCameraPresets(parsed: unknown): CameraPreset[] {
  const entries: CameraPreset[] = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.name !== "string" || !record.name) continue;
      const preset = toCameraPreset(record.name, record);
      if (preset) entries.push(preset);
    }
  } else if (parsed && typeof parsed === "object") {
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const preset = toCameraPreset(name, value as Record<string, unknown>);
      if (preset) entries.push(preset);
    }
  }

  return entries;
}

export function findCameraPreset(
  presets: CameraPreset[],
  name: string,
): CameraPreset | undefined {
  const lower = name.toLowerCase();
  return (
    presets.find((preset) => preset.name === name) ??
    presets.find((preset) => preset.name.toLowerCase() === lower)
  );
}

function toCameraPreset(name: string, record: Record<string, unknown>): CameraPreset | undefined {
  const description = typeof record.description === "string" ? record.description : undefined;
  const standardView = normalizeStandardView(record.standardView);
  const position = toVector(record.position);
  const lookAt = toVector(record.lookAt);
  const up = toVector(record.up);

  const hasStandard = standardView !== undefined;
  const hasAbsolute = position !== undefined || lookAt !== undefined || up !== undefined;
  if (hasStandard && !hasAbsolute) {
    return { name, type: "standard", standardView, description };
  }
  if (!hasStandard && position && lookAt) {
    return { name, type: "absolute", position, lookAt, up, description };
  }
  return undefined;
}

function normalizeStandardView(value: unknown): StandardCameraView | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  return STANDARD_CAMERA_VIEWS.find((view) => view === normalized);
}

function toVector(value: unknown): CameraVector | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return undefined;
  return [value[0], value[1], value[2]];
}
