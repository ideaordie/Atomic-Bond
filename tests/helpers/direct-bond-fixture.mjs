import { createDoodleFixture } from "./doodle-fixture.mjs";
export async function createDirectFixture(db) {
  const f = await createDoodleFixture(db, true, true);
  await f.db.exec(
    `create or replace function private.direct_bond_now() returns timestamptz language sql volatile set search_path='' as $$select t from private.doodle_test_clock$$;`,
  );
  await f.exec("update private.direct_bond_settings set enabled=true");
  // Synthetic star: 0 is a bridge; leaves are indirectly connected. 25 is isolated.
  for (let i = 1; i < 25; i++)
    await f.exec(
      "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
      [f.people[0].atom, f.people[i].atom],
    );
  return {
    ...f,
    request: (owner, op, payload = {}) =>
      f.rpc(owner, "direct_bond_request", [op, JSON.stringify(payload)]),
    target: (i) => ({ target: f.people[i].number }),
  };
}
