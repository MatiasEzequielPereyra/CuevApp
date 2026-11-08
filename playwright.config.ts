import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      CUEVA_E2E_FIXTURES: "1",
      CUEVA_LOCAL_AUTH: "1",
      CUEVA_AUTH_URL: "http://127.0.0.1:3101",
      CUEVA_REST_URL: "http://127.0.0.1:3102",
      CUEVA_LAB_ORIGIN: "http://127.0.0.1:3000",
      CUEVA_ANON_KEY: "synthetic-test-value",
      CUEVA_DB_PORT: "3103",
      CUEVA_DB_PASSWORD: "synthetic-test-value",
    },
  },
});
