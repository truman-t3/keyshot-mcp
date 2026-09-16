import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../src/config.js";
import { createKeyShotServer } from "../src/server.js";
import { TOOL_CATALOG } from "../src/tools/catalog.js";

const connections: Array<{
  client: Client;
  server: ReturnType<typeof createKeyShotServer>;
}> = [];

afterEach(async () => {
  await Promise.all(
    connections.splice(0).map(async ({ client, server }) => {
      await client.close();
      await server.close();
    }),
  );
});

describe("MCP tool registration", () => {
  it("serves product prompts for model, scene, and missing-source requests", async () => {
    const server = createKeyShotServer(testConfig());
    const client = new Client({ name: "keyshot-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    connections.push({ client, server });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    for (const args of [
      { modelPath: "C:/fixtures/cube.obj", goal: "Preview only" },
      { scenePath: "C:/fixtures/cube.bip" },
      {},
    ]) {
      const response = await client.getPrompt({
        name: "keyshot_product_render",
        arguments: args,
      });
      expect(response.messages).toHaveLength(1);
      const content = response.messages[0].content;
      expect(content.type).toBe("text");
      if (content.type !== "text") throw new Error("Expected prompt text");
      expect(content.text).toContain(
        args.modelPath ?? args.scenePath ?? "Ask me for either",
      );
      expect(content.text.indexOf("keyshot_import_model")).toBeLessThan(
        content.text.indexOf("keyshot_preview_render"),
      );
      expect(content.text).toContain("preview the returned scene path again");
      if (args.goal) expect(content.text).toContain(args.goal);
    }
  });

  it("lists all 19 public tools through the MCP protocol", async () => {
    const server = createKeyShotServer(testConfig());
    const client = new Client({ name: "keyshot-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    connections.push({ client, server });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const response = await client.listTools();
    expect(response.tools.map((tool) => tool.name)).toEqual(
      TOOL_CATALOG.map((tool) => tool.name),
    );
    expect(response.tools).toHaveLength(19);

    for (const tool of response.tools) {
      expect(tool.title).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema?.type).toBe("object");
      expect(tool.annotations).toBeTruthy();
    }
  });

  it("marks preview rendering as read-only and non-destructive", async () => {
    const server = createKeyShotServer(testConfig());
    const client = new Client({ name: "keyshot-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    connections.push({ client, server });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const preview = (await client.listTools()).tools.find(
      (tool) => tool.name === "keyshot_preview_render",
    );
    expect(preview?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});

function testConfig(): ServerConfig {
  return {
    projectRoot: process.cwd(),
    keyshotHeadlessExe: "keyshot_headless.exe",
    keyshotOutputDir: process.cwd(),
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1_000,
    tmpDir: process.cwd(),
    bridgeScriptPath: "scripts/keyshot_bridge.py",
    materialPresetsPath: "presets/materials.json",
    cameraPresetsPath: "presets/cameras.json",
  };
}
