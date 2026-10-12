import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error shared isolated fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
const ids: string[] = [];
beforeAll(async () => {
  f = await createDoodleFixture(undefined, true);
  for (const [a, b] of [
    [1, 2],
    [2, 3],
  ])
    await f.exec(
      "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
      [f.people[a].atom, f.people[b].atom],
    );
  for (let i = 1; i <= 4; i++)
    ids.push(
      await f.rpc(i, "submit_doodle", [randomUUID(), fixtureDrawing(i)]),
    );
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
it("keeps the helper private and returns only existing display fields", async () => {
  const result = await f.exec(
    "select has_function_privilege('authenticated','private.doodle_network_feed(timestamptz,uuid,jsonb)','execute') allowed",
  );
  expect(result.rows[0].allowed).toBe(false);
  const world = await f.rpc(1, "read_doodles");
  const network = await f.rpc(1, "read_network_doodles");
  expect(Object.keys(network.items[0]).sort()).toEqual(
    Object.keys(world.items[0]).sort(),
  );
  expect(JSON.stringify(network)).not.toContain("@example.invalid");
});
it("roots connected feed in verified ownership and includes only own/direct/indirect authors", async () => {
  const read = await f.rpc(1, "read_network_doodles");
  expect(new Set(read.items.map((x: { id: string }) => x.id))).toEqual(
    new Set(ids.slice(0, 3)),
  );
  expect(
    (await f.rpc(4, "read_network_doodles")).items.map(
      (x: { id: string }) => x.id,
    ),
  ).toEqual([ids[3]]);
  expect((await f.rpc(1, "read_doodles")).items).toHaveLength(4);
  expect(
    (await f.rpc(1, "read_network_doodles", [null, null, [ids[3]]])).refreshed,
  ).toEqual([]);
  await expect(f.rpc(-1, "read_network_doodles")).rejects.toThrow();
  await expect(
    f.rpc(1, "read_network_doodles", [null, null, [], f.people[4].atom]),
  ).rejects.toThrow();
  await expect(
    f.rpc(1, "read_network_doodles", [f.people[4].atom]),
  ).rejects.toThrow();
});
it("preserves traversal through deactivated nodes without exposing their artwork", async () => {
  await f.rpc(2, "deactivate_my_account");
  expect(
    new Set(
      (await f.rpc(1, "read_network_doodles")).items.map(
        (x: { id: string }) => x.id,
      ),
    ),
  ).toEqual(new Set([ids[0], ids[2]]));
  await expect(f.rpc(2, "read_network_doodles")).rejects.toThrow();
});
it("revalidates moderation and database expiration in network scope", async () => {
  await f.moderate(ids[2], "REMOVE");
  expect(
    (await f.rpc(1, "read_network_doodles", [null, null, [ids[2]]])).refreshed,
  ).toEqual([]);
  await f.advance(1440);
  expect((await f.rpc(1, "read_network_doodles")).items).toEqual([]);
});
it("keeps Hall of Fame global for disconnected authors", async () => {
  const id = await f.rpc(20, "submit_doodle", [
    randomUUID(),
    fixtureDrawing(20),
  ]);
  for (let i = 21; i < 26; i++) await f.rpc(i, "appreciate_doodle", [id]);
  await f.advance(1440);
  await f.moderate(id, "PROMOTE");
  const world = await f.rpc(1, "read_doodles");
  const network = await f.rpc(1, "read_network_doodles");
  expect(network.hall).toEqual(world.hall);
  expect(network.hall.map((x: { id: string }) => x.id)).toContain(id);
});
