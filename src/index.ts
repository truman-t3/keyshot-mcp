#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { toolResponse } from "./result.js";
import { runKeyShotSerialized } from "./runner.js";
import {
  applyMaterialSchema,
  applyMaterialInputSchema,
  batchRenderSchema,
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
  version: "0.2.1",
});

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
            args.scenePath ? `Scene path: ${args.scenePath}` : "Ask me for the KeyShot scene path first.",
            args.goal ? `Goal: ${args.goal}` : "Inspect the scene, choose a suitable camera, then render a PNG preview.",
            "Start with keyshot_status, then keyshot_inspect_scene, then render or batch render as needed.",
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
  "keyshot_batch_render",
  "Render multiple named cameras from one KeyShot scene into an output directory.",
  batchRenderSchema.shape,
  async (args) => toolResponse(await runKeyShotSerialized(config, { operation: "batch_render", ...args })),
);

server.tool(
  "keyshot_import_model",
  "Import a model into an optional base scene and save the resulting scene.",
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
