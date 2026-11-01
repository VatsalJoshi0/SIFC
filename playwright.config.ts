import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: {
    timeout: 8000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: "npx tsx apps/api/src/server.ts",
      url: "http://127.0.0.1:3001/healthz",
      reuseExistingServer: false,
      timeout: 20000,
    },
    {
      command: "npm --workspace=@vai/web run preview",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 20000,
    },
  ],
});
