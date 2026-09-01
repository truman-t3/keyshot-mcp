## Summary

Describe the user-facing problem and the focused change.

## Validation

- [ ] `pnpm run check`
- [ ] `pnpm test`
- [ ] `python -m unittest discover -s tests -p "test_*.py"`
- [ ] `pnpm run format:check`
- [ ] `python -m ruff check scripts tests`
- [ ] `pnpm run docs:tools:check`
- [ ] `node scripts/check-release.mjs`
- [ ] `npm pack --dry-run`

## Safety

- [ ] No license credentials, tokens, customer assets, private scenes, or unpublished renders are included.
- [ ] Existing tool names and inputs remain compatible, or the compatibility impact is documented.
- [ ] Output paths and source-scene protection were considered.
- [ ] Real KeyShot testing is described when the change depends on KeyShot behavior.

