// Isolated negative build: prove Next rejects the real adapter in a client tree.
// Never connects to Supabase or reads local credential files.
import { mkdir, mkdtemp, copyFile, writeFile, symlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve("artifacts/client-boundary");
await mkdir(root, { recursive: true });
const fixture = await mkdtemp(join(root, "probe-"));
await mkdir(join(fixture, "app"));
await mkdir(join(fixture, "src/data/growth"), { recursive: true });
await mkdir(join(fixture, "src/services/growth"), { recursive: true });
await mkdir(join(fixture, "src/services/auth"), { recursive: true });
await mkdir(join(fixture, "src/data/supabase"), { recursive: true });
for (const path of [
  "src/services/auth/account-removal.ts",
  "src/data/supabase/config.ts",
])
  await copyFile(path, join(fixture, path));
await copyFile(
  "src/data/growth/store.ts",
  join(fixture, "src/data/growth/store.ts"),
);
await copyFile(
  "src/services/growth/contracts.ts",
  join(fixture, "src/services/growth/contracts.ts"),
);
await symlink(
  resolve("node_modules"),
  join(fixture, "node_modules"),
  "junction",
);
await writeFile(
  join(fixture, "package.json"),
  JSON.stringify({ private: true }),
);
await writeFile(join(fixture, "next.config.mjs"), "export default {};");
await writeFile(
  join(fixture, "app/layout.jsx"),
  "export default function Layout({children}) { return <html><body>{children}</body></html> }",
);
await writeFile(
  join(fixture, "app/page.jsx"),
  '"use client"; import {growthStore} from "../src/data/growth/store"; import {accountRemovalAdapter} from "../src/services/auth/account-removal"; export default function Page(){return <button onClick={()=>{growthStore.scan("0",1); accountRemovalAdapter()}}>Probe</button>}',
);
const result = spawnSync(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "build", fixture, "--webpack"],
  {
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_GROWTH_SECRET_KEY: "sb_secret_boundary_fixture_only",
    },
  },
);
const output = (result.stdout || "") + (result.stderr || "");
assert.notEqual(result.status, 0, "Client import unexpectedly compiled");
assert.match(output, /server-only/);
assert.match(output, /only available in Server Components|Client Component/);
assert.match(output, /app\/page.jsx/);
assert.match(output, /account-removal/);
console.log(
  "PASS: Next rejects privileged growth and Auth deletion adapters in a client component.",
);
