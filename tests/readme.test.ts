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
  it("keeps every tool discoverable without duplicating the full reference", () => {
    for (const tool of TOOL_CATALOG)
      expect(source).toContain("`" + tool.name + "`");
    expect(source).toContain("docs/TOOLS.md");
    expect(source).toContain("## English");
    expect(source).toContain("## 中文");
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
