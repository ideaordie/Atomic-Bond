import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{unit,graph,integration,security}/**/*.test.{ts,tsx}"],
    clearMocks: true,
  },
});
