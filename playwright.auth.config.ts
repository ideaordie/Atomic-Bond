import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/auth-browser",
  outputDir: "test-results/auth",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3104", browserName: "chromium" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: "node scripts/test-auth-server.mjs",
      url: "http://127.0.0.1:54330/health",
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: "pnpm start --port 3104",
      url: "http://127.0.0.1:3104",
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        ATOMIC_BOND_DATA_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54330",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_only",
        APP_ORIGIN: "http://127.0.0.1:3104",
        AUTH_ALLOW_LOCALHOST: "true",
        RESEND_API_KEY: "",
        SUPABASE_AUTH_HOOK_SECRET: "",
      },
    },
  ],
});
