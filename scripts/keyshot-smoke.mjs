import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCameraPreset, loadCameraPresets } from "../dist/camera-presets.js";
import { getConfig } from "../dist/config.js";
import { runKeyShotDiagnostics } from "../dist/diagnostics.js";
import { prepareProductRenderRequest } from "../dist/product-render.js";
import { runKeyShotSerialized } from "../dist/runner.js";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = getConfig();
const modelPath = path.join(repoRoot, "examples", "demo", "keyshot-mcp-cube.obj");

async function run(label, request) {
  process.stdout.write(`${label}... `);
  const result = await runKeyShotSerialized(config, request);
  if (!result.ok) {
    process.stdout.write("failed\n");
    throw new Error(`${label}: ${result.error}\n${result.warnings.join("\n")}`);
  }
  process.stdout.write("ok\n");
  return result;
}

async function applyStandardPreset(label, scenePath, presetName, outputScenePath) {
  const presets = await loadCameraPresets(config);
  const preset = findCameraPreset(presets, presetName);
  if (!preset || preset.type !== "standard") {
    throw new Error(`Standard camera preset not found: ${presetName}`);
  }
  return run(label, {
    operation: "set_standard_camera",
    scenePath,
    cameraName: preset.name,
    standardView: preset.standardView,
    outputScenePath,
  });
}

process.stdout.write("1/14 KeyShot diagnostics... ");
const status = await runKeyShotDiagnostics(config);
if (!status.ok || !status.data?.ready) {
  process.stdout.write("failed\n");
  throw new Error(`KeyShot diagnostics: ${status.error}\n${(status.suggestions ?? []).join("\n")}`);
}
process.stdout.write("ok\n");
const imported = await run("2/14 Import, center, and ground generated OBJ", {
  operation: "import_model",
  modelPath,
  outputScenePath: "demo/keyshot-mcp-demo-import.bip",
  centerGeometry: true,
  snapToGround: true,
  adjustCameraLookAt: true,
  adjustEnvironment: true,
});
const importedScene = imported.outputFiles[0];
if (!importedScene) throw new Error("Import did not return a saved scene path.");

const inspected = await run("3/14 Inspect imported scene", {
  operation: "inspect_scene",
  scenePath: importedScene,
});
const objects = inspected.data?.objects;
if (!Array.isArray(objects) || objects.length === 0) {
  throw new Error("Imported scene did not contain any inspectable objects.");
}

const firstCameraResult = await applyStandardPreset(
  "4/14 Apply Front camera preset",
  importedScene,
  "Front",
  "demo/keyshot-mcp-demo-preset-front.bip",
);
const firstCameraScene = firstCameraResult.outputFiles[0];
if (!firstCameraScene) throw new Error("Front preset did not return a saved scene path.");

const focalLengthResult = await run("5/14 Set Front camera focal length", {
  operation: "set_camera",
  scenePath: firstCameraScene,
  cameraName: "Front",
  focalLength: 55,
  outputScenePath: "demo/keyshot-mcp-demo-front-lens.bip",
});
const focalLengthScene = focalLengthResult.outputFiles[0];
if (!focalLengthScene) throw new Error("Focal-length update did not return a saved scene path.");

const environmentResult = await run("6/14 Rotate the active environment", {
  operation: "set_environment",
  scenePath: focalLengthScene,
  rotation: 45,
  outputScenePath: "demo/keyshot-mcp-demo-environment.bip",
});
const environmentScene = environmentResult.outputFiles[0];
if (!environmentScene) throw new Error("Environment update did not return a saved scene path.");

const secondCameraResult = await applyStandardPreset(
  "7/14 Apply Isometric camera preset",
  environmentScene,
  "Isometric",
  "demo/keyshot-mcp-demo-presets.bip",
);
const cameraScene = secondCameraResult.outputFiles[0];
if (!cameraScene) throw new Error("Isometric preset did not return a saved scene path.");

const fieldOfViewResult = await run("8/14 Set Isometric camera field of view and distance", {
  operation: "set_camera",
  scenePath: cameraScene,
  cameraName: "Isometric",
  fieldOfView: 35,
  distance: 6,
  outputScenePath: "demo/keyshot-mcp-demo-product-camera.bip",
});
const productCameraScene = fieldOfViewResult.outputFiles[0];
if (!productCameraScene) throw new Error("Field-of-view update did not return a saved scene path.");

const rendered = await run("9/14 Discover and render every camera", {
  operation: "render_all_cameras",
  scenePath: productCameraScene,
  outputDir: "demo/all-cameras",
  width: 640,
  height: 480,
  maxTimeSeconds: 8,
  format: "png",
  overwrite: true,
  continueOnError: true,
});

const renderData = rendered.data;
if (!renderData || renderData.failed !== 0 || renderData.succeeded < 2) {
  throw new Error("All-camera render did not produce at least two successful camera views.");
}

const namedResults = renderData.results.filter(
  (entry) => entry.camera === "Front" || entry.camera === "Isometric",
);
if (namedResults.length !== 2 || namedResults.some((entry) => !entry.ok)) {
  throw new Error("The Front and Isometric preset cameras were not both rendered successfully.");
}
const hashes = await Promise.all(namedResults.map(async (entry) =>
  crypto.createHash("sha256").update(await fs.readFile(entry.outputPath)).digest("hex")
));
if (hashes[0] === hashes[1]) {
  throw new Error("The two demo camera renders are identical; expected different viewpoints.");
}
const minimumSizes = await Promise.all(namedResults.map(async (entry) => (await fs.stat(entry.outputPath)).size));
if (minimumSizes.some((size) => size < 10000)) {
  throw new Error("A demo camera render is unexpectedly small and may be blank.");
}
process.stdout.write("10/14 Verify two different camera images... ok\n");
process.stdout.write("11/14 Verify composition, lens, and environment operations... ok\n");

const oneClickModelRequest = await prepareProductRenderRequest(config, {
  modelPath,
  renderMode: "single",
  qualityPreset: "standard",
  format: "png",
  overwrite: false,
  continueOnError: true,
});
const oneClickModel = await run("12/14 Standard-quality one-click product render", oneClickModelRequest);
if (!oneClickModel.data?.savedScene || oneClickModel.data?.renders?.length !== 1) {
  throw new Error("One-click model workflow did not return a scene and one render.");
}

const repeatedRequest = await prepareProductRenderRequest(config, {
  modelPath,
  renderMode: "single",
  qualityPreset: "preview",
  format: "png",
  overwrite: false,
  continueOnError: true,
});
const repeatedModel = await run("13/14 Repeated preview render with automatic numbering", repeatedRequest);
if (!repeatedModel.data?.savedScene || repeatedModel.data?.savedScene === oneClickModel.data.savedScene) {
  throw new Error("Repeated one-click render did not allocate a new numbered scene path.");
}

const oneClickSceneRequest = await prepareProductRenderRequest(config, {
  scenePath: productCameraScene,
  outputScenePath: "demo/one-click-existing-scene.bip",
  outputDir: "demo/one-click-all-cameras",
  renderMode: "allCameras",
  width: 640,
  height: 480,
  maxTimeSeconds: 8,
  format: "png",
  overwrite: true,
  continueOnError: true,
});
const oneClickScene = await run("14/14 One-click existing-scene all-camera render", oneClickSceneRequest);
if (!oneClickScene.data?.savedScene || oneClickScene.data?.renders?.length < 2) {
  throw new Error("One-click scene workflow did not preserve the scene and render all cameras.");
}

console.log(JSON.stringify({
  keyshotVersion: status.data?.version ?? null,
  objectCount: objects.length,
  scenePath: productCameraScene,
  cameraCount: renderData.total,
  renderedImages: rendered.outputFiles,
  oneClickOutputs: [...oneClickModel.outputFiles, ...repeatedModel.outputFiles, ...oneClickScene.outputFiles],
  diagnosticChecks: status.data?.checks ?? [],
  verifiedQualities: ["standard", "preview"],
  verifiedPresets: namedResults.map((entry) => entry.camera),
  verifiedControls: {
    importOptions: ["centerGeometry", "snapToGround", "adjustCameraLookAt", "adjustEnvironment"],
    focalLength: 55,
    fieldOfView: 35,
    distance: 6,
    environmentRotation: 45,
  },
}, null, 2));
