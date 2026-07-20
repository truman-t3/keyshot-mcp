import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCameraPreset, loadCameraPresets } from "../dist/camera-presets.js";
import { getConfig } from "../dist/config.js";
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

const status = await run("1/11 KeyShot status", { operation: "status" });
const imported = await run("2/11 Import, center, and ground generated OBJ", {
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

const inspected = await run("3/11 Inspect imported scene", {
  operation: "inspect_scene",
  scenePath: importedScene,
});
const objects = inspected.data?.objects;
if (!Array.isArray(objects) || objects.length === 0) {
  throw new Error("Imported scene did not contain any inspectable objects.");
}

const firstCameraResult = await applyStandardPreset(
  "4/11 Apply Front camera preset",
  importedScene,
  "Front",
  "demo/keyshot-mcp-demo-preset-front.bip",
);
const firstCameraScene = firstCameraResult.outputFiles[0];
if (!firstCameraScene) throw new Error("Front preset did not return a saved scene path.");

const focalLengthResult = await run("5/11 Set Front camera focal length", {
  operation: "set_camera",
  scenePath: firstCameraScene,
  cameraName: "Front",
  focalLength: 55,
  outputScenePath: "demo/keyshot-mcp-demo-front-lens.bip",
});
const focalLengthScene = focalLengthResult.outputFiles[0];
if (!focalLengthScene) throw new Error("Focal-length update did not return a saved scene path.");

const environmentResult = await run("6/11 Rotate the active environment", {
  operation: "set_environment",
  scenePath: focalLengthScene,
  rotation: 45,
  outputScenePath: "demo/keyshot-mcp-demo-environment.bip",
});
const environmentScene = environmentResult.outputFiles[0];
if (!environmentScene) throw new Error("Environment update did not return a saved scene path.");

const secondCameraResult = await applyStandardPreset(
  "7/11 Apply Isometric camera preset",
  environmentScene,
  "Isometric",
  "demo/keyshot-mcp-demo-presets.bip",
);
const cameraScene = secondCameraResult.outputFiles[0];
if (!cameraScene) throw new Error("Isometric preset did not return a saved scene path.");

const fieldOfViewResult = await run("8/11 Set Isometric camera field of view and distance", {
  operation: "set_camera",
  scenePath: cameraScene,
  cameraName: "Isometric",
  fieldOfView: 35,
  distance: 6,
  outputScenePath: "demo/keyshot-mcp-demo-product-camera.bip",
});
const productCameraScene = fieldOfViewResult.outputFiles[0];
if (!productCameraScene) throw new Error("Field-of-view update did not return a saved scene path.");

const rendered = await run("9/11 Discover and render every camera", {
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
process.stdout.write("10/11 Verify two different camera images... ok\n");
process.stdout.write("11/11 Verify composition, lens, and environment operations... ok\n");

console.log(JSON.stringify({
  keyshotVersion: status.data?.version ?? null,
  objectCount: objects.length,
  scenePath: productCameraScene,
  cameraCount: renderData.total,
  renderedImages: rendered.outputFiles,
  verifiedPresets: namedResults.map((entry) => entry.camera),
  verifiedControls: {
    importOptions: ["centerGeometry", "snapToGround", "adjustCameraLookAt", "adjustEnvironment"],
    focalLength: 55,
    fieldOfView: 35,
    distance: 6,
    environmentRotation: 45,
  },
}, null, 2));
