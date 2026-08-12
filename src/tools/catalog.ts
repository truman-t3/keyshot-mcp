import type { z } from "zod";
import { keyShotResultSchema } from "../result.js";
import {
  applyCameraPresetSchema,
  applyMaterialInputSchema,
  applyMaterialPresetInputSchema,
  batchRenderSchema,
  importModelSchema,
  listCameraPresetsSchema,
  listCamerasSchema,
  listMaterialPresetsSchema,
  previewRenderSchema,
  productRenderInputSchema,
  renderAllCamerasSchema,
  renderQueueSchema,
  renderSchema,
  saveSceneSchema,
  scenePathSchema,
  setCameraInputSchema,
  setEnvironmentSchema,
  syncSavedSceneSchema,
} from "../schemas.js";

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const outputWritingAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export type ToolGroup =
  | "Diagnostics"
  | "Inspection"
  | "Rendering"
  | "Scene editing"
  | "Materials"
  | "Cameras";

export type ToolCatalogEntry = {
  name: string;
  group: ToolGroup;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  outputSchema: typeof keyShotResultSchema;
  annotations: typeof readOnlyAnnotations | typeof outputWritingAnnotations;
};

function defineTool<T extends ToolCatalogEntry>(definition: T): T {
  return definition;
}

const readOnly = readOnlyAnnotations;
const writesOutput = outputWritingAnnotations;

export const statusTool = defineTool({
  name: "keyshot_status",
  group: "Diagnostics",
  title: "Check KeyShot MCP status",
  description:
    "Diagnose the local installation, output access, presets, bridge files, and a minimal KeyShot headless startup without modifying a user scene.",
  inputSchema: scenePathSchema.pick({}),
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const productRenderTool = defineTool({
  name: "keyshot_product_render",
  group: "Rendering",
  title: "Prepare and render a product",
  description:
    "Run a complete product workflow in one headless process: open or import, assign materials, configure camera and environment, save a scene copy, and render one or all cameras.",
  inputSchema: productRenderInputSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const inspectSceneTool = defineTool({
  name: "keyshot_inspect_scene",
  group: "Inspection",
  title: "Inspect a KeyShot scene",
  description:
    "Open a scene read-only and return metadata, objects, cameras, material assignments, model sets, and external references.",
  inputSchema: scenePathSchema,
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const listCamerasTool = defineTool({
  name: "keyshot_list_cameras",
  group: "Inspection",
  title: "List scene cameras",
  description:
    "Return saved camera names without saving changes. Use this before selected-camera rendering when names are unknown.",
  inputSchema: listCamerasSchema,
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const previewRenderTool = defineTool({
  name: "keyshot_preview_render",
  group: "Rendering",
  title: "Render an Agent-visible preview",
  description:
    "Render a bounded PNG preview from an existing scene and return it directly as MCP image content. Temporary previews are deleted after embedding; an optional safe output path preserves a copy.",
  inputSchema: previewRenderSchema,
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const syncSavedSceneTool = defineTool({
  name: "keyshot_sync_saved_scene",
  group: "Inspection",
  title: "Sync the latest saved KeyShot scene",
  description:
    "Find a saved .bip file (or the newest .bip in one folder), detect whether it changed, copy it to a collision-safe output path, and optionally return an Agent-visible preview. This is the stable alternative to unsupported persistent GUI control.",
  inputSchema: syncSavedSceneSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const renderTool = defineTool({
  name: "keyshot_render",
  group: "Rendering",
  title: "Render one KeyShot view",
  description:
    "Render the active or a named camera from an existing scene to an image file.",
  inputSchema: renderSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const renderQueueTool = defineTool({
  name: "keyshot_render_queue",
  group: "Rendering",
  title: "Run a sequential render queue",
  description:
    "Render independent scene and camera jobs sequentially so KeyShot processes do not compete for a license or output files.",
  inputSchema: renderQueueSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const batchRenderTool = defineTool({
  name: "keyshot_batch_render",
  group: "Rendering",
  title: "Render selected cameras",
  description:
    "Render an explicit list of saved cameras from one scene into an output directory.",
  inputSchema: batchRenderSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const renderAllCamerasTool = defineTool({
  name: "keyshot_render_all_cameras",
  group: "Rendering",
  title: "Render all scene cameras",
  description:
    "Discover every saved camera and render each view in one headless process with collision-safe file names and per-camera results.",
  inputSchema: renderAllCamerasSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const importModelTool = defineTool({
  name: "keyshot_import_model",
  group: "Scene editing",
  title: "Import a model into KeyShot",
  description:
    "Import a supported local model into an empty or base scene, apply requested composition options, and save a new scene.",
  inputSchema: importModelSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const applyMaterialTool = defineTool({
  name: "keyshot_apply_material",
  group: "Materials",
  title: "Apply a KeyShot material",
  description:
    "Apply a KeyShot library material or local material file to a specific object, then save the edited scene.",
  inputSchema: applyMaterialInputSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const listMaterialPresetsTool = defineTool({
  name: "keyshot_list_material_presets",
  group: "Materials",
  title: "List material presets",
  description:
    "Read the configured local material preset JSON and return valid preset names and material sources without opening KeyShot.",
  inputSchema: listMaterialPresetsSchema,
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const applyMaterialPresetTool = defineTool({
  name: "keyshot_apply_material_preset",
  group: "Materials",
  title: "Apply a material preset",
  description:
    "Resolve a configured material preset, apply it to one scene object, and save a new scene.",
  inputSchema: applyMaterialPresetInputSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const setCameraTool = defineTool({
  name: "keyshot_set_camera",
  group: "Cameras",
  title: "Set a KeyShot camera",
  description:
    "Create or update a named camera using position, target, distance, field of view, or focal length, then save the edited scene.",
  inputSchema: setCameraInputSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const listCameraPresetsTool = defineTool({
  name: "keyshot_list_camera_presets",
  group: "Cameras",
  title: "List camera presets",
  description:
    "Read the configured camera preset JSON and return valid standard or absolute camera presets without opening KeyShot.",
  inputSchema: listCameraPresetsSchema,
  outputSchema: keyShotResultSchema,
  annotations: readOnly,
});

export const applyCameraPresetTool = defineTool({
  name: "keyshot_apply_camera_preset",
  group: "Cameras",
  title: "Apply a camera preset",
  description:
    "Create or update a saved camera from a configured standard-view or absolute camera preset, then save the edited scene.",
  inputSchema: applyCameraPresetSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const setEnvironmentTool = defineTool({
  name: "keyshot_set_environment",
  group: "Scene editing",
  title: "Set the KeyShot environment",
  description:
    "Select an environment by library name or local file, optionally change brightness and rotation, and save the edited scene.",
  inputSchema: setEnvironmentSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const saveSceneTool = defineTool({
  name: "keyshot_save_scene",
  group: "Scene editing",
  title: "Save a KeyShot scene copy",
  description:
    "Open an existing scene and save a copy to a requested path inside the configured safe output directory.",
  inputSchema: saveSceneSchema,
  outputSchema: keyShotResultSchema,
  annotations: writesOutput,
});

export const TOOL_CATALOG = [
  statusTool,
  productRenderTool,
  inspectSceneTool,
  listCamerasTool,
  previewRenderTool,
  syncSavedSceneTool,
  renderTool,
  renderQueueTool,
  batchRenderTool,
  renderAllCamerasTool,
  importModelTool,
  applyMaterialTool,
  listMaterialPresetsTool,
  applyMaterialPresetTool,
  setCameraTool,
  listCameraPresetsTool,
  applyCameraPresetTool,
  setEnvironmentTool,
  saveSceneTool,
] as const;

export function registrationOptions(tool: ToolCatalogEntry) {
  return {
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  };
}
