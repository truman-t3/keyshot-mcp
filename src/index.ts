#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { toolResponse, localFailure } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import { runRenderQueue } from "./queue.js";
import { loadMaterialPresets, findMaterialPreset } from "./presets.js";
import { loadCameraPresets, findCameraPreset } from "./camera-presets.js";
import { prepareProductRenderRequest } from "./product-render.js";
import { VERSION } from "./version.js";
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

server.tool("keyshot_status", "Check KeyShot headless availability and script startup.", {}, async () =>
  toolResponse(await runKeyShotSerialized(config, { operation: "status" })),
);

server.tool(
  "keyshot_product_render",
  "Prepare and render a product from either a model file or an existing KeyShot scene in one headless process.",
  productRenderInputSchema.shape,
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

server.tool(
  "keyshot_inspect_scene",
  "Open a KeyShot scene and return available objects, cameras, materials and scene metadata.",
  scenePathSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "inspect_scene", ...args })),
);

server.tool(
  "keyshot_list_cameras",
  "Open a KeyShot scene and return the list of available camera names (useful before batch rendering).",
  listCamerasSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "list_cameras", ...args })),
);

server.tool(
  "keyshot_render",
  "Render a KeyShot scene to an image file.",
  renderSchema.shape,
  async (args) => {
    const parsed = renderInputSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "render", ...parsed }));
  },
);

server.tool(
  "keyshot_render_queue",
  "Render several jobs sequentially. Stops at the first failure unless continueOnError is set.",
  renderQueueSchema.shape,
  async (args) => {
    const parsed = renderQueueInputSchema.parse(args);
    return toolResponse(
      await runRenderQueue(config, parsed.jobs, { continueOnError: parsed.continueOnError ?? false }),
    );
  },
);

server.tool(
  "keyshot_batch_render",
  "Render multiple named cameras from one KeyShot scene into an output directory.",
  batchRenderSchema.shape,
  async (args) => {
    const parsed = batchRenderInputSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "batch_render", ...parsed }));
  },
);

server.tool(
  "keyshot_render_all_cameras",
  "Discover every camera in one KeyShot scene and render each view into an output directory.",
  renderAllCamerasSchema.shape,
  async (args) => {
    const parsed = renderAllCamerasInputSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "render_all_cameras", ...parsed }));
  },
);

server.tool(
  "keyshot_import_model",
  "Import a model into an optional base scene, optionally center and ground it, adjust the camera or environment, and save the resulting scene.",
  importModelSchema.shape,
  async (args) =>
    toolResponse(
      await runKeyShotSerialized(config, {
        operation: "import_model",
        ...args,
      }),
    ),
);

server.tool(
  "keyshot_apply_material",
  "Apply a material by name or material file to a scene object and save the resulting scene.",
  applyMaterialInputSchema.shape,
  async (args) => {
    const parsed = applyMaterialSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "apply_material", ...parsed }));
  },
);

server.tool(
  "keyshot_list_material_presets",
  "List material presets from the local preset library (presets/materials.json or KEYSHOT_MATERIAL_PRESETS).",
  listMaterialPresetsSchema.shape,
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

server.tool(
  "keyshot_apply_material_preset",
  "Apply a named material preset (from the preset library) to a scene object and save the resulting scene.",
  applyMaterialPresetInputSchema.shape,
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

server.tool(
  "keyshot_set_camera",
  "Create or update a camera transform, distance, field of view, or focal length and save the resulting scene.",
  setCameraInputSchema.shape,
  async (args) => {
    const parsed = setCameraSchema.parse(args);
    return toolResponse(await runKeyShotSerialized(config, { operation: "set_camera", ...parsed }));
  },
);

server.tool(
  "keyshot_list_camera_presets",
  "List standard and custom camera presets from presets/cameras.json or KEYSHOT_CAMERA_PRESETS.",
  listCameraPresetsSchema.shape,
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

server.tool(
  "keyshot_apply_camera_preset",
  "Create or update a named camera from a standard or custom camera preset and save the scene.",
  applyCameraPresetSchema.shape,
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

server.tool(
  "keyshot_set_environment",
  "Set a scene environment by name or file, brightness, or rotation when supported by KeyShot headless scripting.",
  setEnvironmentSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "set_environment", ...args })),
);

server.tool(
  "keyshot_save_scene",
  "Save a KeyShot scene to a new path.",
  saveSceneSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "save_scene", ...args })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
