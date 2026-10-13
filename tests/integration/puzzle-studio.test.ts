import { beforeEach, afterEach, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
// @ts-expect-error isolated shared fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  for (const file of [
    "supabase/candidates/202610140004_puzzle_controlled_access.sql",
    "supabase/migrations/202610150001_puzzle_database_media.sql",
    "supabase/migrations/202610150003_puzzle_scheduled_cleanup.sql",
    "supabase/migrations/202610160001_puzzle_studio.sql",
  ])
    await f.db.exec(await readFile(file, "utf8"));
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets",
  );
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
it("requires live administrator authorization for inventory and full prepared preview with both gates off", async () => {
  const inv = await f.rpc(0, "puzzle_studio", [0]);
  expect(inv.gates).toEqual({ public: false, controlled: false });
  expect(inv.batches).toHaveLength(1);
  expect(inv.batches[0].mediaCount).toBe(27);
  const id = inv.batches[0].id;
  expect((await f.rpc(0, "puzzle_studio_preview", [id])).bytes).toBe(12);
  for (const actor of [-1, 1]) {
    await expect(f.rpc(actor, "puzzle_studio", [0])).rejects.toThrow();
    await expect(f.rpc(actor, "puzzle_studio_preview", [id])).rejects.toThrow();
  }
  await f.rpc(0, "deactivate_my_account");
  await expect(f.rpc(0, "puzzle_studio", [0])).rejects.toThrow();
  await expect(f.rpc(0, "puzzle_studio_preview", [id])).rejects.toThrow();
});
it("paginates all batches without exposing identity, reservations or solution mappings", async () => {
  await f.exec(
    "insert into private.puzzle_batches(id) select gen_random_uuid() from generate_series(1,21)",
  );
  const inv = await f.rpc(0, "puzzle_studio", [0]);
  expect(inv.batches).toHaveLength(20);
  expect((await f.rpc(0, "puzzle_studio", [20])).batches).toHaveLength(2);
  const serialized = JSON.stringify(inv);
  for (const field of [
    "created_by",
    "email",
    "solution",
    "atom_id",
    "reservation",
  ])
    expect(serialized).not.toContain(field);
  await expect(f.rpc(0, "puzzle_studio", [-1])).rejects.toThrow();
});
it("preview rejects incomplete and retiring batches and ordinary users cannot schedule", async () => {
  const inv = await f.rpc(0, "puzzle_studio", [0]),
    id = inv.batches[0].id;
  await f.exec("update private.puzzle_batches set ready=false where id=$1", [
    id,
  ]);
  await expect(f.rpc(0, "puzzle_studio_preview", [id])).rejects.toThrow();
  await f.exec(
    "update private.puzzle_batches set ready=true,retiring=true where id=$1",
    [id],
  );
  await expect(f.rpc(0, "puzzle_studio_preview", [id])).rejects.toThrow();
  await expect(
    f.rpc(1, "puzzle_schedule", [id, new Date().toISOString()]),
  ).rejects.toThrow();
});
