import { z } from "zod";

const optionalPath = (description: string) =>
  z.string().min(1).describe(description).optional();
const requiredPath = (description: string) =>
  z.string().min(1).describe(description);

const imageFormat = z
  .enum(["png", "jpg", "jpeg", "tif", "tiff", "exr"])
  .describe("Output image format. Defaults to PNG when omitted.");
export const qualityPresetSchema = z
  .enum(["preview", "standard", "final"])
  .describe(
    "Render quality preset: preview (960x540, 16 samples), standard (1920x1080, 64 samples), or final (3840x2160, 256 samples).",
  );

const scenePath = requiredPath(
  "Absolute path to an existing KeyShot scene file to open. Input files may be outside the configured output directory.",
);
const outputScenePath = requiredPath(
  "Destination path for the saved KeyShot scene. The path must stay inside KEYSHOT_OUTPUT_DIR unless external outputs are explicitly enabled.",
);
const outputDirectory = requiredPath(
  "Directory for generated render files. Relative paths resolve inside KEYSHOT_OUTPUT_DIR; external paths are rejected by default.",
);
const renderWidth = z
  .number()
  .int()
  .positive()
  .describe(
    "Render width in pixels. Overrides the selected quality preset when provided.",
  )
  .optional();
const renderHeight = z
  .number()
  .int()
  .positive()
  .describe(
    "Render height in pixels. Overrides the selected quality preset when provided.",
  )
  .optional();
const renderSamples = z
  .number()
  .int()
  .positive()
  .describe(
    "Maximum render samples. Cannot be combined with maxTimeSeconds and overrides preset sampling when provided.",
  )
  .optional();
const renderTime = z
  .number()
  .positive()
  .describe(
    "Maximum render time in seconds. Selects time-based rendering and cannot be combined with samples.",
  )
  .optional();

export const scenePathSchema = z.object({
  scenePath,
});

export const listCamerasSchema = z.object({
  scenePath,
});

export const renderSchema = z.object({
  scenePath,
  outputPath: optionalPath(
    "Destination image path. When omitted, a PNG name is generated inside KEYSHOT_OUTPUT_DIR.",
  ),
  width: renderWidth,
  height: renderHeight,
  samples: renderSamples,
  maxTimeSeconds: renderTime,
  camera: z
    .string()
    .min(1)
    .describe(
      "Optional saved camera name to activate before rendering. Omit to use the scene's active camera.",
    )
    .optional(),
  format: imageFormat.optional(),
  qualityPreset: qualityPresetSchema.optional(),
});

export const renderInputSchema = renderSchema.refine(
  (value) =>
    !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

export const previewRenderSchema = z.object({
  scenePath,
  camera: z
    .string()
    .min(1)
    .describe(
      "Optional saved camera name to activate for the preview. Omit to use the scene's active camera.",
    )
    .optional(),
  width: z
    .number()
    .int()
    .min(64)
    .max(1920)
    .describe(
      "Preview width in pixels. Defaults to 960; allowed range is 64 to 1920.",
    )
    .optional(),
  height: z
    .number()
    .int()
    .min(64)
    .max(1080)
    .describe(
      "Preview height in pixels. Defaults to 540; allowed range is 64 to 1080.",
    )
    .optional(),
  samples: z
    .number()
    .int()
    .positive()
    .max(64)
    .describe(
      "Preview render samples. Defaults to 16 unless maxTimeSeconds is provided; maximum is 64.",
    )
    .optional(),
  maxTimeSeconds: z
    .number()
    .positive()
    .max(60)
    .describe(
      "Time-based preview limit in seconds. Replaces the default sample mode and cannot be combined with an explicit samples value; maximum is 60.",
    )
    .optional(),
  outputPath: optionalPath(
    "Optional .png destination inside KEYSHOT_OUTPUT_DIR. Existing files are never overwritten. When omitted, a temporary preview is embedded and deleted.",
  ),
});

export const previewRenderInputSchema = previewRenderSchema.superRefine(
  (value, context) => {
    if (value.samples !== undefined && value.maxTimeSeconds !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either samples or maxTimeSeconds, not both.",
        path: ["maxTimeSeconds"],
      });
    }
    if (
      value.outputPath !== undefined &&
      !value.outputPath.toLowerCase().endsWith(".png")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Preview outputPath must use the .png extension.",
        path: ["outputPath"],
      });
    }
  },
);

export const batchRenderSchema = z.object({
  scenePath,
  outputDir: outputDirectory,
  cameras: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "Saved camera names to render in order. Use keyshot_list_cameras first when names are unknown.",
    ),
  width: renderWidth,
  height: renderHeight,
  samples: renderSamples,
  maxTimeSeconds: renderTime,
  format: imageFormat.optional(),
  qualityPreset: qualityPresetSchema.optional(),
  overwrite: z
    .boolean()
    .describe(
      "Whether existing image files may be replaced. Defaults to false.",
    )
    .optional(),
});

export const batchRenderInputSchema = batchRenderSchema.refine(
  (value) =>
    !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

export const renderAllCamerasSchema = z.object({
  scenePath,
  outputDir: outputDirectory,
  width: renderWidth,
  height: renderHeight,
  samples: renderSamples,
  maxTimeSeconds: renderTime,
  format: imageFormat.optional(),
  qualityPreset: qualityPresetSchema.optional(),
  overwrite: z
    .boolean()
    .describe(
      "Whether existing image files may be replaced. Defaults to false.",
    )
    .optional(),
  continueOnError: z
    .boolean()
    .describe(
      "Continue rendering remaining cameras after one camera fails. Defaults to true.",
    )
    .default(true),
});

export const renderAllCamerasInputSchema = renderAllCamerasSchema.refine(
  (value) =>
    !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

export const importModelSchema = z.object({
  modelPath: requiredPath(
    "Absolute path to a model file supported by KeyShot, such as OBJ, FBX, STL, or glTF.",
  ),
  baseScenePath: optionalPath(
    "Optional existing KeyShot scene to use as the import base. Omit to start from an empty scene.",
  ),
  outputScenePath,
  centerGeometry: z
    .boolean()
    .describe(
      "Ask KeyShot to center imported geometry during import when supported.",
    )
    .optional(),
  snapToGround: z
    .boolean()
    .describe(
      "Ask KeyShot to place imported geometry on the ground plane when supported.",
    )
    .optional(),
  adjustCameraLookAt: z
    .boolean()
    .describe(
      "Ask KeyShot to retarget the active camera to the imported geometry when supported.",
    )
    .optional(),
  adjustEnvironment: z
    .boolean()
    .describe(
      "Ask KeyShot to adjust the environment to the imported geometry when supported.",
    )
    .optional(),
});

export const applyMaterialInputSchema = z.object({
  scenePath,
  objectName: z
    .string()
    .min(1)
    .describe(
      "Scene object name to modify. Provide either objectName or the more specific objectPath.",
    )
    .optional(),
  objectPath: z
    .string()
    .min(1)
    .describe(
      "Full scene-tree path of the object to modify. Use this instead of objectName when names are duplicated.",
    )
    .optional(),
  materialName: z
    .string()
    .min(1)
    .describe(
      "Material name from the local KeyShot library. Provide either materialName or materialPath.",
    )
    .optional(),
  materialPath: optionalPath(
    "Absolute path to a local KeyShot material file. Provide either materialPath or materialName.",
  ),
  outputScenePath,
});

export const applyMaterialSchema = applyMaterialInputSchema
  .refine((value) => value.objectName || value.objectPath, {
    message: "Provide objectName or objectPath.",
  })
  .refine((value) => value.materialName || value.materialPath, {
    message: "Provide materialName or materialPath.",
  });

const vector3 = z
  .tuple([z.number(), z.number(), z.number()])
  .describe("Three-number [x, y, z] vector in KeyShot scene coordinates.");

export const productMaterialAssignmentSchema = z
  .object({
    objectName: z
      .string()
      .min(1)
      .describe(
        "Target object name. Choose exactly one objectName or objectPath.",
      )
      .optional(),
    objectPath: z
      .string()
      .min(1)
      .describe(
        "Target object's full scene-tree path. Choose exactly one objectPath or objectName.",
      )
      .optional(),
    presetName: z
      .string()
      .min(1)
      .describe(
        "Material preset name from the configured preset library. Choose one material source.",
      )
      .optional(),
    materialName: z
      .string()
      .min(1)
      .describe(
        "Material name from the KeyShot library. Choose one material source.",
      )
      .optional(),
    materialPath: optionalPath(
      "Absolute path to a local KeyShot material file. Choose one material source.",
    ),
  })
  .superRefine((value, context) => {
    const targets = [value.objectName, value.objectPath].filter(
      (item) => item !== undefined,
    );
    const materials = [
      value.presetName,
      value.materialName,
      value.materialPath,
    ].filter((item) => item !== undefined);
    if (targets.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose exactly one objectName or objectPath.",
      });
    }
    if (materials.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Choose exactly one presetName, materialName, or materialPath.",
      });
    }
  });

export const productRenderInputSchema = z.object({
  modelPath: optionalPath(
    "Absolute path to a model to import. Provide exactly one modelPath or scenePath.",
  ),
  scenePath: optionalPath(
    "Absolute path to an existing KeyShot scene. Provide exactly one scenePath or modelPath.",
  ),
  baseScenePath: optionalPath(
    "Optional KeyShot base scene used only when modelPath is provided.",
  ),
  outputScenePath: optionalPath(
    "Destination for the prepared scene. A safe numbered name is generated when omitted.",
  ),
  renderMode: z
    .enum(["single", "allCameras"])
    .describe(
      "Render one active or named camera, or discover and render every saved camera. Defaults to single.",
    )
    .default("single"),
  outputPath: optionalPath(
    "Single-mode image destination. Invalid with allCameras mode; a safe name is generated when omitted.",
  ),
  outputDir: optionalPath(
    "All-cameras output directory. Invalid with single mode; a safe directory is generated when omitted.",
  ),
  centerGeometry: z
    .boolean()
    .describe(
      "Center imported geometry. Applies only to modelPath sources and defaults to true for new models.",
    )
    .optional(),
  snapToGround: z
    .boolean()
    .describe(
      "Place imported geometry on the ground. Applies only to modelPath sources and defaults to true for new models.",
    )
    .optional(),
  adjustCameraLookAt: z
    .boolean()
    .describe(
      "Retarget the camera after model import. Applies only to modelPath sources and defaults to true for new models.",
    )
    .optional(),
  adjustEnvironment: z
    .boolean()
    .describe(
      "Adjust the environment after model import. Applies only to modelPath sources and defaults to true for new models.",
    )
    .optional(),
  materialAssignments: z
    .array(productMaterialAssignmentSchema)
    .describe(
      "Object-specific material changes applied before camera and environment setup.",
    )
    .optional(),
  cameraPresetName: z
    .string()
    .min(1)
    .describe(
      "Configured camera preset to apply. Cannot be combined with a custom position/lookAt pair.",
    )
    .optional(),
  cameraName: z
    .string()
    .min(1)
    .describe(
      "Camera to create, update, or activate. New model workflows default to Product Hero.",
    )
    .optional(),
  position: vector3
    .describe(
      "Camera position [x, y, z]. Must be provided together with lookAt.",
    )
    .optional(),
  lookAt: vector3
    .describe(
      "Camera target [x, y, z]. Must be provided together with position.",
    )
    .optional(),
  up: vector3
    .describe(
      "Optional camera up direction [x, y, z]. Requires position and lookAt.",
    )
    .optional(),
  distance: z
    .number()
    .positive()
    .describe(
      "Positive KeyShot camera distance applied after the transform or preset.",
    )
    .optional(),
  fieldOfView: z
    .number()
    .gt(0)
    .lt(180)
    .describe(
      "Camera field of view in degrees, greater than 0 and less than 180. Cannot be combined with focalLength.",
    )
    .optional(),
  focalLength: z
    .number()
    .min(5)
    .max(200)
    .describe(
      "Camera focal length from 5 to 200 mm. Cannot be combined with fieldOfView.",
    )
    .optional(),
  environmentName: z
    .string()
    .min(1)
    .describe(
      "Environment name from the KeyShot library. Cannot be combined with environmentPath.",
    )
    .optional(),
  environmentPath: optionalPath(
    "Absolute path to a local KeyShot environment file. Cannot be combined with environmentName.",
  ),
  brightness: z
    .number()
    .positive()
    .describe("Positive brightness multiplier for the active environment.")
    .optional(),
  rotation: z
    .number()
    .min(0)
    .lt(360)
    .describe(
      "Environment rotation in degrees, from 0 inclusive to 360 exclusive.",
    )
    .optional(),
  width: renderWidth,
  height: renderHeight,
  samples: renderSamples,
  maxTimeSeconds: renderTime,
  format: imageFormat.optional(),
  qualityPreset: qualityPresetSchema.optional(),
  overwrite: z
    .boolean()
    .describe(
      "Allow replacement of explicitly selected output files. Defaults to false.",
    )
    .default(false),
  continueOnError: z
    .boolean()
    .describe(
      "In allCameras mode, continue after one camera fails. Defaults to true.",
    )
    .default(true),
});

export const productRenderSchema = productRenderInputSchema.superRefine(
  (value, context) => {
    if ((value.modelPath === undefined) === (value.scenePath === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one modelPath or scenePath.",
      });
    }
    if (value.baseScenePath !== undefined && value.modelPath === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "baseScenePath requires modelPath.",
        path: ["baseScenePath"],
      });
    }
    const importFields = [
      "centerGeometry",
      "snapToGround",
      "adjustCameraLookAt",
      "adjustEnvironment",
    ] as const;
    if (
      value.scenePath !== undefined &&
      importFields.some((field) => value[field] !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Import options can only be used with modelPath.",
      });
    }
    if (value.renderMode === "single" && value.outputDir !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "outputDir is only valid for allCameras mode.",
        path: ["outputDir"],
      });
    }
    if (value.renderMode === "allCameras" && value.outputPath !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "outputPath is only valid for single mode.",
        path: ["outputPath"],
      });
    }
    if ((value.position === undefined) !== (value.lookAt === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide position and lookAt together.",
        path: ["lookAt"],
      });
    }
    if (value.up !== undefined && value.position === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "up requires position and lookAt.",
        path: ["up"],
      });
    }
    if (value.cameraPresetName !== undefined && value.position !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cameraPresetName cannot be combined with a custom position.",
      });
    }
    if (value.fieldOfView !== undefined && value.focalLength !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either fieldOfView or focalLength, not both.",
        path: ["focalLength"],
      });
    }
    if (
      value.environmentName !== undefined &&
      value.environmentPath !== undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either environmentName or environmentPath, not both.",
      });
    }
    if (value.samples !== undefined && value.maxTimeSeconds !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either samples or maxTimeSeconds, not both.",
        path: ["maxTimeSeconds"],
      });
    }
  },
);

const setCameraBaseSchema = z.object({
  scenePath,
  cameraName: z
    .string()
    .min(1)
    .describe(
      "Saved camera to update, or the name to use when creating a camera.",
    )
    .optional(),
  position: vector3
    .describe(
      "Camera position [x, y, z]. Must be provided together with lookAt.",
    )
    .optional(),
  lookAt: vector3
    .describe(
      "Camera target [x, y, z]. Must be provided together with position.",
    )
    .optional(),
  up: vector3
    .describe(
      "Optional camera up direction [x, y, z]. Requires position and lookAt.",
    )
    .optional(),
  distance: z
    .number()
    .positive()
    .describe("Positive KeyShot camera distance.")
    .optional(),
  fieldOfView: z
    .number()
    .gt(0)
    .lt(180)
    .describe(
      "Field of view in degrees, greater than 0 and less than 180. Cannot be combined with focalLength.",
    )
    .optional(),
  focalLength: z
    .number()
    .min(5)
    .max(200)
    .describe(
      "Focal length from 5 to 200 mm. Cannot be combined with fieldOfView.",
    )
    .optional(),
  outputScenePath,
});

export const setCameraSchema = setCameraBaseSchema
  .refine(
    (value) => (value.position === undefined) === (value.lookAt === undefined),
    {
      message: "Provide position and lookAt together.",
      path: ["lookAt"],
    },
  )
  .refine(
    (value) =>
      !(value.fieldOfView !== undefined && value.focalLength !== undefined),
    {
      message: "Choose either fieldOfView or focalLength, not both.",
      path: ["focalLength"],
    },
  )
  .refine(
    (value) =>
      value.position !== undefined ||
      value.distance !== undefined ||
      value.fieldOfView !== undefined ||
      value.focalLength !== undefined,
    {
      message:
        "Provide a camera transform, distance, fieldOfView, or focalLength.",
    },
  );

export const setCameraInputSchema = setCameraBaseSchema;

export const listCameraPresetsSchema = z.object({});

export const applyCameraPresetSchema = z.object({
  scenePath,
  presetName: z
    .string()
    .min(1)
    .describe(
      "Case-insensitive camera preset name returned by keyshot_list_camera_presets.",
    ),
  cameraName: z
    .string()
    .min(1)
    .describe("Optional saved camera name. Defaults to the preset name.")
    .optional(),
  outputScenePath,
});

export const setEnvironmentSchema = z.object({
  scenePath,
  environmentName: z
    .string()
    .min(1)
    .describe(
      "Environment name from the KeyShot library. Cannot be combined with environmentPath.",
    )
    .optional(),
  environmentPath: optionalPath(
    "Absolute path to a local KeyShot environment file. Cannot be combined with environmentName.",
  ),
  brightness: z
    .number()
    .positive()
    .describe("Positive brightness multiplier for the active environment.")
    .optional(),
  rotation: z
    .number()
    .min(0)
    .lt(360)
    .describe(
      "Environment rotation in degrees, from 0 inclusive to 360 exclusive.",
    )
    .optional(),
  outputScenePath,
});

export const saveSceneSchema = z.object({
  scenePath,
  outputScenePath,
});

// --- Render queue ---
export const renderJobSchema = z.object({
  scenePath,
  outputPath: optionalPath(
    "Destination image path for this queue job. A safe output name is generated when omitted.",
  ),
  camera: z
    .string()
    .min(1)
    .describe(
      "Optional saved camera name for this job. Omit to use the active camera.",
    )
    .optional(),
  width: renderWidth,
  height: renderHeight,
  samples: renderSamples,
  maxTimeSeconds: renderTime,
  format: imageFormat.optional(),
  qualityPreset: qualityPresetSchema.optional(),
});

export const renderJobInputSchema = renderJobSchema.refine(
  (value) =>
    !(value.samples !== undefined && value.maxTimeSeconds !== undefined),
  {
    message: "Choose either samples or maxTimeSeconds, not both.",
    path: ["maxTimeSeconds"],
  },
);

export const renderQueueSchema = z.object({
  jobs: z
    .array(renderJobSchema)
    .min(1)
    .describe(
      "Render jobs executed sequentially to avoid KeyShot license and output conflicts.",
    ),
  continueOnError: z
    .boolean()
    .describe("Continue with later jobs after a failure. Defaults to false.")
    .optional(),
});

export const renderQueueInputSchema = z.object({
  jobs: z
    .array(renderJobInputSchema)
    .min(1)
    .describe("Validated render jobs executed sequentially."),
  continueOnError: z
    .boolean()
    .describe("Continue with later jobs after a failure. Defaults to false.")
    .optional(),
});

// --- Material preset library ---
export const listMaterialPresetsSchema = z.object({});

export const applyMaterialPresetInputSchema = z.object({
  scenePath,
  presetName: z
    .string()
    .min(1)
    .describe(
      "Case-insensitive material preset name returned by keyshot_list_material_presets.",
    ),
  objectName: z
    .string()
    .min(1)
    .describe(
      "Scene object name to modify. Provide either objectName or objectPath.",
    )
    .optional(),
  objectPath: z
    .string()
    .min(1)
    .describe(
      "Full scene-tree path to modify. Prefer this when object names are duplicated.",
    )
    .optional(),
  outputScenePath,
});

export const applyMaterialPresetSchema = applyMaterialPresetInputSchema.refine(
  (value) => value.objectName || value.objectPath,
  { message: "Provide objectName or objectPath." },
);
