import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

const operation = readFileSync(
  "supabase/maintenance/atom3-to-atom1.sql",
  "utf8",
);
const source = "7475dc94-9eea-47d2-b875-69ee22b36840";
const old = "6ae6eac9-b633-435f-8762-f27b4c3bc7fe";
it("exact maintenance preserves dependencies and aborts changed starting states", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;`);
    for (const f of readdirSync("supabase/migrations").sort())
      await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    await db.exec(`
      insert into public.locations(canonical_key,city,region,country,country_code,display_name)
      values('verification-test','Verification only','Verification only','Verification only','US','Verification only');
      insert into private.atom_numbers select generate_series(1,13);
      select setval('private.atom_number_seq',13);
      insert into public.atoms(id,public_id,status,location_id,created_at)
      select '${old}',1,'DELETED',id,'2026-09-27T03:33:43.808194Z' from public.locations where canonical_key='verification-test';
      insert into public.atoms(public_id,status,location_id)
      select n,'DELETED',id from public.locations cross join unnest(array[2,4,6,8,9,13]) n where canonical_key='verification-test';
      insert into public.atoms(id,location_id,display_name,x_handle)
      select '${source}',id,'Test owner','test_owner' from public.locations where canonical_key='verification-test';
      insert into auth.users values('00000000-0000-0000-0000-000000000003','owner@example.invalid',now());
      insert into private.atom_identities(atom_id,normalized_email,email_verified_at,auth_user_id)
      values('${source}','owner@example.invalid',now(),'00000000-0000-0000-0000-000000000003');
      update public.atoms set public_id=3,status='ACTIVE' where id='${source}';
      insert into private.notification_preferences(atom_id,growth_digest,growth_preference_source) values('${source}','weekly','owner_choice');
      insert into private.signal_administrators(auth_user_id) values('00000000-0000-0000-0000-000000000003');
      insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at)
      select least(id,'${source}'::uuid),greatest(id,'${source}'::uuid),'CONFIRMED',now() from public.atoms where public_id in(4,6,8,9,13);
      insert into public.emotional_pulses(atom_id,emotion) values('${source}','CALM');
      insert into private.growth_state(atom_id,baseline,sent_period) values('${source}','{"connectedAtoms":5,"directBonds":2,"regions":1,"countries":1}','2026-09-28');
    `);
    for (const mutation of [
      `update public.atoms set status='DORMANT' where id='${source}'`,
      `delete from private.signal_administrators`,
      `insert into private.notification_preferences(atom_id) values('${old}')`,
      `delete from public.bonds where id=(select id from public.bonds limit 1)`,
    ]) {
      await db.exec("begin");
      await db.exec(mutation);
      await expect(
        db.exec(operation.replace(/^begin;$/m, "").replace(/^commit;$/m, "")),
      ).rejects.toThrow(/Guard:/);
      await db.exec("rollback");
      expect(
        (
          await db.query(
            `select public_id from public.atoms where id='${source}'`,
          )
        ).rows,
      ).toEqual([{ public_id: 3 }]);
    }
    await expect(
      db.exec(
        operation.replace(
          "alter table public.atoms enable trigger protect_atom;",
          "raise exception 'simulated interruption';",
        ),
      ),
    ).rejects.toThrow("simulated interruption");
    await db.exec("rollback");
    expect(
      (
        await db.query(
          `select public_id from public.atoms where id='${source}'`,
        )
      ).rows,
    ).toEqual([{ public_id: 3 }]);
    expect(
      (
        await db.query(
          "select tgenabled from pg_trigger where tgname='protect_atom'",
        )
      ).rows,
    ).toEqual([{ tgenabled: "O" }]);
    await db.exec(operation);
    expect(
      (
        await db.query(
          `select public_id from public.atoms where id='${source}'`,
        )
      ).rows,
    ).toEqual([{ public_id: 1 }]);
    expect(
      (
        await db.query(
          `select public_id,location_id,status from public.atoms where id='${old}'`,
        )
      ).rows,
    ).toEqual([{ public_id: null, location_id: null, status: "DELETED" }]);
    expect(
      (await db.query("select last_value from private.atom_number_seq")).rows,
    ).toEqual([{ last_value: 13 }]);
    await expect(
      db.exec(`update public.atoms set public_id=3 where id='${source}'`),
    ).rejects.toThrow("Public Atom numbers are permanent");
    await expect(db.exec(operation)).rejects.toThrow("Guard: source changed");
    await db.exec("rollback");
  } finally {
    await db.close();
  }
}, 60000);
