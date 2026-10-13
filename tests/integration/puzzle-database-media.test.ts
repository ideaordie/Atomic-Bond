import { beforeEach, afterEach, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
// @ts-expect-error isolated shared fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
const bytes = Buffer.from("89504e470d0a1a0a00000000", "hex");
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140004_puzzle_controlled_access.sql",
      "utf8",
    ),
  );
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610150001_puzzle_database_media.sql",
      "utf8",
    ),
  );
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,$1 from private.puzzle_assets where kind<>'source'",
    [bytes],
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const get = (actor: number, piece: string | null, puzzle?: string) =>
  f.rpc(actor, "puzzle_media_get", [puzzle ?? f.puzzle, piece]);
const reveal = async () =>
  (await f.call(1, "reveal", { revision: 0 })).puzzle.reservation.piece;
it("selects bytes only for own reservation; direct RPC denies foreign, unknown, unrevealed and full image", async () => {
  const id = await reveal();
  expect(Buffer.from((await get(1, id)).content, "base64")).toEqual(bytes);
  expect(await get(2, id)).toEqual({ error: "TILE_DENIED" });
  expect(await get(1, randomUUID())).toEqual({ error: "TILE_DENIED" });
  expect(await get(1, null)).toEqual({ error: "TILE_DENIED" });
  const hidden = (
    await f.exec("select id from private.puzzle_pieces where id<>$1 limit 1", [
      id,
    ])
  ).rows[0].id;
  expect(await get(1, hidden)).toEqual({ error: "TILE_DENIED" });
  await expect(get(-1, id)).rejects.toThrow();
  await expect(
    f.rpc(1, "puzzle_media_put", [randomUUID(), bytes.toString("base64")]),
  ).rejects.toThrow();
});
it("denies expiry with reservation still present and no cleanup; keeps place/move timestamps", async () => {
  const id = await reveal();
  const before = (
    await f.exec(
      "select place_after,move_after from private.puzzle_allowances where atom_id=$1",
      [f.people[1].atom],
    )
  ).rows;
  await f.advance(5);
  expect(await get(1, id)).toEqual({ error: "TILE_DENIED" });
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_reservations where piece_id=$1",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await f.exec(
        "select place_after,move_after from private.puzzle_allowances where atom_id=$1",
        [f.people[1].atom],
      )
    ).rows,
  ).toEqual(before);
});
it("denies cancelled reservation immediately, allows already placed pieces to other owners", async () => {
  const id = await reveal();
  await f.call(1, "cancel", { revision: 1 });
  for (let i = 0; i < 3; i++)
    expect(await get(1, id)).toEqual({ error: "TILE_DENIED" });
  await f.advance(5);
  const next = (await f.call(1, "reveal", { revision: 2 })).puzzle.reservation
    .piece;
  await f.call(1, "place", {
    revision: 3,
    piece: next,
    to: await f.solution(next),
  });
  expect((await get(2, next)).bytes).toBe(bytes.length);
});
it("denies deactivated/deleted/revoked-session owners and disabled gates", async () => {
  const id = await reveal();
  await f.rpc(1, "deactivate_my_account");
  await expect(get(1, id)).rejects.toThrow();
  await f.exec(
    "update public.atoms set status='DELETED',display_name=null,x_handle=null where id=$1",
    [f.people[2].atom],
  );
  await expect(get(2, id)).rejects.toThrow();
  await f.exec("delete from auth.sessions where id=$1", [f.people[3].session]);
  await expect(get(3, id)).rejects.toThrow();
  await f.exec(
    "update private.puzzle_access_settings set public_enabled=false",
  );
  await expect(get(4, id)).rejects.toThrow();
});
it("denies future puzzle and closes full-image access after retention", async () => {
  await f.exec(
    "update private.puzzles set starts_at=starts_at+interval '8 days',ends_at=ends_at+interval '8 days',completed_at=private.puzzle_now()",
  );
  expect(await get(1, null)).toEqual({ error: "TILE_DENIED" });
  await f.advance(8 * 1440);
  expect((await get(1, null)).bytes).toBe(bytes.length);
  await f.advance(37 * 1440);
  expect(await get(1, null)).toEqual({ error: "TILE_DENIED" });
});
it("bounds cleanup and cascades media only after approved retention and Storage acknowledgement", async () => {
  expect((await f.rpc(0, "puzzle_cleanup_batch", [null])).assets).toEqual([]);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_media")).rows[0]
      .n,
  ).toBe(26);
  await f.advance(37 * 1440);
  const plan = await f.rpc(0, "puzzle_cleanup_batch", [null]);
  await expect(
    f.rpc(0, "puzzle_cleanup_batch", [plan.batch]),
  ).rejects.toThrow();
  await f.exec("delete from storage.objects"); // disposable fixture only
  await f.rpc(0, "puzzle_cleanup_batch", [plan.batch]);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_media")).rows[0]
      .n,
  ).toBe(0);
});
it("denies every client table privilege and keeps hardened explicit RPC grants", async () => {
  const result = (
    await f.exec(
      "select has_table_privilege('authenticated','private.puzzle_media','SELECT') s,has_table_privilege('authenticated','private.puzzle_media','INSERT') i,has_function_privilege('anon','public.puzzle_media_get(uuid,uuid)','EXECUTE') a,has_function_privilege('authenticated','public.puzzle_media_get(uuid,uuid)','EXECUTE') e",
    )
  ).rows[0];
  expect(result).toEqual({ s: false, i: false, a: false, e: true });
});
