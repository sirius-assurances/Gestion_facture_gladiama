import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // e2e/ is Playwright's, and integration/ needs the disposable Postgres
    // from docker-compose.test.yml — neither belongs in the fast unit run
    // (integration/*.test.ts would otherwise match the include pattern and
    // fail wherever no database is up).
    exclude: ["node_modules", ".next", "app/generated", "e2e", "integration"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
