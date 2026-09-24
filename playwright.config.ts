import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Multiplayer E2E: four isolated browser contexts (four "phones") against a
 * production build using the in-memory store + SSE realtime. Dev tools are
 * enabled only for this local server so dice can be forced deterministically.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/config`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { SHUT10_DEV_TOOLS: "1", NODE_ENV: "production" },
  },
});
