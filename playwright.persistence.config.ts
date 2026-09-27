import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/persistence-browser",
  outputDir: "test-results/persistence",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3102", browserName: "chromium" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: "node scripts/test-public-rpc-server.mjs",
      url: "http://127.0.0.1:54329/health",
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: "pnpm start --port 3102",
      url: "http://127.0.0.1:3102",
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        ATOMIC_BOND_DATA_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_only",
      },
    },
  ],
});
