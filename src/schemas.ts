import { z } from "zod";

const optionalPath = z.string().min(1).optional();

export const scenePathSchema = z.object({
  scenePath: z.string().min(1),
});

export const renderSchema = z.object({
  scenePath: z.string().min(1),
  outputPath: optionalPath,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  samples: z.number().int().positive().optional(),
  maxTimeSeconds: z.number().positive().optional(),
  camera: z.string().min(1).optional(),
  format: z.enum(["png", "jpg", "jpeg", "tif", "tiff", "exr"]).optional(),
});

export const batchRenderSchema = z.object({
  scenePath: z.string().min(1),
  outputDir: z.string().min(1),
  cameras: z.array(z.string().min(1)).min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  samples: z.number().int().positive().optional(),
  maxTimeSeconds: z.number().positive().optional(),
  format: z.enum(["png", "jpg", "jpeg", "tif", "tiff", "exr"]).optional(),
  overwrite: z.boolean().optional(),
});

export const importModelSchema = z.object({
  modelPath: z.string().min(1),
  baseScenePath: optionalPath,
  outputScenePath: z.string().min(1),
});

export const applyMaterialInputSchema = z.object({
  scenePath: z.string().min(1),
  objectName: z.string().min(1).optional(),
  objectPath: z.string().min(1).optional(),
  materialName: z.string().min(1).optional(),
  materialPath: z.string().min(1).optional(),
  outputScenePath: z.string().min(1),
});

export const applyMaterialSchema = applyMaterialInputSchema.refine((value) => value.objectName || value.objectPath, {
  message: "Provide objectName or objectPath.",
}).refine((value) => value.materialName || value.materialPath, {
  message: "Provide materialName or materialPath.",
});

const vector3 = z.tuple([z.number(), z.number(), z.number()]);

export const setCameraSchema = z.object({
  scenePath: z.string().min(1),
  cameraName: z.string().min(1).optional(),
  position: vector3,
  lookAt: vector3,
  up: vector3.optional(),
  distance: z.number().positive().optional(),
  outputScenePath: z.string().min(1),
});

export const setEnvironmentSchema = z.object({
  scenePath: z.string().min(1),
  environmentName: z.string().min(1).optional(),
  environmentPath: z.string().min(1).optional(),
  brightness: z.number().positive().optional(),
  outputScenePath: z.string().min(1),
});

export const saveSceneSchema = z.object({
  scenePath: z.string().min(1),
  outputScenePath: z.string().min(1),
});
