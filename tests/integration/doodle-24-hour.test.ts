import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error shared isolated fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture(undefined, true);
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
it("preserves cooldown, permits independent 24-hour drawings, and retries idempotently", async () => {
  const request = randomUUID();
  const first = await f.rpc(1, "publish_doodle", [request, fixtureDrawing(1)]);
  expect(Date.parse(first.expiresAt) - Date.parse(first.publishedAt)).toBe(
    86400000,
  );
  expect(
    await f.rpc(1, "publish_doodle", [request, fixtureDrawing(1)]),
  ).toEqual(first);
  await expect(
    f.rpc(1, "publish_doodle", [randomUUID(), fixtureDrawing(2)]),
  ).rejects.toThrow();
  await f.advance(60);
  const second = await f.rpc(1, "publish_doodle", [
    randomUUID(),
    fixtureDrawing(2),
  ]);
  const feed = await f.rpc(1, "read_doodles");
  expect(feed.items.map((x: { id: string }) => x.id)).toEqual([
    second.id,
    first.id,
  ]);
  expect(Date.parse(feed.nextEligibleAt) - Date.parse(feed.serverTime)).toBe(
    3600000,
  );
  await f.advance(1380);
  const remaining = await f.rpc(2, "read_doodles");
  expect(remaining.items.map((x: { id: string }) => x.id)).toEqual([second.id]);
  await expect(f.rpc(2, "appreciate_doodle", [first.id])).rejects.toThrow();
  await f.rpc(2, "appreciate_doodle", [second.id]);
  const replay = await f.rpc(2, "doodle_replay", [second.id]);
  expect(replay.strokes).toBeNull();
  expect(
    (await f.rpc(0, "doodle_admin_replay", [second.id])).strokes.length,
  ).toBeGreaterThan(0);
});
it("paginates with stable cursors and revalidates displayed content after removal", async () => {
  for (let i = 2; i < 26; i++)
    await f.rpc(i, "submit_doodle", [randomUUID(), fixtureDrawing(i)]);
  const first = await f.rpc(1, "read_doodles");
  expect(first.items).toHaveLength(20);
  expect(first.nextCursor).not.toBeNull();
  const second = await f.rpc(1, "read_doodles", first.nextCursor);
  expect(second.items.length).toBeGreaterThan(0);
  expect(
    new Set([...first.items, ...second.items].map((x: { id: string }) => x.id))
      .size,
  ).toBe(first.items.length + second.items.length);
  const id = first.items[0].id;
  await f.moderate(id, "REMOVE");
  const refresh = await f.rpc(1, "read_doodles", [null, null, [id]]);
  expect(refresh.refreshed).toEqual([]);
  await expect(f.rpc(-1, "read_doodles")).rejects.toThrow();
});
it("removes every drawing on deactivation and never restores old artwork", async () => {
  await f.rpc(1, "deactivate_my_account");
  const feed = await f.rpc(2, "read_doodles");
  expect(
    feed.items.some(
      (x: { atomNumber: string }) =>
        x.atomNumber === String(f.people[1].number),
    ),
  ).toBe(false);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.doodles where atom_id=$1",
        [f.people[1].atom],
      )
    ).rows[0].n,
  ).toBe(0);
});
it("migration preserves existing deadlines, scores and private grants", async () => {
  const old = await createDoodleFixture();
  try {
    const id = await old.rpc(1, "submit_doodle", [
      randomUUID(),
      fixtureDrawing(),
    ]);
    await old.rpc(2, "appreciate_doodle", [id]);
    const before = (
      await old.exec("select expires_at from private.doodles where id=$1", [id])
    ).rows[0];
    const { readFile } = await import("node:fs/promises");
    await old.db.exec(
      await readFile(
        "supabase/migrations/202610120002_doodle_24_hour_feed.sql",
        "utf8",
      ),
    );
    expect(
      (
        await old.exec("select expires_at from private.doodles where id=$1", [
          id,
        ])
      ).rows[0],
    ).toEqual(before);
    expect((await old.rpc(2, "read_doodles")).items[0].score).toBe(1);
    expect(
      (
        await old.exec(
          "select has_function_privilege('authenticated','private.doodle_feed(timestamptz,uuid,jsonb)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await old.advance(60);
    expect((await old.rpc(2, "read_doodles")).items).toEqual([]);
  } finally {
    await old.db.close();
  }
}, 60000);
