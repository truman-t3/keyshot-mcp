# KeyShot smoke-test demo

`keyshot-mcp-cube.obj` is original, generated geometry included under this
repository's MIT license. It contains no customer model or third-party asset.

Run `npm run smoke:keyshot` after setting `KEYSHOT_HEADLESS_EXE`. The command
checks KeyShot, imports the cube, saves and inspects the scene, applies the
built-in Front and Isometric camera presets, automatically discovers them, and renders both views under
`outputs/demo/all-cameras`. Generated `.bip` and PNG files remain under
`outputs/` and are ignored by Git.
