import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/prototype-browser",
  testMatch: "promotion.spec.ts",
  outputDir: "test-results/promotion",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3140", browserName: "chromium" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3140",
    url: "http://127.0.0.1:3140/review/promotion",
    timeout: 120000,
    reuseExistingServer: true,
  },
});
