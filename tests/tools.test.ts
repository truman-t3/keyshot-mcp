import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("MCP tool registration", () => {
  it("registers the render-all-cameras tool and bridge operation", () => {
    const indexSource = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const bridgeSource = fs.readFileSync(new URL("../scripts/keyshot_bridge.py", import.meta.url), "utf8");
    expect(indexSource).toContain('"keyshot_render_all_cameras"');
    expect(indexSource).toContain('operation: "render_all_cameras"');
    expect(bridgeSource).toContain('operation == "render_all_cameras"');
    expect(indexSource).toContain('"keyshot_list_camera_presets"');
    expect(indexSource).toContain('"keyshot_apply_camera_preset"');
    expect(bridgeSource).toContain('operation == "set_standard_camera"');
  });
});
