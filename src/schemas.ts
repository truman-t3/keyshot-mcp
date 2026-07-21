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

export const renderAllCamerasSchema = z.object({
  scenePath: z.string().min(1),
  outputDir: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  samples: z.number().int().positive().optional(),
  maxTimeSeconds: z.number().positive().optional(),
  format: imageFormat.optional(),
  overwrite: z.boolean().optional(),
  continueOnError: z.boolean().default(true),
});

export const renderAllCamerasInputSchema = renderAllCamerasSchema.refine(
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
  centerGeometry: z.boolean().optional(),
  snapToGround: z.boolean().optional(),
  adjustCameraLookAt: z.boolean().optional(),
  adjustEnvironment: z.boolean().optional(),
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

export const productMaterialAssignmentSchema = z.object({
  objectName: z.string().min(1).optional(),
  objectPath: z.string().min(1).optional(),
  presetName: z.string().min(1).optional(),
  materialName: z.string().min(1).optional(),
  materialPath: z.string().min(1).optional(),
}).superRefine((value, context) => {
  const targets = [value.objectName, value.objectPath].filter((item) => item !== undefined);
  const materials = [value.presetName, value.materialName, value.materialPath].filter((item) => item !== undefined);
  if (targets.length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose exactly one objectName or objectPath." });
  }
  if (materials.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose exactly one presetName, materialName, or materialPath.",
    });
  }
});

export const productRenderInputSchema = z.object({
  modelPath: optionalPath,
  scenePath: optionalPath,
  baseScenePath: optionalPath,
  outputScenePath: optionalPath,
  renderMode: z.enum(["single", "allCameras"]).default("single"),
  outputPath: optionalPath,
  outputDir: optionalPath,
  centerGeometry: z.boolean().optional(),
  snapToGround: z.boolean().optional(),
  adjustCameraLookAt: z.boolean().optional(),
  adjustEnvironment: z.boolean().optional(),
  materialAssignments: z.array(productMaterialAssignmentSchema).optional(),
  cameraPresetName: z.string().min(1).optional(),
  cameraName: z.string().min(1).optional(),
  position: vector3.optional(),
  lookAt: vector3.optional(),
  up: vector3.optional(),
  distance: z.number().positive().optional(),
  fieldOfView: z.number().gt(0).lt(180).optional(),
  focalLength: z.number().min(5).max(200).optional(),
  environmentName: z.string().min(1).optional(),
  environmentPath: z.string().min(1).optional(),
  brightness: z.number().positive().optional(),
  rotation: z.number().min(0).lt(360).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  samples: z.number().int().positive().optional(),
  maxTimeSeconds: z.number().positive().optional(),
  format: imageFormat.optional(),
  overwrite: z.boolean().default(false),
  continueOnError: z.boolean().default(true),
});

export const productRenderSchema = productRenderInputSchema.superRefine((value, context) => {
  if ((value.modelPath === undefined) === (value.scenePath === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide exactly one modelPath or scenePath." });
  }
  if (value.baseScenePath !== undefined && value.modelPath === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseScenePath requires modelPath.", path: ["baseScenePath"] });
  }
  const importFields = ["centerGeometry", "snapToGround", "adjustCameraLookAt", "adjustEnvironment"] as const;
  if (value.scenePath !== undefined && importFields.some((field) => value[field] !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Import options can only be used with modelPath." });
  }
  if (value.renderMode === "single" && value.outputDir !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "outputDir is only valid for allCameras mode.", path: ["outputDir"] });
  }
  if (value.renderMode === "allCameras" && value.outputPath !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "outputPath is only valid for single mode.", path: ["outputPath"] });
  }
  if ((value.position === undefined) !== (value.lookAt === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide position and lookAt together.", path: ["lookAt"] });
  }
  if (value.up !== undefined && value.position === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "up requires position and lookAt.", path: ["up"] });
  }
  if (value.cameraPresetName !== undefined && value.position !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "cameraPresetName cannot be combined with a custom position." });
  }
  if (value.fieldOfView !== undefined && value.focalLength !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose either fieldOfView or focalLength, not both.", path: ["focalLength"] });
  }
  if (value.environmentName !== undefined && value.environmentPath !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose either environmentName or environmentPath, not both." });
  }
  if (value.samples !== undefined && value.maxTimeSeconds !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose either samples or maxTimeSeconds, not both.", path: ["maxTimeSeconds"] });
  }
});

const setCameraBaseSchema = z.object({
  scenePath: z.string().min(1),
  cameraName: z.string().min(1).optional(),
  position: vector3.optional(),
  lookAt: vector3.optional(),
  up: vector3.optional(),
  distance: z.number().positive().optional(),
  fieldOfView: z.number().gt(0).lt(180).optional(),
  focalLength: z.number().min(5).max(200).optional(),
  outputScenePath: z.string().min(1),
});

export const setCameraSchema = setCameraBaseSchema
  .refine((value) => (value.position === undefined) === (value.lookAt === undefined), {
    message: "Provide position and lookAt together.",
    path: ["lookAt"],
  })
  .refine((value) => !(value.fieldOfView !== undefined && value.focalLength !== undefined), {
    message: "Choose either fieldOfView or focalLength, not both.",
    path: ["focalLength"],
  })
  .refine(
    (value) =>
      value.position !== undefined ||
      value.distance !== undefined ||
      value.fieldOfView !== undefined ||
      value.focalLength !== undefined,
    {
      message: "Provide a camera transform, distance, fieldOfView, or focalLength.",
    },
  );

export const setCameraInputSchema = setCameraBaseSchema;

export const listCameraPresetsSchema = z.object({});

export const applyCameraPresetSchema = z.object({
  scenePath: z.string().min(1),
  presetName: z.string().min(1),
  cameraName: z.string().min(1).optional(),
  outputScenePath: z.string().min(1),
});

export const setEnvironmentSchema = z.object({
  scenePath: z.string().min(1),
  environmentName: z.string().min(1).optional(),
  environmentPath: z.string().min(1).optional(),
  brightness: z.number().positive().optional(),
  rotation: z.number().min(0).lt(360).optional(),
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
