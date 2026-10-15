import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOL_CATALOG } from "../src/tools/catalog.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = fs.readFileSync(path.join(root, "README.md"), "utf8");
const prose = source.replace(/```[^\n]*\n[\s\S]*?```/g, "");
const localDocs = [
  "README.md",
  "examples/lantern-demo/README.md",
  "assets/demo/lantern/ATTRIBUTION.md",
  "docs/GUI-LIMITATIONS.md",
];

describe("designer-facing README", () => {
  it("retains project header badges without reintroducing rating badges", () => {
    const header = source.split("## From a Request to a Render")[0];
    for (const label of [
      "npm version",
      "CI status",
      "MIT License",
      "19 MCP tools",
      "KeyShot 14.1 tested",
      "Node.js 20 or newer",
      "TypeScript 5.9",
      "MCP protocol 2026-07-28",
      "M8ven external verification",
    ])
      expect(header).toContain(`alt="${label}"`);
    expect(header).toContain(
      "https://m8ven.ai/badge/mcp/truman-t3-keyshot-mcp-v7af97?variant=verified",
    );
    expect(header).not.toMatch(/lobehub\.com\/badge|glama\.ai\/.*badge/);
  });

  it("keeps every tool discoverable without duplicating the full reference", () => {
    for (const tool of TOOL_CATALOG)
      expect(source).toContain("`" + tool.name + "`");
    expect(source).toContain("docs/TOOLS.md");
    expect(source).toContain("## English");
    expect(source).toContain("## 中文");
  });

  it("retains setup, preset and workflow details after restructuring", () => {
    for (const name of [
      "KEYSHOT_HEADLESS_EXE",
      "KEYSHOT_OUTPUT_DIR",
      "KEYSHOT_ALLOW_EXTERNAL_OUTPUTS",
      "KEYSHOT_TIMEOUT_MS",
      "KEYSHOT_LICENSE_ARGS",
      "KEYSHOT_CAMERA_PRESETS",
      "KEYSHOT_MATERIAL_PRESETS",
    ])
      expect(source.split(`\`${name}\``).length - 1).toBeGreaterThanOrEqual(2);
    for (const name of [
      "Front",
      "Back",
      "Left",
      "Right",
      "Top",
      "Bottom",
      "Isometric",
    ])
      expect(source).toContain(name);
    for (const detail of [
      "### Camera and Material Presets",
      "### 相机与材质预设",
      "#### Prepare a Model Without Rendering",
      "#### 只整理模型，不渲染",
      "#### Adjust the Lens and Environment",
      "#### 调整镜头与环境",
      "sequentially within each server instance",
      "多个独立 MCP 服务进程",
      "does not edit it",
      "不自动修改",
      "Do not upload or publish my scenes",
      "不要上传或发布我的场景",
      "CONTRIBUTING.md",
      "docs/GUI-LIMITATIONS.md",
      "docs/TOOLS.md",
    ])
      expect(source).toContain(detail);
    const introduction = source.split("## From a Request to a Render")[0];
    expect(introduction).toContain("model provider");
    expect(introduction).toContain("模型服务");
  });

  it("uses the approved local renders with source attribution", () => {
    expect(source).not.toContain("assets/demo/keyshot-mcp-demo.png");
    expect(source).toContain("Rajil Jose Macatangay");
    expect(source).toContain("https://polyhaven.com/a/Lantern_01");
    expect(source).toContain("CC0");
    for (const name of ["brass", "steel"]) {
      const bytes = fs.readFileSync(
        path.join(root, "assets/demo/lantern", name + ".png"),
      );
      expect(bytes.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(bytes.readUInt32BE(16)).toBe(1440);
      expect(bytes.readUInt32BE(20)).toBe(1080);
      expect(source).toContain("assets/demo/lantern/" + name + ".png");
    }
  });

  it("keeps installation JSON parseable and pinned to the published version", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    const blocks = [...source.matchAll(/```json\n([\s\S]*?)```/g)];
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      const parsed = JSON.parse(block[1]);
      expect(parsed.mcpServers.keyshot.args).toEqual([
        "-y",
        "keyshot-mcp@" + pkg.version,
      ]);
      expect(parsed.mcpServers.keyshot.env.KEYSHOT_HEADLESS_EXE).toBeTruthy();
    }
  });

  it("shows a bilingual request-to-output diagram on desktop and mobile", () => {
    expect(source).toContain("## From a Request to a Render / 一句话到出图");
    expect(source).toContain('srcset="assets/workflow-mobile.svg"');
    expect(source).toContain('src="assets/workflow.svg"');
    for (const file of ["assets/workflow.svg", "assets/workflow-mobile.svg"]) {
      const svg = fs.readFileSync(path.join(root, file), "utf8");
      expect(svg).toContain('aria-labelledby="title desc"');
      for (const stage of [
        "Describe the change",
        "Agent checks",
        "Edit a scene copy",
        "Review the preview",
        "Export after approval",
        "一句话说出需求",
        "确认后输出",
      ])
        expect(svg).toContain(stage);
      expect(svg).not.toContain("\uFFFD");
    }
  });

  it("keeps all local documentation and image links resolvable", () => {
    for (const relative of localDocs) {
      const filename = path.join(root, relative);
      const document = fs
        .readFileSync(filename, "utf8")
        .replace(/```[^\n]*\n[\s\S]*?```/g, "");
      const targets = [...document.matchAll(/\[[^\]\n]*\]\(([^\s)]+)\)/g)].map(
        (match) => match[1],
      );
      targets.push(
        ...[...document.matchAll(/(?:src|href)="([^"]+)"/g)].map(
          (match) => match[1],
        ),
      );
      for (const target of targets) {
        if (target.startsWith("#") || /^https?:/.test(target)) continue;
        expect(
          fs.existsSync(
            path.resolve(path.dirname(filename), target.split("#")[0]),
          ),
          `${relative}: ${target}`,
        ).toBe(true);
      }
    }
  });

  it("keeps header navigation aligned with actual sections", () => {
    const headings = new Set(
      [...prose.matchAll(/^#{1,6} (.+)$/gm)].map((match) =>
        match[1]
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, "")
          .replace(/ /g, "-"),
      ),
    );
    const targets = [
      ...prose.matchAll(/href="#([^"]+)"|\]\(#([^\s)]+)\)/g),
    ].map((match) => match[1] ?? match[2]);
    for (const target of targets)
      expect(headings.has(target), target).toBe(true);
  });

  it("keeps operating boundaries, privacy and unpublished fixes explicit", () => {
    expect(source).toContain("not realtime GUI control");
    expect(source).toContain("may send tool results, scene metadata");
    expect(source).toContain("下一补丁版");
    expect(source).not.toContain("\uFFFD");
  });
});
