import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from the unit config: these tests need the disposable Postgres
// from docker-compose.test.yml, so they must never run by default alongside
// the fast unit suite.
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
