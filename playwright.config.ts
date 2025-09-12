import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  use: { baseURL: "http://localhost:5173", navigationTimeout: 10000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
