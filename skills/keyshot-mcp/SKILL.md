---
name: keyshot-mcp
author: truman-t3
description: Install, diagnose, and safely use KeyShot MCP for local product visualization, scene editing, camera control, material assignment, and rendering.
version: 0.12.1
---

# KeyShot MCP

Use this skill when a user wants to install KeyShot MCP, troubleshoot its local
KeyShot connection, inspect or edit a KeyShot scene, or produce product renders.
Respond in the user's language and explain errors in plain, non-technical terms.

## Safety rules

- Keep models, scenes, renders, and license information on the local computer.
- Never request, print, store, or upload license credentials.
- Keep `KEYSHOT_ALLOW_EXTERNAL_OUTPUTS` disabled unless the user explicitly selects
  and trusts an external output directory.
- Do not overwrite an explicit output path unless the user clearly requests it.
- Use scene copies for editing workflows; do not modify customer source files in place.
- Do not execute arbitrary Python or simulate KeyShot GUI actions.
- When the user asks to control the current KeyShot window, selected GUI object,
  or unsaved scene in realtime, explain the GUI boundary before requesting a file:
  the stable server uses KeyShot headless on saved scenes. A persistent GUI bridge
  was prototyped, but KeyShot Script Runner remains active for the lifetime of the
  script and blocks normal GUI interaction. The public scripting API does not
  provide a documented non-blocking GUI service or main-thread callback for safely
  hosting that bridge. Do not describe this as a missing MCP feature.
- After explaining the boundary, ask the user to save the scene and offer to edit
  a safe copy, return an Agent-visible preview, and preserve the source file.

## Installation workflow

1. Confirm Node.js 20 or newer is available.
2. Confirm KeyShot is installed and locally licensed.
3. Locate `keyshot_headless.exe`. Prefer its absolute path.
4. Configure the MCP client to run `npx -y keyshot-mcp@0.12.1` and set
   `KEYSHOT_HEADLESS_EXE`.
5. Leave `KEYSHOT_OUTPUT_DIR` unset to use
   `<home>/Documents/KeyShot MCP Outputs`, or set a user-approved directory.
6. Restart or reload the MCP client.
7. Call `keyshot_status` before the first scene operation.
8. If status is not ready, follow its `suggestions` and explain the failing check.

Example configuration:

```json
{
  "mcpServers": {
    "keyshot": {
      "command": "npx",
      "args": ["-y", "keyshot-mcp@0.12.1"],
      "env": {
        "KEYSHOT_HEADLESS_EXE": "C:/Program Files/KeyShot Studio/bin/keyshot_headless.exe"
      }
    }
  }
}
```

## Tool selection

- Start with `keyshot_status` for installation or startup problems.
- Prefer `keyshot_product_render` for an end-to-end model or scene workflow.
- Use `keyshot_inspect_scene` before object-specific edits when names are unknown.
- Use `keyshot_list_cameras` before rendering selected cameras.
- Use `keyshot_preview_render` after inspection so the Agent and user can review
  composition, materials, and lighting before a standard or final render.
- When the user has just saved a GUI scene or asks for the newest saved work, use
  `keyshot_sync_saved_scene`. Reuse its returned fingerprint on the next check so
  unchanged saves do not produce duplicate copies or previews.
- Use `keyshot_render` for one view, `keyshot_batch_render` for selected views,
  `keyshot_render_all_cameras` for every saved view, and `keyshot_render_queue`
  for independent jobs from multiple scenes.
- Use `keyshot_import_model` when the user wants a prepared scene without a render.
- List camera or material presets before applying a preset with an unknown name.
- Use `objectPath` instead of `objectName` when duplicate names exist.
- Use `keyshot_save_scene` only for an explicit scene copy; editing tools already
  save their own output scenes.

## Render guidance

- `preview`: quick composition and material feedback.
- `standard`: normal product output and the default for `keyshot_product_render`.
- `final`: high-resolution output after the design is approved.
- Explicit width, height, and samples override their preset values.
- Never combine `samples` with `maxTimeSeconds`.
- Never combine camera `fieldOfView` with `focalLength`.
- Supply camera `position` and `lookAt` together.

## Result handling

Every tool returns `ok`, operation-specific `data`, `outputFiles`, `warnings`,
`keyshotStdoutTail`, and `error`. Failures may also return `errorCode` and
`suggestions`.

1. Confirm `ok` before claiming success.
2. Report every created file from `outputFiles`.
3. Surface warnings without presenting them as failures.
4. On failure, explain `error` and the first relevant suggestion.
5. Run `keyshot_status` when the cause is unclear.

## Recommended feedback loop

1. Run `keyshot_status`.
2. Inspect the scene and identify the intended camera or object.
3. Call `keyshot_preview_render` and describe only what is visible in the returned image.
4. Ask the user to confirm material, camera, and environment changes.
5. Apply approved edits to a scene copy.
6. Render at `standard` or `final` quality.

## Boundaries

KeyShot MCP uses KeyShot headless scripting. It does not include KeyShot, a
license, proprietary materials, environments, or customer assets. Features that
are not exposed by the installed KeyShot headless API must be reported as
unsupported rather than silently ignored.

The stable tools do not attach to an open, unsaved KeyShot GUI session. If the
user expects realtime control, state this before running tools and attribute the
limitation accurately to the currently documented KeyShot GUI scripting execution
model. Do not imply that installing or configuring the MCP differently will enable
realtime GUI control.
