import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../src/config.js";
import type { KeyShotRequest } from "../src/types.js";
import { createKeyShotServer } from "../src/server.js";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../src/runner.js", () => ({ runKeyShotSerialized: run }));

let root: string;
let config: ServerConfig;
let client: Client;
let server: ReturnType<typeof createKeyShotServer>;

beforeEach(async () => {
  run.mockReset();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "keyshot-preset-tool-"));
  const materialPresetsPath = path.join(root, "materials.json");
  await fs.writeFile(
    materialPresetsPath,
    JSON.stringify({
      "Matte Black Plastic": { materialName: "Soft Rough Black" },
    }),
  );
  config = {
    projectRoot: root,
    keyshotHeadlessExe: "keyshot_headless.exe",
    keyshotOutputDir: root,
    keyshotAllowExternalOutputs: false,
    keyshotLicenseArgs: [],
    keyshotTimeoutMs: 1000,
    tmpDir: root,
    bridgeScriptPath: "scripts/keyshot_bridge.py",
    materialPresetsPath,
    cameraPresetsPath: "presets/cameras.json",
  };
  run.mockImplementation(async (_config, request: KeyShotRequest) => ({
    ok: true,
    data: {
      presetName: request.presetName ?? null,
      material: request.materialName,
      appliedMaterial: `${request.materialName} #1`,
    },
    outputFiles: [request.outputScenePath],
    warnings: [],
    keyshotStdoutTail: "",
    error: null,
  }));
  server = createKeyShotServer(config);
  client = new Client({ name: "material-preset-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterEach(async () => {
  await client?.close();
  await server?.close();
  await fs.rm(root, { recursive: true, force: true });
});

describe("material preset MCP tool", () => {
  const args = {
    scenePath: "source.bip",
    objectPath: "/Assembly/Body#42",
    presetName: "matte black plastic",
    outputScenePath: "copy.bip",
    overwrite: false,
  };

  it("returns the canonical preset through both structured and text results", async () => {
    const response = await client.callTool({
      name: "keyshot_apply_material_preset",
      arguments: args,
    });
    expect(run).toHaveBeenCalledExactlyOnceWith(config, {
      operation: "apply_material",
      scenePath: args.scenePath,
      objectName: undefined,
      objectPath: args.objectPath,
      presetName: "Matte Black Plastic",
      materialName: "Soft Rough Black",
      materialPath: undefined,
      outputScenePath: args.outputScenePath,
      overwrite: false,
    });
    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        presetName: "Matte Black Plastic",
        appliedMaterial: "Soft Rough Black #1",
      },
    });
    const text = response.content.find((item) => item.type === "text");
    if (text?.type !== "text") throw new Error("Expected JSON text result");
    expect(JSON.parse(text.text)).toEqual(response.structuredContent);
  });

  it("does not manufacture success when assignment fails", async () => {
    run.mockResolvedValueOnce({
      ok: false,
      data: null,
      outputFiles: [],
      warnings: [],
      keyshotStdoutTail: "",
      error: "Material assignment not applied",
      errorCode: "MATERIAL_ASSIGNMENT_FAILED",
    });
    const response = await client.callTool({
      name: "keyshot_apply_material_preset",
      arguments: args,
    });
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      ok: false,
      data: null,
      outputFiles: [],
      errorCode: "MATERIAL_ASSIGNMENT_FAILED",
    });
  });

  it("rejects unknown presets without starting KeyShot", async () => {
    const response = await client.callTool({
      name: "keyshot_apply_material_preset",
      arguments: { ...args, presetName: "Missing" },
    });
    expect(run).not.toHaveBeenCalled();
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      ok: false,
      outputFiles: [],
      error: expect.stringContaining("Available: Matte Black Plastic"),
    });
  });
});
