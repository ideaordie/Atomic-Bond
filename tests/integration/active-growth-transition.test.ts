import { afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
// @ts-expect-error isolated PostgreSQL fixture
import { createDoodleFixture } from "../helpers/doodle-fixture.mjs";
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
afterAll(async () => {
  await f?.db.close();
});
it("aborts on in-flight delivery, rebases mutable state and cancels prepared work without rewriting history", async () => {
  f = await createDoodleFixture(undefined, true, true, false);
  const atom = f.people[1].atom;
  await f.exec(
    `insert into private.growth_state(atom_id,baseline,sent_period,sent_at) values($1,'{"connectedAtoms":99,"directBonds":3,"regions":4,"countries":2}','2026-01-05','2026-01-06T00:00:00Z')`,
    [atom],
  );
  for (const [period, status] of [
    ["2026-01-05", "accepted"],
    ["2026-01-12", "prepared"],
    ["2026-01-19", "attempted"],
  ])
    await f.exec(
      `insert into private.growth_deliveries(atom_id,period,previous_metrics,current_metrics,recipient,status,unsubscribe_hash,unsubscribe_cipher,lease_until) values($1,$2::text::date,'{"connectedAtoms":3}','{"connectedAtoms":4}','fixture@example.invalid',$3,$2::text,'\\x00',case when $3='attempted' then now()+interval '5 minutes' end)`,
      [atom, period, status],
    );
  const before = (
    await f.exec("select * from private.growth_deliveries order by period")
  ).rows;
  const preserved = async () =>
    (
      await f.exec(`select jsonb_build_object(
    'atoms',(select jsonb_agg(a order by id) from public.atoms a),
    'identities',(select jsonb_agg(i order by atom_id) from private.atom_identities i),
    'numbers',(select jsonb_agg(n order by number) from private.atom_numbers n),
    'preferences',(select jsonb_agg(p order by atom_id) from private.notification_preferences p),
    'bonds',(select jsonb_agg(b order by id) from public.bonds b)
  ) snapshot`)
    ).rows[0].snapshot;
  const original = await preserved();
  const spec = await readFile(
    "supabase/migrations/202610180001_active_network_home_region.sql",
    "utf8",
  );
  await expect(f.db.exec(spec)).rejects.toThrow("in flight");
  await f.db.exec("rollback");
  expect(
    (await f.exec("select * from private.growth_deliveries order by period"))
      .rows,
  ).toEqual(before);
  await f.exec(
    "update private.growth_deliveries set lease_until=null where status='attempted'",
  );
  await f.db.exec(spec);
  expect(await preserved()).toEqual(original);
  const after = (
    await f.exec("select * from private.growth_deliveries order by period")
  ).rows;
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).toEqual({
    ...before[1],
    status: "cancelled",
    lease_until: null,
  });
  expect(after[2]).toEqual({
    ...before[2],
    status: "cancelled",
    lease_until: null,
  });
  const state = (
    await f.exec(
      "select baseline,sent_period,sent_at from private.growth_state where atom_id=$1",
      [atom],
    )
  ).rows[0];
  expect(state.baseline).toEqual({
    connectedAtoms: 0,
    directBonds: 0,
    regions: 0,
    countries: 0,
  });
  expect(state.sent_at).toEqual(new Date("2026-01-06T00:00:00Z"));
}, 60000);
