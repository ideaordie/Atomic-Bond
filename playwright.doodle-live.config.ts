import { defineConfig } from "@playwright/test";
import base from "./playwright.auth.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testDir: "./tests/doodle-live-browser",
  outputDir: "test-results/doodle-live",
  webServer: servers.map((s) => ({
    ...s,
    command: s.command.replace(
      "pnpm start",
      "node node_modules/next/dist/bin/next start",
    ),
    env: { ...s.env, GLOBAL_DOODLE_ENABLED: "true" },
  })),
});
