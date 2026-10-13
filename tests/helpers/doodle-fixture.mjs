// Isolated synthetic database only. Never reads environment credentials.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function createDoodleFixture(
  suppliedDb,
  next = false,
  sevenDays = false,
) {
  const db = suppliedDb ?? new PGlite({ extensions: { pgcrypto } });
  const exec = async (sql, args = []) => db.query(sql, args);
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default clock_timestamp());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for (const f of (await readdir("supabase/migrations"))
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.startsWith("202610140001") &&
        !f.startsWith("202610140002") &&
        (next || !/^20261012000[23]/.test(f)) &&
        (sevenDays || !f.startsWith("202610130001")),
    )
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    "update private.doodle_settings set submissions_paused=false, public_access=true",
  ); // Isolated test intake only.
  // Controlled clock is deliberately outside the candidate SQL and only in this fixture.
  await db.exec(`create table private.doodle_test_clock(t timestamptz);insert into private.doodle_test_clock values(clock_timestamp());
 create or replace function private.doodle_now() returns timestamptz language sql volatile set search_path='' as $$select t from private.doodle_test_clock$$;`);
  const people = [];
  async function rpc(index, name, args = []) {
    if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid fixture operation");
    const p = people[index];
    const wrapped = name.includes("doodle");
    const result = await db.transaction(async (tx) => {
      await tx.exec(`set local role ${p ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        p?.user ?? "",
      ]);
      await tx.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(
          p
            ? {
                session_id: p.session,
                amr: [{ method: "otp", timestamp: Date.now() / 1000 }],
              }
            : {},
        ),
      ]);
      return (
        await tx.query(
          `select public.${wrapped ? "doodle_request($1,$2::jsonb)" : `${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})`} as result`,
          wrapped ? [name, JSON.stringify(args)] : args,
        )
      ).rows[0].result;
    });
    if (wrapped && result.error) throw new Error(result.error);
    return wrapped ? result.data : result;
  }
  const location = (await exec("select id from public.locations limit 1"))
    .rows[0].id;
  for (let i = 0; i < 26; i++) {
    const user = randomUUID(),
      session = randomUUID();
    await exec("insert into auth.users values($1,$2,clock_timestamp())", [
      user,
      `fixture-${i}@example.invalid`,
    ]);
    await exec("insert into auth.sessions(id,user_id) values($1,$2)", [
      session,
      user,
    ]);
    people.push({ user, session });
    await rpc(i, "begin_atom", [location, null, null]);
    const a = await rpc(i, "activate_atom");
    people[i].number = a.publicId;
    people[i].atom = (
      await exec(
        "select atom_id from private.atom_identities where auth_user_id=$1",
        [user],
      )
    ).rows[0].atom_id;
  }
  await exec(
    "insert into private.signal_administrators(auth_user_id) values($1)",
    [people[0].user],
  );
  async function advance(minutes) {
    await exec(
      "update private.doodle_test_clock set t=t+($1*interval '1 minute')",
      [minutes],
    );
  }
  async function moderate(id, action) {
    let args = [],
      d;
    do {
      const q = await rpc(0, "doodle_admin_queue", args);
      d = q.items.find((item) => item.id === id);
      if (d || q.items.length < 25) break;
      const last = q.items.at(-1);
      args = [last.submittedAt, last.id];
    } while (!d);
    if (!d) throw new Error("No reviewable fixture");
    return rpc(0, "moderate_doodle", [id, action, d.fingerprint]);
  }
  return { db, exec, people, rpc, advance, moderate };
}

export function fixtureDrawing(seed = 0) {
  const bits = Buffer.alloc(512);
  const points = [];
  for (let y = 16; y < 48; y++)
    for (let x = 16; x < 48; x++)
      if ((x + y + seed) % 7 === 0 || x === 16 || y === 47) {
        const p = y * 64 + x;
        points.push(p);
        bits[p >> 3] |= 1 << (p % 8);
      }
  return {
    version: 1,
    bitmap: bits.toString("base64"),
    strokes: [{ draw: true, points }],
  };
}

export async function seedDoodleReview(f, lifetime = 60) {
  const winners = [];
  for (let i = 1; i <= 10; i++) {
    const id = await f.rpc(i, "submit_doodle", [
      randomUUID(),
      fixtureDrawing(i),
    ]);

    for (let voter = 11; voter < 16 + (i % 3); voter++)
      await f.rpc(voter, "appreciate_doodle", [id]);
    winners.push(id);
  }
  await f.advance(lifetime);
  for (const id of winners) await f.moderate(id, "PROMOTE");
  const live = await f.rpc(11, "submit_doodle", [
    randomUUID(),
    fixtureDrawing(22),
  ]);

  for (let voter = 12; voter < 20; voter++)
    await f.rpc(voter, "appreciate_doodle", [live]);
  await f.rpc(12, "submit_doodle", [randomUUID(), fixtureDrawing(25)]);
  return { live };
}
