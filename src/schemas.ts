import { z } from "zod";

const optionalPath = z.string().min(1).optional();

const imageFormat = z.enum(["png", "jpg", "jpeg", "tif", "tiff", "exr"]);

export const scenePathSchema = z.object({
  scenePath: z.string().min(1),
});

export const listCamerasSchema = z.object({
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

export const renderInputSchema = renderSchema.refine(
  (value) => !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

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

export const batchRenderInputSchema = batchRenderSchema.refine(
  (value) => !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

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

// --- Render queue ---
export const renderJobSchema = z.object({
  scenePath: z.string().min(1),
  outputPath: optionalPath,
  camera: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  samples: z.number().int().positive().optional(),
  maxTimeSeconds: z.number().positive().optional(),
  format: imageFormat.optional(),
});

export const renderJobInputSchema = renderJobSchema.refine(
  (value) => !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

export const renderQueueSchema = z.object({
  jobs: z.array(renderJobSchema).min(1),
  continueOnError: z.boolean().optional(),
});

export const renderQueueInputSchema = z.object({
  jobs: z.array(renderJobInputSchema).min(1),
  continueOnError: z.boolean().optional(),
});

// --- Material preset library ---
export const listMaterialPresetsSchema = z.object({});

export const applyMaterialPresetInputSchema = z.object({
  scenePath: z.string().min(1),
  presetName: z.string().min(1),
  objectName: z.string().min(1).optional(),
  objectPath: z.string().min(1).optional(),
  outputScenePath: z.string().min(1),
});

export const applyMaterialPresetSchema = applyMaterialPresetInputSchema.refine(
  (value) => value.objectName || value.objectPath,
  { message: "Provide objectName or objectPath." },
);
