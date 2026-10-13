import { afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
// @ts-expect-error shared isolated fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;

let f: Awaited<ReturnType<typeof createDoodleFixture>>;
const migration =
  "supabase/migrations/202610130001_doodle_seven_day_lifetime.sql";
const week = 10080;
beforeEach(async () => {
  f = await createDoodleFixture(undefined, true, true);
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const publish = (owner: number) =>
  f.rpc(owner, "publish_doodle", [randomUUID(), fixtureDrawing(owner)]);
const row = async (id: string) =>
  (await f.exec("select * from private.doodles where id=$1", [id])).rows[0];
const cleanup = () => f.exec("select private.cleanup_doodles(500)");

it("preserves every legacy row and existing function ACL while changing only future lifetimes", async () => {
  const legacy = await createDoodleFixture(undefined, true);
  try {
    const key = randomUUID(),
      drawing = fixtureDrawing();
    const old = await legacy.rpc(1, "publish_doodle", [key, drawing]);
    await legacy.rpc(2, "appreciate_doodle", [old.id]);
    const snapshot = () =>
      legacy.exec("select to_jsonb(d) d from private.doodles d order by id");
    const before = (await snapshot()).rows;
    const acl = () =>
      legacy.exec(
        "select proacl::text,proowner,prosecdef,proconfig from pg_proc where oid='public.submit_doodle(uuid,jsonb)'::regprocedure",
      );
    const privileges = (await acl()).rows;
    await legacy.db.exec(await readFile(migration, "utf8"));
    expect((await snapshot()).rows).toEqual(before);
    expect((await acl()).rows).toEqual(privileges);
    expect(await legacy.rpc(1, "publish_doodle", [key, drawing])).toEqual(old);
    const fresh = await legacy.rpc(3, "publish_doodle", [
      randomUUID(),
      drawing,
    ]);
    expect(Date.parse(fresh.expiresAt) - Date.parse(fresh.publishedAt)).toBe(
      168 * 3600000,
    );
    await legacy.advance(1440);
    expect(
      (await legacy.rpc(2, "read_doodles")).items.map(
        (d: { id: string }) => d.id,
      ),
    ).toEqual([fresh.id]);
    await expect(
      legacy.rpc(4, "appreciate_doodle", [old.id]),
    ).rejects.toThrow();
  } finally {
    await legacy.db.close();
  }
}, 60000);

it("keeps hourly cooldown, multiple live drawings and idempotent deadlines", async () => {
  const key = randomUUID(),
    drawing = fixtureDrawing();
  const first = await f.rpc(1, "publish_doodle", [key, drawing]);
  expect(Date.parse(first.expiresAt) - Date.parse(first.publishedAt)).toBe(
    604800000,
  );
  await f.advance(59.999);
  await expect(publish(1)).rejects.toThrow();
  await f.advance(0.001);
  const second = await publish(1);
  expect(await f.rpc(1, "publish_doodle", [key, drawing])).toMatchObject({
    id: first.id,
    publishedAt: first.publishedAt,
    expiresAt: first.expiresAt,
  });
  expect(
    (await f.rpc(2, "read_doodles")).items.map((d: { id: string }) => d.id),
  ).toEqual([second.id, first.id]);
  await f.advance(week - 60);
  expect(
    (await f.rpc(2, "read_doodles")).items.map((d: { id: string }) => d.id),
  ).toEqual([second.id]);
});

it("enforces the exact seven-day boundary in both scopes and voting without waiting for cleanup", async () => {
  await f.exec(
    "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
    [f.people[1].atom, f.people[2].atom],
  );
  const live = await publish(1),
    unrelated = await publish(3);
  await f.advance(1440);
  await cleanup();
  expect((await row(live.id)).state).toBe("PUBLISHED");
  await f.rpc(2, "appreciate_doodle", [live.id]);
  expect(await f.rpc(2, "appreciate_doodle", [live.id])).toBe(false);
  await expect(f.rpc(1, "appreciate_doodle", [live.id])).rejects.toThrow();
  await f.advance(week - 1440 - 1 / 60);
  expect((await f.rpc(2, "read_doodles")).items).toHaveLength(2);
  expect(
    (await f.rpc(2, "read_network_doodles")).items.map(
      (d: { id: string }) => d.id,
    ),
  ).toEqual([live.id]);
  await f.rpc(4, "appreciate_doodle", [live.id]);
  await f.advance(1 / 60);
  // Deliberately no finalization/cleanup: stored PUBLISHED cannot defeat time checks.
  expect((await row(live.id)).state).toBe("PUBLISHED");
  for (const op of ["read_doodles", "read_network_doodles"]) {
    const result = await f.rpc(2, op, [null, null, [live.id, unrelated.id]]);
    expect(result.items).toEqual([]);
    expect(result.refreshed).toEqual([]);
  }
  await expect(f.rpc(5, "appreciate_doodle", [live.id])).rejects.toThrow();
  await expect(f.rpc(2, "doodle_replay", [live.id])).rejects.toThrow();
  await cleanup();
  expect(await row(live.id)).toBeUndefined();
});

it("freezes five-vote candidates at expiration and preserves the full private review window", async () => {
  const candidate = await publish(1),
    promoted = await publish(2),
    ordinary = await publish(3);
  for (let voter = 4; voter < 9; voter++)
    for (const id of [candidate.id, promoted.id])
      await f.rpc(voter, "appreciate_doodle", [id]);
  await f.advance(week - 1 / 60);
  await cleanup();
  expect((await row(candidate.id)).final_score).toBeNull();
  await expect(f.moderate(candidate.id, "PROMOTE")).rejects.toThrow();
  await f.advance(1 / 60);
  await cleanup();
  const frozen = await row(candidate.id);
  expect(frozen.state).toBe("CANDIDATE");
  expect(frozen.final_score).toBe(5);
  expect(Date.parse(frozen.purge_at) - Date.parse(frozen.expires_at)).toBe(
    604800000,
  );
  expect(await row(ordinary.id)).toBeUndefined();
  expect((await f.rpc(4, "read_doodles")).hall).toEqual([]);
  await expect(f.rpc(9, "appreciate_doodle", [candidate.id])).rejects.toThrow();
  await expect(
    f.exec("update private.doodles set final_score=6 where id=$1", [
      candidate.id,
    ]),
  ).rejects.toThrow();
  await f.advance(week - 1 / 60);
  await cleanup();
  expect((await row(candidate.id)).state).toBe("CANDIDATE");
  expect(
    (await f.rpc(0, "doodle_admin_replay", [candidate.id])).strokes.length,
  ).toBeGreaterThan(0);
  await f.moderate(promoted.id, "PROMOTE");
  await f.advance(1 / 60);
  await cleanup();
  expect(await row(candidate.id)).toBeUndefined();
  expect((await row(promoted.id)).state).toBe("HALL");
  await f.advance(week * 2);
  await cleanup();
  expect(
    (await f.rpc(4, "read_doodles")).hall.map((d: { id: string }) => d.id),
  ).toEqual([promoted.id]);
});

it("delayed cleanup anchors candidate retention to expiry, not the cleanup run", async () => {
  const live = await publish(1);
  for (let i = 2; i < 7; i++) await f.rpc(i, "appreciate_doodle", [live.id]);
  await f.advance(week + 1440);
  await cleanup();
  const candidate = await row(live.id);
  expect(
    Date.parse(candidate.purge_at) - Date.parse(candidate.expires_at),
  ).toBe(604800000);
  await f.advance(week - 1440);
  await cleanup();
  expect(await row(live.id)).toBeUndefined();
});

it("moderation and deactivation still remove seven-day artwork immediately", async () => {
  const first = await publish(1);
  await f.advance(60);
  const second = await publish(1);
  await f.moderate(first.id, "REMOVE");
  expect(
    (await f.rpc(2, "read_doodles")).items.map((d: { id: string }) => d.id),
  ).toEqual([second.id]);
  await f.rpc(1, "deactivate_my_account");
  expect((await f.rpc(2, "read_doodles")).items).toEqual([]);
  expect(await row(first.id)).toBeUndefined();
  expect(await row(second.id)).toBeUndefined();
});
