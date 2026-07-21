import path from "node:path";
import { findCameraPreset, loadCameraPresets } from "./camera-presets.js";
import type { ServerConfig } from "./config.js";
import { findMaterialPreset, loadMaterialPresets } from "./presets.js";
import type { productRenderInputSchema } from "./schemas.js";
import type { KeyShotRequest } from "./types.js";
import type { z } from "zod";

type ProductRenderInput = z.infer<typeof productRenderInputSchema>;

export async function prepareProductRenderRequest(
  config: ServerConfig,
  input: ProductRenderInput,
): Promise<KeyShotRequest> {
  const sourcePath = input.modelPath ?? input.scenePath!;
  const stem = safeStem(sourcePath);
  const format = input.format ?? "png";
  const renderMode = input.renderMode ?? "single";

  const request: KeyShotRequest = {
    ...input,
    operation: "product_render",
    renderMode,
    format,
    outputScenePath: input.outputScenePath ?? `${stem}-product.bip`,
    overwrite: input.overwrite ?? false,
    continueOnError: input.continueOnError ?? true,
  };

  if (renderMode === "single") {
    request.outputPath = input.outputPath ?? `${stem}-product.${format}`;
    delete request.outputDir;
  } else {
    request.outputDir = input.outputDir ?? `${stem}-renders`;
    delete request.outputPath;
  }

  if (input.modelPath) {
    request.centerGeometry = input.centerGeometry ?? true;
    request.snapToGround = input.snapToGround ?? true;
    request.adjustCameraLookAt = input.adjustCameraLookAt ?? true;
    request.adjustEnvironment = input.adjustEnvironment ?? true;
  }

  request.materialAssignments = await resolveMaterialAssignments(config, input.materialAssignments ?? []);

  const presetName = input.cameraPresetName ?? (input.modelPath ? "Isometric" : undefined);
  if (presetName) {
    const presets = await loadCameraPresets(config);
    const preset = findCameraPreset(presets, presetName);
    if (!preset) {
      const available = presets.map((entry) => entry.name).join(", ") || "(none)";
      throw new Error(`Camera preset not found: "${presetName}". Available: ${available}`);
    }
    request.cameraPresetName = preset.name;
    request.cameraName = input.cameraName ?? (input.modelPath ? "Product Hero" : preset.name);
    if (preset.type === "standard") {
      request.standardView = preset.standardView;
    } else {
      request.position = preset.position;
      request.lookAt = preset.lookAt;
      request.up = preset.up;
    }
  } else if (input.modelPath) {
    request.cameraName = input.cameraName ?? "Product Hero";
  }

  return request;
}

async function resolveMaterialAssignments(
  config: ServerConfig,
  assignments: NonNullable<ProductRenderInput["materialAssignments"]>,
): Promise<Array<Record<string, unknown>>> {
  if (assignments.length === 0) return [];
  const needsPresets = assignments.some((assignment) => assignment.presetName !== undefined);
  const presets = needsPresets ? await loadMaterialPresets(config) : [];

  return assignments.map((assignment) => {
    if (!assignment.presetName) return { ...assignment };
    const preset = findMaterialPreset(presets, assignment.presetName);
    if (!preset) {
      const available = presets.map((entry) => entry.name).join(", ") || "(none)";
      throw new Error(`Material preset not found: "${assignment.presetName}". Available: ${available}`);
    }
    return {
      objectName: assignment.objectName,
      objectPath: assignment.objectPath,
      presetName: preset.name,
      materialName: preset.materialName,
      materialPath: preset.materialPath,
    };
  });
}

function safeStem(sourcePath: string): string {
  const parsed = path.parse(sourcePath);
  const normalized = parsed.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "product";
}
