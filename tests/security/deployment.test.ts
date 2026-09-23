import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("deployment publication boundaries", () => {
  it("ships only blank future environment placeholders", () => {
    const entries = readFileSync(".env.example", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"));
    expect(entries).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL=",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
      "RESEND_API_KEY=",
      "LOCATION_PROVIDER_API_KEY=",
    ]);
  });

  it("keeps review captures and sensitive files out of public assets", () => {
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      });
    expect(
      walk("public/references").filter((path) => !path.endsWith(".gitkeep")),
    ).toEqual([]);
    expect(
      walk("public").filter((path) =>
        /(?:\.env|\.pem$|\.key$|\.webm$|\.log$)/i.test(path),
      ),
    ).toEqual([]);
  });
});
