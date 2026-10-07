import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
it("additive Pulse migration preserves all legacy rows, timestamps, constraints and privileges", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default clock_timestamp());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files.filter((f) => !f.includes("expanded_pulse")))
      await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into public.atoms(id,location_id) select '00000000-0000-0000-0000-000000000104',id from public.locations limit 1;insert into public.emotional_pulses(atom_id,emotion) values('00000000-0000-0000-0000-000000000104','AFRAID');`,
    );
    const before = (await db.query("select * from public.emotional_pulses"))
      .rows;
    for (const f of files.filter((f) => f.includes("expanded_pulse"))) {
      await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
      expect(
        (await db.query("select * from public.emotional_pulses")).rows,
      ).toEqual(before);
    }
    expect(
      (
        await db.query(
          "select enum_range(null::public.emotion)::text as values",
        )
      ).rows[0],
    ).toMatchObject({ values: expect.stringContaining("UNDER_THE_WEATHER") });
    for (const role of ["anon", "authenticated"]) {
      expect(
        (
          await db.query(
            `select has_table_privilege('${role}','public.emotional_pulses','SELECT') as allowed`,
          )
        ).rows[0],
      ).toEqual({ allowed: false });
      expect(
        (
          await db.query(
            `select has_function_privilege('${role}','private.before_deletion_send_emotional_pulse(public.emotion)','EXECUTE') as allowed`,
          )
        ).rows[0],
      ).toEqual({ allowed: false });
    }
    expect(
      (
        await db.query(
          "select relrowsecurity as enabled from pg_class where oid='public.emotional_pulses'::regclass",
        )
      ).rows[0],
    ).toEqual({ enabled: true });
  } finally {
    await db.close();
  }
}, 60000);
