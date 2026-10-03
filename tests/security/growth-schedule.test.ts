import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("registers only the protected weekly production evaluation", () => {
  const configuration = JSON.parse(readFileSync("vercel.json", "utf8"));
  expect(configuration.crons).toEqual([
    { path: "/api/growth/run?dryRun=false", schedule: "0 16 * * 2" },
  ]);
});
