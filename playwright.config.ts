import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    screenshot: "on",
  },
  webServer: {
    command: "npm run dev -- -p 3001",
    port: 3001,
    reuseExistingServer: true,
  },
});
