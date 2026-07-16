import path from "node:path";
import { fileURLToPath } from "node:url";
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

const status = await run("1/5 KeyShot status", { operation: "status" });
const imported = await run("2/5 Import and save generated OBJ", {
  operation: "import_model",
  modelPath,
  outputScenePath: "demo/keyshot-mcp-demo-import.bip",
});
const importedScene = imported.outputFiles[0];
if (!importedScene) throw new Error("Import did not return a saved scene path.");

const inspected = await run("3/5 Inspect imported scene", {
  operation: "inspect_scene",
  scenePath: importedScene,
});
const objects = inspected.data?.objects;
if (!Array.isArray(objects) || objects.length === 0) {
  throw new Error("Imported scene did not contain any inspectable objects.");
}

const cameraSceneResult = await run("4/5 Create camera and save scene", {
  operation: "set_camera",
  scenePath: importedScene,
  cameraName: "MCP Demo",
  position: [4.5, 3.5, 4.5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  outputScenePath: "demo/keyshot-mcp-demo-camera.bip",
});
const cameraScene = cameraSceneResult.outputFiles[0];
if (!cameraScene) throw new Error("Camera operation did not return a saved scene path.");

const rendered = await run("5/5 Render real PNG", {
  operation: "render",
  scenePath: cameraScene,
  camera: "MCP Demo",
  outputPath: "demo/keyshot-mcp-demo.png",
  width: 640,
  height: 480,
  maxTimeSeconds: 8,
  format: "png",
});

console.log(JSON.stringify({
  keyshotVersion: status.data?.version ?? null,
  objectCount: objects.length,
  scenePath: cameraScene,
  imagePath: rendered.outputFiles[0] ?? null,
}, null, 2));
