import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  checkPublicSafety,
  scanPublicText,
  scanPngMetadata,
  unsafePublicFilename,
} from "../scripts/check-public-safety.mjs";

describe("public-content safety", () => {
  it("checks tracked and untracked content without accepting unknown binary files", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "keyshot-public-safety-"),
    );
    try {
      execFileSync("git", ["init", "--quiet", root]);
      fs.writeFileSync(path.join(root, "data.bin"), Buffer.from([0, 1, 2]));
      const result = checkPublicSafety(root);
      expect(result.findings).toEqual([
        {
          file: "data.bin",
          category: "unreviewed binary publication content",
          line: 0,
        },
      ]);
    } finally {
      if (path.dirname(root) !== path.resolve(os.tmpdir()))
        throw new Error("Unsafe test cleanup target");
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores local secrets and scenes, but keeps generic examples available", () => {
    const candidates = [
      ".env.local",
      ".npmrc",
      "work/private.json",
      "test-scene.bip",
      "test.lic",
      ".env.example",
    ];
    const ignored = execFileSync(
      "git",
      ["check-ignore", "--no-index", "--stdin"],
      { input: candidates.join("\n"), encoding: "utf8" },
    )
      .trim()
      .split("\n");
    expect(ignored).toEqual(candidates.slice(0, -1));
  });
  it("finds credentials without returning their values", () => {
    const secret = ["npm", "_", "a".repeat(36)].join("");
    const result = scanPublicText(`line one\n${secret}`);
    expect(result).toEqual([{ category: "npm token", line: 2 }]);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(scanPublicText(["ghp", "_", "x".repeat(36)].join(""))).toHaveLength(
      1,
    );
  });

  it("distinguishes private paths from public example placeholders", () => {
    expect(
      scanPublicText(["C:", "Users", "private-test-user", "scene"].join("\\")),
    ).toHaveLength(1);
    expect(
      scanPublicText(
        "C:/path/to/project C:/Users/<username>/model C:/Users/Public/model",
      ),
    ).toEqual([]);
  });

  it.each([
    ".env",
    ".env.local",
    ".ENV.LOCAL",
    "nested/.npmrc",
    "nested/.NPMRC",
    "assets/scene.bip",
    "license.lic",
    "signing.pem",
    "output.log",
    "assets/model.glb",
    "work/result.json",
    "WORK/result.json",
    "assets/unreviewed-screenshot.png",
  ])("rejects private or generated filename %s", (file) => {
    expect(unsafePublicFilename(file)).toBe(true);
  });

  it.each([
    "LICENSE",
    "SECURITY.md",
    ".env.example",
    "outputs/.gitkeep",
    "assets/demo/lantern/steel.png",
    "examples/demo/keyshot-mcp-cube.obj",
    "examples/demo/unsupported-wavefront.mtl",
  ])("allows reviewed public filename %s", (file) => {
    expect(unsafePublicFilename(file)).toBe(false);
  });

  it("checks compressed PNG metadata but not pixel data", () => {
    const secret = ["npm", "_", "a".repeat(36)].join("");
    const chunk = (type: string, data: Buffer) => {
      const header = Buffer.alloc(8);
      header.writeUInt32BE(data.length);
      header.write(type, 4);
      return Buffer.concat([header, data, Buffer.alloc(4)]);
    };
    const image = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", Buffer.alloc(13)),
      chunk(
        "zTXt",
        Buffer.concat([Buffer.from("Comment\0\0"), deflateSync(secret)]),
      ),
      chunk("IDAT", Buffer.from(secret)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    expect(scanPngMetadata(image)).toEqual([
      { category: "npm token", line: 1 },
    ]);
    expect(() =>
      scanPngMetadata(Buffer.concat([image, Buffer.from("trailing")])),
    ).toThrow("trailing");
    expect(() => scanPngMetadata(Buffer.alloc(8))).toThrow("signature");
  });
});
