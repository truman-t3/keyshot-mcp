# Changelog

All notable changes to KeyShot MCP are documented in this file.

## [Unreleased]

## [0.12.1] - 2026-09-02

### Security

- Updated the MCP SDK dependency baseline to pull patched Hono, Hono Node
  server, `fast-uri`, and `ip-address` runtime dependencies.
- Refreshed the development lockfile to use patched PostCSS and Nano ID releases.

### Changed

- Updated the Node.js and Python setup actions used by CI and release workflows.
- CI and release validation now reject high-severity dependency vulnerabilities.

## [0.12.0] - 2026-09-01

### Added

- Structured bug and feature request forms, a pull request checklist, support
  guidance, code ownership, and a bilingual community code of conduct.
- Weekly Dependabot updates for npm and monthly updates for GitHub Actions.
- CodeQL analysis for JavaScript and TypeScript changes and a weekly scheduled scan.

### Changed

- Contribution guidance now describes the complete validation suite, real KeyShot
  testing expectations, compatibility rules, and confidential-asset restrictions.
- Security guidance now links directly to GitHub private vulnerability reporting.
- Release validation now checks that required community health files remain present.

## [0.11.0] - 2026-08-12

### Added

- `keyshot_sync_saved_scene`, which detects the newest saved `.bip`, copies it to
  a collision-safe output, returns a content fingerprint, and optionally embeds a
  preview.
- Machine-readable interaction-mode diagnostics so Agents can explain that stable
  tools work on saved scenes rather than an unsaved GUI session.
- An original KeyShot MCP project mark and a clearer README introduction,
  navigation, highlights, and bilingual positioning for easier recognition.

### Changed

- README, Agent Skill, and MCP workflow guidance now explain the tested KeyShot
  Script Runner limitation and recommend the saved-scene synchronization workflow.

## [0.10.0] - 2026-08-11

### Added

- `keyshot_preview_render`, which embeds a bounded PNG preview in the MCP response.
- A generated 18-tool reference at `docs/TOOLS.md`.
- Documentation drift, formatting, Python lint, and release-integrity checks.

### Changed

- Tool metadata now comes from a shared catalog used by the server, tests, and documentation.
- The recommended workflow now includes an Agent-visible preview and user confirmation before standard or final rendering.
- Release automation pins MCP Publisher v1.7.9 and reports Registry failures without undoing a successful npm publication.

### Security

- Documented that scene metadata and preview images may be sent by an MCP client to its configured model provider.

[Unreleased]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.1...HEAD
[0.12.1]: https://github.com/truman-t3/keyshot-mcp/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/truman-t3/keyshot-mcp/compare/v0.9.1...v0.10.0
