import fs from "node:fs";

const expected = process.argv[2] || process.env.RELEASE_VERSION;
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const server = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const versionSource = fs.readFileSync(new URL("../src/version.ts", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("./keyshot_bridge.py", import.meta.url), "utf8");
const runtimeVersion = versionSource.match(/VERSION\s*=\s*["']([^"']+)["']/)?.[1];
const versions = [pkg.version, server.version, server.packages?.[0]?.version, runtimeVersion];

if (expected && versions.some((version) => version !== expected)) {
  throw new Error(`Release version mismatch. Expected ${expected}; found ${versions.join(", ")}.`);
}
if (new Set(versions).size !== 1) {
  throw new Error(`Version fields do not match: ${versions.join(", ")}.`);
}
if (pkg.mcpName !== server.name) {
  throw new Error(`package.json mcpName (${pkg.mcpName}) must match server.json name (${server.name}).`);
}
if (server.packages?.[0]?.identifier !== pkg.name) {
  throw new Error("server.json npm package identifier must match package.json name.");
}
if (!serverSource.includes('"keyshot_render_all_cameras"') || !bridgeSource.includes('"render_all_cameras"')) {
  throw new Error("The render-all-cameras MCP tool and bridge operation must be included in the release.");
}
if (!/server\.tool\(\s*"keyshot_product_render"/.test(serverSource) || !bridgeSource.includes('operation == "product_render"')) {
  throw new Error("The one-process product-render MCP tool and bridge operation must be included in the release.");
}
if (!serverSource.includes("runKeyShotDiagnostics") || !serverSource.includes("applyRenderQuality")) {
  throw new Error("The enhanced status diagnostics and render quality presets must be included in the release.");
}
if (
  !serverSource.includes('"keyshot_list_camera_presets"') ||
  !serverSource.includes('"keyshot_apply_camera_preset"') ||
  !bridgeSource.includes('"set_standard_camera"')
) {
  throw new Error("Camera preset MCP tools and the standard-camera bridge operation must be included.");
}
for (const capability of [
  "centerGeometry",
  "snapToGround",
  "adjustCameraLookAt",
  "adjustEnvironment",
  "fieldOfView",
  "focalLength",
  "rotation",
]) {
  if (!serverSource.includes(capability) && !bridgeSource.includes(capability)) {
    throw new Error(`The ${capability} capability must be included in the release.`);
  }
}
console.log(`Release metadata is consistent for ${pkg.name}@${pkg.version}.`);
