// Isolated synthetic PGlite benchmark. Never reads deployment credentials.
import {
  createDoodleFixture,
  fixtureDrawing,
} from "../tests/helpers/doodle-fixture.mjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const f = await createDoodleFixture(undefined, true);
try {
  for (let i = 1; i < 26; i++)
    await f.rpc(i, "submit_doodle", [randomUUID(), fixtureDrawing(i)]);
  await f.db
    .exec(`insert into private.atom_numbers select generate_series(10000,10999);
 insert into public.atoms(public_id,status) select generate_series(10000,10999),'DELETED';
 insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at)
 select least(a.id,b.id),greatest(a.id,b.id),'CONFIRMED',now() from public.atoms a join public.atoms b on b.public_id=a.public_id+1 where a.public_id between 10000 and 10998;`);
  await f.exec(
    "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) select least(a.id,$1::uuid),greatest(a.id,$1::uuid),'CONFIRMED',now() from public.atoms a where public_id=10000",
    [f.people[1].atom],
  );
  for (let i = 2; i < 26; i++)
    await f.exec(
      "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
      [f.people[1].atom, f.people[i].atom],
    );
  await f.db.exec(
    "analyze public.atoms; analyze public.bonds; analyze private.doodles;",
  );
  const sql = await readFile(
    "supabase/migrations/202610120003_doodle_network_feed.sql",
    "utf8",
  );
  const traversal = sql
    .slice(sql.indexOf("with recursive reach"), sql.indexOf("if cardinality"))
    .trim()
    .replace("a.id=owner", "a.id=$1")
    .replace(" into members", "");
  const plan = await f.exec(
    "explain (analyze,buffers,format json) " + traversal,
    [f.people[1].atom],
  );
  const members = (
    await f.exec("select id from private.reachable($1)", [f.people[1].atom])
  ).rows.map((x) => x.id);
  const feedPlan = await f.exec(
    "explain (analyze,buffers,format json) select d.* from private.doodles d join public.atoms a on a.id=d.atom_id where d.atom_id=any($1::uuid[]) and a.status='ACTIVE' and d.state='PUBLISHED' and d.expires_at>private.doodle_now() order by d.published_at desc,d.id desc limit 21",
    [members],
  );
  const timings = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    const result = await f.rpc(1, "read_network_doodles");
    if (result.items.length !== 20) throw Error("Unexpected page size");
    timings.push(performance.now() - t);
  }
  timings.sort((a, b) => a - b);
  const result = {
    environment: "local PGlite; not hosted latency",
    connectedNodes: members.length,
    drawings: 25,
    pageSize: 20,
    medianMs: timings[10],
    p95Ms: timings[18],
    reachPlan: plan.rows,
    feedPlan: feedPlan.rows,
  };
  await writeFile(
    "artifacts/task123-query-plans.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      connectedNodes: result.connectedNodes,
      medianMs: result.medianMs,
      p95Ms: result.p95Ms,
    }),
  );
} finally {
  await f.db.close();
}
