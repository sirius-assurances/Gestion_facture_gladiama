import { defineConfig } from "@playwright/test";

// Pinned to a port of its own rather than Next's default 3000: another
// project on this machine serves 3000, and silently reusing it pointed the
// whole suite at a different app ("Invalid email or password" everywhere).
const PORT = process.env.E2E_PORT ?? "3001";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// E2E runs against a running app (dev server by default). Credentials come
// from the environment — see .env.example — so nothing is committed.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "signed-in",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { storageState: "./e2e/.auth/user.json" },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
