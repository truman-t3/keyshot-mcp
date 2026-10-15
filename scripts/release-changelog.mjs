export function extractReleaseNotes(changelog, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
    throw new Error("Provide a release version, for example 0.13.1.");
  }
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  const starts = lines.flatMap((line, index) =>
    line === heading || line.startsWith(`${heading} `) ? [index] : [],
  );
  if (starts.length !== 1)
    throw new Error(
      `Expected one changelog entry for ${version}; found ${starts.length}.`,
    );
  const start = starts[0];
  const next = lines.findIndex(
    (line, index) => index > start && /^## \[/.test(line),
  );
  const notes = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .filter((line) => !/^\[[^\]]+\]:\s+https?:/.test(line))
    .join("\n")
    .trim();
  // Section labels and URLs must not make a single-language body appear bilingual.
  const prose = notes.replace(/^#+.*$/gm, "").replace(/https?:\/\/\S+/g, "");
  if (!/[\u3400-\u9fff]/u.test(prose) || !/[A-Za-z]/.test(prose))
    throw new Error(`Release ${version} requires English and Chinese notes.`);
  return notes;
}

export function validateReleaseReadiness(
  readme,
  changelog,
  version,
  ready = false,
) {
  if (!readme.includes(`<!-- release-version: ${version} -->`))
    throw new Error("README release marker must match the package version.");
  const pins = [...readme.matchAll(/keyshot-mcp@(\d+\.\d+\.\d+)/g)].map(
    (match) => match[1],
  );
  if (!pins.length || pins.some((pin) => pin !== version))
    throw new Error(
      "README installation examples must match the release version.",
    );
  const notes = extractReleaseNotes(changelog, version);
  const compare = `[Unreleased]: https://github.com/truman-t3/keyshot-mcp/compare/v${version}...HEAD`;
  if (!changelog.includes(compare))
    throw new Error(
      "The Unreleased comparison must start at the current version.",
    );
  const pending = /<!--\s*release-status:\s*pending\s*-->/.test(readme);
  const datedPrefix = `## [${version}] - `;
  const datedHeading = changelog
    .split(/\r?\n/)
    .some(
      (line) =>
        line.startsWith(datedPrefix) &&
        /^\d{4}-\d{2}-\d{2}$/.test(line.slice(datedPrefix.length).trim()),
    );
  if (ready && (pending || !datedHeading))
    throw new Error(
      "Release is pending: remove the pending notice and date the changelog before publishing.",
    );
  return notes;
}
