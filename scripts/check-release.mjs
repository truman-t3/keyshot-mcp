import fs from "node:fs";

const expected = process.argv[2] || process.env.RELEASE_VERSION;
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const server = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const versionSource = fs.readFileSync(new URL("../src/version.ts", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("./keyshot_bridge.py", import.meta.url), "utf8");
const readmeSource = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
const skillSource = fs.readFileSync(new URL("../skills/keyshot-mcp/SKILL.md", import.meta.url), "utf8");
const glama = JSON.parse(fs.readFileSync(new URL("../glama.json", import.meta.url), "utf8"));
const runtimeVersion = versionSource.match(/VERSION\s*=\s*["']([^"']+)["']/)?.[1];
const skillVersion = skillSource.match(/^version:\s*([^\s]+)$/m)?.[1];
const versions = [pkg.version, server.version, server.packages?.[0]?.version, runtimeVersion, skillVersion];

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
if (glama.$schema !== "https://glama.ai/mcp/schemas/server.json" || !glama.maintainers?.includes("truman-t3")) {
  throw new Error("glama.json must identify truman-t3 as a maintainer using the Glama server schema.");
}
if (!pkg.files?.includes("skills") || !pkg.files?.includes("glama.json")) {
  throw new Error("The npm package must include the Agent Skill and glama.json metadata.");
}
if (readmeSource.includes("\uFFFD") || readmeSource.includes("���")) {
  throw new Error("README.md contains Unicode replacement characters.");
}
if (!readmeSource.includes(`keyshot-mcp@${pkg.version}`) || !readmeSource.includes(`当前正式版本为 \`${pkg.version}\``)) {
  throw new Error("README.md installation examples must match the release version.");
}
if ((serverSource.match(/server\.registerTool\(/g) ?? []).length !== 17 || serverSource.includes("server.tool(")) {
  throw new Error("All 17 MCP tools must use registerTool metadata.");
}
if (!serverSource.includes("outputSchema: keyShotResultSchema") || !fs.readFileSync(new URL("../src/result.ts", import.meta.url), "utf8").includes("structuredContent")) {
  throw new Error("MCP tools must expose the common output schema and structured content.");
}
if (!serverSource.includes('"keyshot_render_all_cameras"') || !bridgeSource.includes('"render_all_cameras"')) {
  throw new Error("The render-all-cameras MCP tool and bridge operation must be included in the release.");
}
if (!/server\.registerTool\(\s*"keyshot_product_render"/.test(serverSource) || !bridgeSource.includes('operation == "product_render"')) {
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
