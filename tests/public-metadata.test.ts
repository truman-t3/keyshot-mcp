import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyCameraPresetSchema,
  applyMaterialInputSchema,
  applyMaterialPresetInputSchema,
  batchRenderSchema,
  importModelSchema,
  productRenderInputSchema,
  previewRenderSchema,
  renderAllCamerasSchema,
  renderQueueSchema,
  renderSchema,
  saveSceneSchema,
  scenePathSchema,
  setCameraInputSchema,
  setEnvironmentSchema,
} from "../src/schemas.js";

const publicSchemas = {
  applyCameraPresetSchema,
  applyMaterialInputSchema,
  applyMaterialPresetInputSchema,
  batchRenderSchema,
  importModelSchema,
  productRenderInputSchema,
  previewRenderSchema,
  renderAllCamerasSchema,
  renderQueueSchema,
  renderSchema,
  saveSceneSchema,
  scenePathSchema,
  setCameraInputSchema,
  setEnvironmentSchema,
};

describe("public metadata", () => {
  it("describes every public input parameter", () => {
    for (const [schemaName, schema] of Object.entries(publicSchemas)) {
      for (const [parameter, parameterSchema] of Object.entries(schema.shape)) {
        expect(
          parameterSchema.description,
          `${schemaName}.${parameter}`,
        ).toBeTruthy();
      }
    }
  });

  it("ships valid Glama ownership metadata", () => {
    const glama = JSON.parse(
      fs.readFileSync(new URL("../glama.json", import.meta.url), "utf8"),
    );
    expect(glama).toEqual({
      $schema: "https://glama.ai/mcp/schemas/server.json",
      maintainers: ["truman-t3"],
    });
  });

  it("ships a versioned Agent Skill with safe operating guidance", () => {
    const skill = fs.readFileSync(
      new URL("../skills/keyshot-mcp/SKILL.md", import.meta.url),
      "utf8",
    );
    expect(skill).toMatch(/^---\r?\n[\s\S]+?\r?\n---/);
    expect(skill).toContain("name: keyshot-mcp");
    expect(skill).toContain("version: 0.10.0");
    expect(skill).toContain(
      "Never request, print, store, or upload license credentials.",
    );
    expect(skill).toContain("keyshot_product_render");
  });

  it("keeps README UTF-8 clean and release examples current", () => {
    const readme = fs.readFileSync(
      new URL("../README.md", import.meta.url),
      "utf8",
    );
    expect(readme).not.toContain("\uFFFD");
    expect(readme).not.toContain("���");
    expect(readme).toContain("Useful for your KeyShot workflow?");
    expect(readme).toContain("如果它改善了你的 KeyShot 工作流");
    expect(readme).toContain("keyshot-mcp@0.10.0");
  });
});
