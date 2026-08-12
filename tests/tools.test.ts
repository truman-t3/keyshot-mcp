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
