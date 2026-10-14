import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
// @ts-expect-error isolated PostgreSQL fixture
import { createDoodleFixture } from "../helpers/doodle-fixture.mjs";
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture(undefined, true, true);
  await f.db
    .exec(`insert into private.atom_numbers(number) select generate_series(10000,15000);
 insert into public.atoms(id,location_id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,(select id from public.locations limit 1) from generate_series(10000,15000) n;
 insert into auth.users select id,'benchmark-'||id::text||'@example.invalid',now() from public.atoms where id::text like '10000000-%';
 insert into private.atom_identities(atom_id,auth_user_id,normalized_email,email_verified_at) select id,id,'benchmark-'||id::text||'@example.invalid',now() from public.atoms where id::text like '10000000-%';
 update public.atoms set public_id=right(id::text,12)::bigint,status='ACTIVE' where id::text like '10000000-%';
 insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at)
 select a.id,b.id,'CONFIRMED',now() from public.atoms a join public.atoms b on b.public_id=a.public_id+1 where a.public_id between 10000 and 14999;
 insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at)
 select a.id,b.id,'CONFIRMED',now() from public.atoms a join public.atoms b on b.public_id=a.public_id+2 where a.public_id between 10000 and 14998;
 analyze public.atoms; analyze public.bonds;`);
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
it("fails closed beyond 5000 and bounds cyclic traversal, then splits at an inactive bridge", async () => {
  const root = "10000000-0000-4000-8000-000000010000";
  let start = performance.now();
  const timings: Record<string, number> = {};
  await expect(
    f.exec("select count(*) from private.reachable($1)", [root]),
  ).rejects.toThrow("retrieval limit");
  timings.ceiling5001Ms = Math.round(performance.now() - start);
  console.log(
    `5001-node cyclic ceiling: ${Math.round(performance.now() - start)} ms`,
  );
  await f.exec(
    "update public.atoms set status='DEACTIVATED' where public_id=15000",
  );
  start = performance.now();
  expect(
    (await f.exec("select count(*)::int n from private.reachable($1)", [root]))
      .rows[0].n,
  ).toBe(5000);
  timings.cyclic5000Ms = Math.round(performance.now() - start);
  start = performance.now();
  expect(
    (
      await f.exec(
        "select jsonb_array_length(public.public_graph('10000')->'nodes') n",
      )
    ).rows[0].n,
  ).toBe(5000);
  timings.publicGraph5000Ms = Math.round(performance.now() - start);
  console.log(
    `5000-node cyclic reach: ${Math.round(performance.now() - start)} ms`,
  );
  await f.exec(
    "update public.atoms set status='DORMANT' where public_id in (12500,12501)",
  );
  start = performance.now();
  expect(
    (await f.exec("select count(*)::int n from private.reachable($1)", [root]))
      .rows[0].n,
  ).toBe(2500);
  timings.split2500Ms = Math.round(performance.now() - start);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/task141-performance.json",
    JSON.stringify(timings, null, 2),
  );
  console.log(
    `inactive bridge split: ${Math.round(performance.now() - start)} ms`,
  );
}, 60000);
