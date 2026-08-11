import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConfig, type ServerConfig } from "./config.js";
import { toolResponse, localFailure } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import { runRenderQueue } from "./queue.js";
import { loadMaterialPresets, findMaterialPreset } from "./presets.js";
import { loadCameraPresets, findCameraPreset } from "./camera-presets.js";
import { prepareProductRenderRequest } from "./product-render.js";
import { VERSION } from "./version.js";
import { applyRenderQuality } from "./quality.js";
import { runKeyShotDiagnostics } from "./diagnostics.js";
import { renderPreview } from "./preview.js";
import {
  applyCameraPresetTool,
  applyMaterialPresetTool,
  applyMaterialTool,
  batchRenderTool,
  importModelTool,
  inspectSceneTool,
  listCameraPresetsTool,
  listCamerasTool,
  listMaterialPresetsTool,
  previewRenderTool,
  productRenderTool,
  registrationOptions,
  renderAllCamerasTool,
  renderQueueTool,
  renderTool,
  saveSceneTool,
  setCameraTool,
  setEnvironmentTool,
  statusTool,
} from "./tools/catalog.js";
import {
  applyMaterialSchema,
  applyMaterialPresetSchema,
  batchRenderInputSchema,
  productRenderSchema,
  renderQueueInputSchema,
  renderAllCamerasInputSchema,
  renderInputSchema,
  scenePathSchema,
  setCameraSchema,
} from "./schemas.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createKeyShotServer(
  config: ServerConfig = getConfig(),
): McpServer {
  const server = new McpServer({
    name: "keyshot-mcp",
    version: VERSION,
  });

  server.registerResource(
    "keyshot-workflow",
    "keyshot://workflow",
    {
      title: "KeyShot MCP Workflow",
      description:
        "How this MCP server connects AI agents to KeyShot headless scripting.",
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
      description:
        "Create a practical prompt for rendering or batch-rendering a KeyShot product scene.",
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
              args.goal
                ? `Goal: ${args.goal}`
                : "Inspect the scene and choose a suitable camera.",
              "Recommended workflow: run keyshot_status, inspect the scene, call keyshot_preview_render, describe visible composition/material/lighting issues, ask for confirmation, then call keyshot_product_render for the approved standard or final output.",
              "Use lower-level tools only when individual steps need manual control.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerTool(
    "keyshot_status",
    registrationOptions(statusTool),
    async () => toolResponse(await runKeyShotDiagnostics(config)),
  );

  server.registerTool(
    "keyshot_product_render",
    registrationOptions(productRenderTool),
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
    registrationOptions(inspectSceneTool),
    async (args) =>
      toolResponse(
        await runKeyShotSerialized(config, {
          operation: "inspect_scene",
          ...args,
        }),
      ),
  );

  server.registerTool(
    "keyshot_list_cameras",
    registrationOptions(listCamerasTool),
    async (args) =>
      toolResponse(
        await runKeyShotSerialized(config, {
          operation: "list_cameras",
          ...args,
        }),
      ),
  );

  server.registerTool(
    "keyshot_preview_render",
    registrationOptions(previewRenderTool),
    async (args) => renderPreview(config, args),
  );

  server.registerTool(
    "keyshot_render",
    registrationOptions(renderTool),
    async (args) => {
      const parsed = renderInputSchema.parse(args);
      return toolResponse(
        await runKeyShotSerialized(config, {
          operation: "render",
          ...applyRenderQuality(parsed),
        }),
      );
    },
  );

  server.registerTool(
    "keyshot_render_queue",
    registrationOptions(renderQueueTool),
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
    registrationOptions(batchRenderTool),
    async (args) => {
      const parsed = batchRenderInputSchema.parse(args);
      return toolResponse(
        await runKeyShotSerialized(config, {
          operation: "batch_render",
          ...applyRenderQuality(parsed),
        }),
      );
    },
  );

  server.registerTool(
    "keyshot_render_all_cameras",
    registrationOptions(renderAllCamerasTool),
    async (args) => {
      const parsed = renderAllCamerasInputSchema.parse(args);
      return toolResponse(
        await runKeyShotSerialized(config, {
          operation: "render_all_cameras",
          ...applyRenderQuality(parsed),
        }),
      );
    },
  );

  server.registerTool(
    "keyshot_import_model",
    registrationOptions(importModelTool),
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
    registrationOptions(applyMaterialTool),
    async (args) => {
      const parsed = applyMaterialSchema.parse(args);
      return toolResponse(
        await runKeyShotSerialized(config, {
          operation: "apply_material",
          ...parsed,
        }),
      );
    },
  );

  server.registerTool(
    "keyshot_list_material_presets",
    registrationOptions(listMaterialPresetsTool),
    async () => {
      try {
        const presets = await loadMaterialPresets(config);
        return toolResponse({
          ok: true,
          data: {
            presets,
            count: presets.length,
            source: config.materialPresetsPath,
          },
          outputFiles: [],
          warnings:
            presets.length === 0
              ? [
                  "No material presets found. Create presets/materials.json to add some.",
                ]
              : [],
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
    registrationOptions(applyMaterialPresetTool),
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
        const available =
          presets.map((entry) => entry.name).join(", ") || "(none)";
        return toolResponse(
          localFailure(
            `Material preset not found: "${parsed.presetName}". Available: ${available}`,
          ),
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
    registrationOptions(setCameraTool),
    async (args) => {
      const parsed = setCameraSchema.parse(args);
      return toolResponse(
        await runKeyShotSerialized(config, {
          operation: "set_camera",
          ...parsed,
        }),
      );
    },
  );

  server.registerTool(
    "keyshot_list_camera_presets",
    registrationOptions(listCameraPresetsTool),
    async () => {
      try {
        const presets = await loadCameraPresets(config);
        return toolResponse({
          ok: true,
          data: {
            presets,
            count: presets.length,
            source: config.cameraPresetsPath,
          },
          outputFiles: [],
          warnings:
            presets.length === 0 ? ["No valid camera presets found."] : [],
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
    registrationOptions(applyCameraPresetTool),
    async (args) => {
      let presets;
      try {
        presets = await loadCameraPresets(config);
      } catch (error) {
        return toolResponse(localFailure(errorMessage(error)));
      }

      const preset = findCameraPreset(presets, args.presetName);
      if (!preset) {
        const available =
          presets.map((entry) => entry.name).join(", ") || "(none)";
        return toolResponse(
          localFailure(
            `Camera preset not found: "${args.presetName}". Available: ${available}`,
          ),
        );
      }

      const request =
        preset.type === "standard"
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
        result.data = {
          presetName: preset.name,
          presetType: preset.type,
          ...result.data,
        };
      }
      return toolResponse(result);
    },
  );

  server.registerTool(
    "keyshot_set_environment",
    registrationOptions(setEnvironmentTool),
    async (args) =>
      toolResponse(
        await runKeyShotSerialized(config, {
          operation: "set_environment",
          ...args,
        }),
      ),
  );

  server.registerTool(
    "keyshot_save_scene",
    registrationOptions(saveSceneTool),
    async (args) =>
      toolResponse(
        await runKeyShotSerialized(config, {
          operation: "save_scene",
          ...args,
        }),
      ),
  );

  return server;
}
