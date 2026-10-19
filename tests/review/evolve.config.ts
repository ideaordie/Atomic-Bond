import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "evolve.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3140", browserName: "chromium" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
