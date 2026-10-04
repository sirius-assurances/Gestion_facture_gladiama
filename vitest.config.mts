import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // e2e/ is Playwright's; it uses *.spec.ts so it never matches here, but
    // keep it excluded so a stray *.test.ts there can't be picked up either.
    exclude: ["node_modules", ".next", "app/generated", "e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
