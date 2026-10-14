import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error isolated PostgreSQL fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture(undefined, true, true);
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
const location = async (code: string) =>
  (
    await f.exec("select id from public.locations where canonical_key=$1", [
      `iso3166:${code}`,
    ])
  ).rows[0].id;
it("updates canonical country/subdivision only for the verified ACTIVE owner, preserving profile and identity", async () => {
  const before = (
    await f.exec("select * from public.atoms where id=$1", [f.people[1].atom])
  ).rows[0];
  const region = await location("US-FL");
  await f.rpc(1, "update_my_home_region", [region]);
  const after = (
    await f.exec("select * from public.atoms where id=$1", [f.people[1].atom])
  ).rows[0];
  expect(after).toEqual({
    ...before,
    location_id: region,
    updated_at: after.updated_at,
  });
  await f.rpc(1, "update_my_home_region", [await location("AQ")]);
  await expect(f.rpc(-1, "update_my_home_region", [region])).rejects.toThrow();
  await expect(
    f.rpc(1, "update_my_home_region", [randomUUID()]),
  ).rejects.toThrow();
  await expect(
    f.rpc(1, "update_my_home_region", [region, f.people[2].atom]),
  ).rejects.toThrow();
  expect((await f.rpc(2, "my_atom")).locationId).not.toBe(region);
  for (const state of ["DORMANT", "DEACTIVATED", "DELETED"]) {
    await f.exec("update public.atoms set status=$1 where id=$2", [
      state,
      f.people[3].atom,
    ]);
    await expect(f.rpc(3, "update_my_home_region", [region])).rejects.toThrow();
    expect(
      (
        await f.exec("select status from public.atoms where id=$1", [
          f.people[3].atom,
        ])
      ).rows[0].status,
    ).toBe(state);
  }
});
it("legacy profile saves cannot change Home Region, including stale and arbitrary location arguments", async () => {
  const region = await location("US-FL");
  await f.rpc(1, "update_my_home_region", [region]);
  await f.rpc(1, "update_my_atom", ["Alias", "test_handle", randomUUID()]);
  expect(await f.rpc(1, "my_atom")).toMatchObject({
    locationId: region,
    alias: "Alias",
    xHandle: "test_handle",
  });
  const denied = (
    await f.exec(
      "select has_function_privilege('authenticated','private.before_deletion_update_my_atom(text,text,uuid)','execute') allowed",
    )
  ).rows[0];
  expect(denied.allowed).toBe(false);
});
it("splits and restores graph, Pulse, Doodle and growth reach without changing Bond IDs", async () => {
  const people = [4, 5, 6];
  for (const [a, b] of [
    [4, 5],
    [5, 6],
  ])
    await f.exec(
      "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
      [f.people[a].atom, f.people[b].atom],
    );
  const bonds = (await f.exec("select * from public.bonds order by id")).rows;
  await f.rpc(6, "send_emotional_pulse", ["JOY"]);
  const drawing = await f.rpc(6, "submit_doodle", [
    randomUUID(),
    fixtureDrawing(6),
  ]);
  const graph = () => f.rpc(4, "public_graph", [f.people[4].number]);
  expect((await graph()).nodes).toHaveLength(3);
  expect(await f.rpc(4, "connected_emotional_pulses")).toHaveLength(1);
  for (const state of ["DORMANT", "DEACTIVATED"]) {
    await f.exec("update public.atoms set status=$1 where id=$2", [
      state,
      f.people[5].atom,
    ]);
    expect((await graph()).nodes).toHaveLength(1);
    expect((await graph()).edges).toEqual([]);
    expect(await f.rpc(4, "public_graph", [f.people[5].number])).toEqual({
      nodes: [],
      edges: [],
    });
    expect(await f.rpc(4, "connected_emotional_pulses")).toEqual([]);
    expect((await f.rpc(4, "read_network_doodles")).items).toEqual([]);
    expect(
      (await f.rpc(4, "read_doodles")).items.map((d: { id: string }) => d.id),
    ).toContain(drawing);
    expect(
      (
        await f.exec("select private.growth_metrics($1) metrics", [
          f.people[4].atom,
        ])
      ).rows[0].metrics.connectedAtoms,
    ).toBe(0);
  }
  await f.exec("update public.atoms set status='ACTIVE' where id=$1", [
    f.people[5].atom,
  ]);
  expect((await graph()).nodes).toHaveLength(people.length);
  expect((await f.rpc(4, "read_network_doodles")).items).toHaveLength(1);
  expect((await f.exec("select * from public.bonds order by id")).rows).toEqual(
    bonds,
  );
  expect(
    (await f.rpc(0, "admin_network_report")).groups.find(
      (g: { atomCount: number }) => g.atomCount === 3,
    ),
  ).toBeTruthy();
  await f.exec("update public.atoms set status='DELETED' where id=$1", [
    f.people[5].atom,
  ]);
  expect((await graph()).nodes).toHaveLength(1);
  expect(await f.rpc(4, "public_graph", [f.people[5].number])).toEqual({
    nodes: [],
    edges: [],
  });
  await expect(
    f.exec("update public.atoms set status='ACTIVE' where id=$1", [
      f.people[5].atom,
    ]),
  ).rejects.toThrow();
});
