import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/doodle-browser",
  outputDir: "test-results/doodle",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3140",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3140",
    url: "http://127.0.0.1:3140/review/doodle",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: { ATOMIC_BOND_DATA_MODE: "mock" },
  },
});
