#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { toolResponse, localFailure, keyShotResultSchema } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import { runRenderQueue } from "./queue.js";
import { loadMaterialPresets, findMaterialPreset } from "./presets.js";
import { loadCameraPresets, findCameraPreset } from "./camera-presets.js";
import { prepareProductRenderRequest } from "./product-render.js";
import { VERSION } from "./version.js";
import { applyRenderQuality } from "./quality.js";
import { runKeyShotDiagnostics } from "./diagnostics.js";
import {
  applyMaterialSchema,
  applyMaterialInputSchema,
  applyMaterialPresetInputSchema,
  applyMaterialPresetSchema,
  applyCameraPresetSchema,
  batchRenderSchema,
  batchRenderInputSchema,
  importModelSchema,
  listCamerasSchema,
  listMaterialPresetsSchema,
  listCameraPresetsSchema,
  productRenderInputSchema,
  productRenderSchema,
  renderQueueSchema,
  renderQueueInputSchema,
  renderAllCamerasSchema,
  renderAllCamerasInputSchema,
  renderSchema,
  renderInputSchema,
  saveSceneSchema,
  scenePathSchema,
  setCameraInputSchema,
  setCameraSchema,
  setEnvironmentSchema,
} from "./schemas.js";

const config = getConfig();

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const outputWritingAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const server = new McpServer({
  name: "keyshot-mcp",
  version: VERSION,
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

server.registerResource(
  "keyshot-workflow",
  "keyshot://workflow",
  {
    title: "KeyShot MCP Workflow",
    description: "How this MCP server connects AI agents to KeyShot headless scripting.",
    mimeType: "text/plain",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: [
          "KeyShot MCP workflow:",
          "1. The user asks an AI agent to inspect, edit, or render a KeyShot scene.",
          "2. The MCP client sends a structured tool call to this server.",
          "3. This server runs a temporary Python script through KeyShot headless.",
          "4. KeyShot writes images or scene files and returns structured JSON results.",
        ].join("\n"),
      },
    ],
  }),
);

server.registerPrompt(
  "keyshot_product_render",
  {
    title: "Render a KeyShot product scene",
    description: "Create a practical prompt for rendering or batch-rendering a KeyShot product scene.",
    argsSchema: {
      modelPath: scenePathSchema.shape.scenePath.optional(),
      scenePath: scenePathSchema.shape.scenePath.optional(),
      goal: scenePathSchema.shape.scenePath.optional(),
    },
  },
  async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Use KeyShot MCP to prepare a product render.",
            args.modelPath
              ? `Model path: ${args.modelPath}`
              : args.scenePath
                ? `Scene path: ${args.scenePath}`
                : "Ask me for either a model path or a KeyShot scene path first.",
            args.goal ? `Goal: ${args.goal}` : "Inspect the scene, choose a suitable camera, then render a PNG preview.",
            "Call the keyshot_product_render tool for the complete workflow. Use the lower-level tools only when individual steps need manual control.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.registerTool(
  "keyshot_status",
  {
    title: "Check KeyShot MCP status",
    description: "Diagnose the local KeyShot MCP installation before editing or rendering. Checks configuration, output access, presets, bridge files, and a minimal KeyShot headless startup without modifying a user scene.",
    inputSchema: {},
    outputSchema: keyShotResultSchema,
    annotations: readOnlyAnnotations,
  },
  async () => toolResponse(await runKeyShotDiagnostics(config)),
);

server.registerTool(
  "keyshot_product_render",
  {
    title: "Prepare and render a product",
    description: "Use this high-level tool for a complete product workflow in one KeyShot headless process: open a scene or import a model, apply object-specific materials, configure camera and environment, save a scene copy, and render one or all cameras. Prefer lower-level tools only when the individual stages need separate control.",
    inputSchema: productRenderInputSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    try {
      const parsed = productRenderSchema.parse(args);
      const request = await prepareProductRenderRequest(config, parsed);
      return toolResponse(await runKeyShotSerialized(config, request));
    } catch (error) {
      return toolResponse(localFailure(errorMessage(error)));
    }
  },
);

server.registerTool(
  "keyshot_inspect_scene",
  {
    title: "Inspect a KeyShot scene",
    description: "Open an existing KeyShot scene read-only and return scene metadata, objects, cameras, material assignments, model sets, and external references. Use this before targeted material or camera edits when names are unknown.",
    inputSchema: scenePathSchema,
    outputSchema: keyShotResultSchema,
    annotations: readOnlyAnnotations,
  },
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "inspect_scene", ...args })),
);

server.registerTool(
  "keyshot_list_cameras",
  {
    title: "List scene cameras",
    description: "Open a KeyShot scene without saving changes and return its saved camera names. Use this before keyshot_batch_render when only selected views should be rendered; use keyshot_render_all_cameras when no manual selection is needed.",
    inputSchema: listCamerasSchema,
    outputSchema: keyShotResultSchema,
    annotations: readOnlyAnnotations,
  },
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "list_cameras", ...args })),
);

server.registerTool(
  "keyshot_render",
  {
    title: "Render one KeyShot view",
    description: "Render one active or named camera from an existing KeyShot scene to an image file. Use keyshot_batch_render for selected cameras, keyshot_render_all_cameras for every camera, or keyshot_product_render when scene preparation is also required.",
    inputSchema: renderSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = renderInputSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "render", ...applyRenderQuality(parsed) }));
  },
);

server.registerTool(
  "keyshot_render_queue",
  {
    title: "Run a sequential render queue",
    description: "Render multiple independent scene and camera jobs sequentially so KeyShot processes do not compete for a license or output files. Stops after the first failure unless continueOnError is enabled.",
    inputSchema: renderQueueSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = renderQueueInputSchema.parse(args);
    return toolResponse(
      await runRenderQueue(
        config,
        parsed.jobs.map((job) => applyRenderQuality(job)),
        { continueOnError: parsed.continueOnError ?? false },
      ),
    );
  },
);

server.registerTool(
  "keyshot_batch_render",
  {
    title: "Render selected cameras",
    description: "Render an explicit list of saved camera names from one KeyShot scene into an output directory. Use keyshot_list_cameras first when camera names are unknown; use keyshot_render_all_cameras to discover and render every camera automatically.",
    inputSchema: batchRenderSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = batchRenderInputSchema.parse(args);
    return toolResponse(
      await runKeyShotSerialized(config, { operation: "batch_render", ...applyRenderQuality(parsed) }),
    );
  },
);

server.registerTool(
  "keyshot_render_all_cameras",
  {
    title: "Render all scene cameras",
    description: "Discover every saved camera in a KeyShot scene and render each view in one headless process. Safe file names are generated from camera names; duplicate names are numbered and per-camera failures can be reported while remaining views continue.",
    inputSchema: renderAllCamerasSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = renderAllCamerasInputSchema.parse(args);
    return toolResponse(
      await runKeyShotSerialized(config, { operation: "render_all_cameras", ...applyRenderQuality(parsed) }),
    );
  },
);

server.registerTool(
  "keyshot_import_model",
  {
    title: "Import a model into KeyShot",
    description: "Import a supported local model into an empty scene or optional base scene, apply requested import composition options, and save the result to a new scene path. This tool does not render; use keyshot_product_render for an import-to-image workflow.",
    inputSchema: importModelSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) =>
    toolResponse(
      await runKeyShotSerialized(config, {
        operation: "import_model",
        ...args,
      }),
    ),
);

server.registerTool(
  "keyshot_apply_material",
  {
    title: "Apply a KeyShot material",
    description: "Apply one KeyShot library material name or local material file to a specific scene object, then save the edited scene to the requested output path. Use objectPath when duplicate object names exist; use keyshot_apply_material_preset for a configured reusable preset.",
    inputSchema: applyMaterialInputSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = applyMaterialSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "apply_material", ...parsed }));
  },
);

server.registerTool(
  "keyshot_list_material_presets",
  {
    title: "List material presets",
    description: "Read the configured local material preset JSON and return valid preset names and material sources without opening KeyShot or modifying files. Use a returned name with keyshot_apply_material_preset.",
    inputSchema: listMaterialPresetsSchema,
    outputSchema: keyShotResultSchema,
    annotations: readOnlyAnnotations,
  },
  async () => {
    try {
      const presets = await loadMaterialPresets(config);
      return toolResponse({
        ok: true,
        data: { presets, count: presets.length, source: config.materialPresetsPath },
        outputFiles: [],
        warnings: presets.length === 0 ? ["No material presets found. Create presets/materials.json to add some."] : [],
        keyshotStdoutTail: "",
        error: null,
      });
    } catch (error) {
      return toolResponse(localFailure(errorMessage(error)));
    }
  },
);

server.registerTool(
  "keyshot_apply_material_preset",
  {
    title: "Apply a material preset",
    description: "Resolve a named preset from the configured material preset library, apply it to one scene object, and save a new KeyShot scene. List presets first when the name is unknown; use keyshot_apply_material for a direct library name or material file.",
    inputSchema: applyMaterialPresetInputSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = applyMaterialPresetSchema.parse(args);
    let presets;
    try {
      presets = await loadMaterialPresets(config);
    } catch (error) {
      return toolResponse(localFailure(errorMessage(error)));
    }
    const preset = findMaterialPreset(presets, parsed.presetName);
    if (!preset) {
      const available = presets.map((entry) => entry.name).join(", ") || "(none)";
      return toolResponse(
        localFailure(`Material preset not found: "${parsed.presetName}". Available: ${available}`),
      );
    }
    return toolResponse(
      await runKeyShotSerialized(config, {
        operation: "apply_material",
        scenePath: parsed.scenePath,
        objectName: parsed.objectName,
        objectPath: parsed.objectPath,
        materialName: preset.materialName,
        materialPath: preset.materialPath,
        outputScenePath: parsed.outputScenePath,
      }),
    );
  },
);

server.registerTool(
  "keyshot_set_camera",
  {
    title: "Set a KeyShot camera",
    description: "Create or update a named camera using a position and target, distance, field of view, or focal length, then save the edited scene. Position and lookAt must be supplied together; fieldOfView and focalLength select mutually exclusive lens modes.",
    inputSchema: setCameraInputSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    const parsed = setCameraSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "set_camera", ...parsed }));
  },
);

server.registerTool(
  "keyshot_list_camera_presets",
  {
    title: "List camera presets",
    description: "Read the configured camera preset JSON and return valid standard or absolute camera presets without opening KeyShot or modifying files. Use a returned name with keyshot_apply_camera_preset.",
    inputSchema: listCameraPresetsSchema,
    outputSchema: keyShotResultSchema,
    annotations: readOnlyAnnotations,
  },
  async () => {
    try {
      const presets = await loadCameraPresets(config);
      return toolResponse({
        ok: true,
        data: { presets, count: presets.length, source: config.cameraPresetsPath },
        outputFiles: [],
        warnings: presets.length === 0 ? ["No valid camera presets found."] : [],
        keyshotStdoutTail: "",
        error: null,
      });
    } catch (error) {
      return toolResponse(localFailure(errorMessage(error)));
    }
  },
);

server.registerTool(
  "keyshot_apply_camera_preset",
  {
    title: "Apply a camera preset",
    description: "Create or update a saved camera from a configured standard view or absolute camera preset, then save the edited scene. List camera presets first when the name is unknown; use keyshot_set_camera for direct transform or lens control.",
    inputSchema: applyCameraPresetSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => {
    let presets;
    try {
      presets = await loadCameraPresets(config);
    } catch (error) {
      return toolResponse(localFailure(errorMessage(error)));
    }

    const preset = findCameraPreset(presets, args.presetName);
    if (!preset) {
      const available = presets.map((entry) => entry.name).join(", ") || "(none)";
      return toolResponse(
        localFailure(`Camera preset not found: "${args.presetName}". Available: ${available}`),
      );
    }

    const request = preset.type === "standard"
      ? {
          operation: "set_standard_camera" as const,
          scenePath: args.scenePath,
          standardView: preset.standardView,
          cameraName: args.cameraName ?? preset.name,
          outputScenePath: args.outputScenePath,
        }
      : {
          operation: "set_camera" as const,
          scenePath: args.scenePath,
          cameraName: args.cameraName ?? preset.name,
          position: preset.position,
          lookAt: preset.lookAt,
          up: preset.up,
          outputScenePath: args.outputScenePath,
        };

    const result = await runKeyShotSerialized(config, request);
    if (result.data && typeof result.data === "object") {
      result.data = { presetName: preset.name, presetType: preset.type, ...result.data };
    }
    return toolResponse(result);
  },
);

server.registerTool(
  "keyshot_set_environment",
  {
    title: "Set the KeyShot environment",
    description: "Select a KeyShot environment by library name or local file, optionally change brightness and rotation, and save the edited scene. Unsupported environment APIs return a clear error instead of silently ignoring requested changes.",
    inputSchema: setEnvironmentSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "set_environment", ...args })),
);

server.registerTool(
  "keyshot_save_scene",
  {
    title: "Save a KeyShot scene copy",
    description: "Open an existing KeyShot scene and save it to a requested output path inside the configured safe output directory. Use this for an explicit scene copy; editing tools already save their own output scenes.",
    inputSchema: saveSceneSchema,
    outputSchema: keyShotResultSchema,
    annotations: outputWritingAnnotations,
  },
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "save_scene", ...args })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
