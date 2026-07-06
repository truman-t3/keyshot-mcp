#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { toolResponse } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import {
  applyMaterialSchema,
  applyMaterialInputSchema,
  importModelSchema,
  renderSchema,
  saveSceneSchema,
  scenePathSchema,
  setCameraSchema,
  setEnvironmentSchema,
} from "./schemas.js";

const config = getConfig();

const server = new McpServer({
  name: "keyshot-mcp",
  version: "0.1.0",
});

server.tool("keyshot_status", "Check KeyShot headless availability and script startup.", {}, async () =>
  toolResponse(await runKeyShotSerialized(config, { operation: "status" })),
);

server.tool(
  "keyshot_inspect_scene",
  "Open a KeyShot scene and return available objects, cameras, materials and scene metadata.",
  scenePathSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "inspect_scene", ...args })),
);

server.tool(
  "keyshot_render",
  "Render a KeyShot scene to an image file.",
  renderSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "render", ...args })),
);

server.tool(
  "keyshot_import_model",
  "Import a model into an optional base scene and save the resulting scene.",
  importModelSchema.shape,
  async (args) =>
    toolResponse(
      await runKeyShotSerialized(config, {
        operation: "import_model",
        scenePath: args.baseScenePath,
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
  "keyshot_set_camera",
  "Create or update a camera from position/look-at vectors and save the resulting scene.",
  setCameraSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "set_camera", ...args })),
);

server.tool(
  "keyshot_set_environment",
  "Set a scene environment by name or file when supported by KeyShot headless scripting.",
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
