import { expect, test } from "vitest";
import { exploreSource } from "../../src/services/participation/explore-source";

test("production graph composition requires an explicit Atom and never selects the first", async () => {
  const env = {
    ATOMIC_BOND_DATA_MODE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
  };
  for (const id of [undefined, "", "0", "3garbage"]) {
    await expect(exploreSource(env, id)).rejects.toThrow(
      "explicit public Atom number",
    );
  }
});
test("explicit mock mode retains its deterministic starting graph", async () => {
  const first = await exploreSource({ ATOMIC_BOND_DATA_MODE: "mock" });
  expect(await exploreSource({ ATOMIC_BOND_DATA_MODE: "mock" })).toEqual(first);
  expect(first.graph.nodes).toHaveLength(1000);
  expect(first.centerId).toBe(first.graph.nodes[0]?.id);
});
