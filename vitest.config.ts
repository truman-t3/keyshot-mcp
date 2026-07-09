// Plain config object (no `vitest/config` import) so the suite can run even when
// vitest is installed in an isolated workspace rather than the project node_modules.
export default {
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
};
