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
  syncSavedSceneSchema,
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
  syncSavedSceneSchema,
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
    expect(skill).toContain("version: 0.12.0");
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
    expect(readme).toContain("keyshot-mcp@0.12.0");
    expect(readme).toContain('src="assets/logo-lockup.png"');
    expect(readme).toContain("Turn product-rendering requests into safe");
    expect(readme).toContain("### 核心特点");
  });

  it("ships community support and contribution metadata", () => {
    for (const relativePath of [
      "../SUPPORT.md",
      "../CODE_OF_CONDUCT.md",
      "../CONTRIBUTING.md",
      "../.github/CODEOWNERS",
      "../.github/dependabot.yml",
      "../.github/pull_request_template.md",
      "../.github/ISSUE_TEMPLATE/bug-report.yml",
      "../.github/ISSUE_TEMPLATE/feature-request.yml",
      "../.github/ISSUE_TEMPLATE/config.yml",
      "../.github/workflows/codeql.yml",
    ]) {
      expect(fs.existsSync(new URL(relativePath, import.meta.url))).toBe(true);
    }

    const security = fs.readFileSync(
      new URL("../SECURITY.md", import.meta.url),
      "utf8",
    );
    expect(security).toContain("security/advisories/new");
  });
});
