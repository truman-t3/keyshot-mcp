# KeyShot smoke-test demo

`keyshot-mcp-cube.obj` is original, generated geometry included under this
repository's MIT license. It contains no customer model or third-party asset.

Run `npm run smoke:keyshot` after setting `KEYSHOT_HEADLESS_EXE`. The command
checks KeyShot, imports the cube, saves and inspects the scene, creates an MCP
camera, and renders `outputs/demo/keyshot-mcp-demo.png`. Generated `.bip` files
remain under `outputs/` and are ignored by Git.
