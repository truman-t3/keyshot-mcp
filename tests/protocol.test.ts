import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version.js";
import { TOOL_CATALOG } from "../src/tools/catalog.js";

const serverParameters = {
  command: process.execPath,
  args: [path.resolve("dist/index.js")],
  stderr: "pipe" as const,
};

describe("published stdio entry", () => {
  it("serves the 2026-07-28 protocol, tools, prompts and resources", async () => {
    const client = new Client(
      { name: "keyshot-modern-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    try {
      await client.connect(new StdioClientTransport(serverParameters));
      expect(client.getProtocolEra()).toBe("modern");
      expect(client.getServerVersion()?.version).toBe(VERSION);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        TOOL_CATALOG.map((tool) => tool.name),
      );
      expect(
        tools.tools.every((tool) => tool.outputSchema && tool.annotations),
      ).toBe(true);
      const result = await client.callTool({
        name: "keyshot_list_camera_presets",
        arguments: {},
      });
      expect(result.structuredContent?.ok).toBe(true);
      expect(result.content.some((item) => item.type === "text")).toBe(true);
      const prompt = await client.getPrompt({
        name: "keyshot_product_render",
        arguments: { goal: "Preview only" },
      });
      expect(prompt.messages).toHaveLength(1);
      const resource = await client.readResource({ uri: "keyshot://workflow" });
      expect(resource.contents).toHaveLength(1);
      const failure = await client.callTool({
        name: "keyshot_render",
        arguments: {},
      });
      expect(failure.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 20_000);

  it("keeps SDK v1 clients working with the 2025-11-25 handshake", async () => {
    const client = new LegacyClient({
      name: "keyshot-legacy-test",
      version: "1.0.0",
    });
    try {
      await client.connect(new LegacyTransport(serverParameters));
      expect(client.getServerVersion()?.version).toBe(VERSION);
      expect((await client.listTools()).tools).toHaveLength(19);
      const result = await client.callTool({
        name: "keyshot_list_camera_presets",
        arguments: {},
      });
      expect(result.structuredContent?.ok).toBe(true);
      expect((await client.listPrompts()).prompts).toHaveLength(1);
      expect((await client.listResources()).resources).toHaveLength(1);
    } finally {
      await client.close();
    }
  }, 20_000);
});
