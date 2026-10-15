import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractReleaseNotes,
  validateReleaseReadiness,
} from "../scripts/release-changelog.mjs";
import { VERSION } from "../src/version.js";

const readme = (pending = false) =>
  `<!-- release-version: 1.2.3 -->\n${pending ? "<!-- release-status: pending -->" : ""}\nnpx -y keyshot-mcp@1.2.3`;
const changelog = (body = "- Fix materials.\n- 修复材质。") =>
  `## [Unreleased]\n\n## [1.2.3] - 2026-10-15\n${body}\n\n## [1.2.2]\nOlder release.\n\n[Unreleased]: https://github.com/truman-t3/keyshot-mcp/compare/v1.2.3...HEAD\n[1.2.3]: https://github.com/truman-t3/keyshot-mcp/compare/v1.2.2...v1.2.3`;

describe("release readiness", () => {
  it("extracts only the requested bilingual release, not link definitions", () => {
    const notes = extractReleaseNotes(changelog(), "1.2.3");
    expect(notes).toBe("- Fix materials.\n- 修复材质。");
    expect(
      extractReleaseNotes(changelog().replaceAll("\n", "\r\n"), "1.2.3"),
    ).toBe(notes);
  });

  it.each(["", "v1.2.3", "1.2.3-live.1"])(
    "rejects an invalid stable version: %s",
    (version) => {
      expect(() => extractReleaseNotes(changelog(), version)).toThrow(
        "Provide a release version",
      );
    },
  );

  it("rejects missing and duplicate release headings", () => {
    expect(() => extractReleaseNotes(changelog(), "9.9.9")).toThrow("found 0");
    expect(() =>
      extractReleaseNotes(changelog() + "\n## [1.2.3]\nFix 修复", "1.2.3"),
    ).toThrow("found 2");
  });

  it.each(["### Fixed / 修复\n- English only.", "### Changed\n- 仅中文。", ""])(
    "does not count headings or links as translated notes",
    (body) => {
      expect(() => extractReleaseNotes(changelog(body), "1.2.3")).toThrow(
        "English and Chinese",
      );
    },
  );

  it("allows candidate validation but blocks pending publication", () => {
    expect(
      validateReleaseReadiness(readme(true), changelog(), "1.2.3"),
    ).toContain("修复");
    expect(() =>
      validateReleaseReadiness(readme(true), changelog(), "1.2.3", true),
    ).toThrow("pending");
    expect(() =>
      validateReleaseReadiness(
        readme(),
        changelog().replace("2026-10-15", "Pending / 待发布"),
        "1.2.3",
        true,
      ),
    ).toThrow("pending");
    expect(
      validateReleaseReadiness(readme(), changelog(), "1.2.3", true),
    ).toContain("Fix materials");
  });

  it("rejects mismatched markers, stale pins and stale comparison links", () => {
    expect(() =>
      validateReleaseReadiness(readme(), changelog(), "1.2.4"),
    ).toThrow("marker");
    expect(() =>
      validateReleaseReadiness(
        readme() + "\nkeyshot-mcp@1.2.2",
        changelog(),
        "1.2.3",
      ),
    ).toThrow("installation examples");
    expect(() =>
      validateReleaseReadiness(
        readme(),
        changelog().replace("v1.2.3...HEAD", "v1.2.2...HEAD"),
        "1.2.3",
      ),
    ).toThrow("comparison");
  });

  it("keeps the actual candidate consistent and gates notes before publishing", () => {
    const read = (relative) =>
      fs.readFileSync(new URL(relative, import.meta.url), "utf8");
    expect(
      validateReleaseReadiness(
        read("../README.md"),
        read("../CHANGELOG.md"),
        VERSION,
      ),
    ).toContain("材质");
    const workflow = read("../.github/workflows/npm-publish.yml");
    expect(workflow).toContain('scripts/check-release.mjs "$version" --ready');
    expect(
      workflow.indexOf("Validate bilingual release notes before publishing"),
    ).toBeLessThan(workflow.indexOf("run: npm publish --access public"));
    expect(workflow.match(/node scripts\/release-notes\.mjs/g)).toHaveLength(1);
  });
});
