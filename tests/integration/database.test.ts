import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import type { NetworkReport } from "../../src/services/admin/network";

let db: PGlite;
const location = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default clock_timestamp());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of readdirSync("supabase/migrations").sort()) {
    if (file.includes("growth_preference_provenance")) {
      await db.exec(`insert into public.atoms(id,location_id)
        select ('00000000-0000-0000-0000-00000000000'||n)::uuid,id from
        (select id from public.locations limit 1) l cross join generate_series(1,3) n;
        insert into private.notification_preferences(atom_id,growth_digest)
        values ('00000000-0000-0000-0000-000000000001','disabled'),
        ('00000000-0000-0000-0000-000000000002','weekly'),
        ('00000000-0000-0000-0000-000000000003','monthly');`);
    }
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file.includes("growth_preference_provenance")) {
      expect(
        (
          await db.query(
            "select growth_digest,growth_preference_source from private.notification_preferences order by atom_id",
          )
        ).rows,
      ).toEqual(
        ["disabled", "weekly", "monthly"].map((growth_digest) => ({
          growth_digest,
          growth_preference_source: "legacy_unknown",
        })),
      );
    }
  }
  await db.query(
    "insert into public.locations(id,canonical_key,city,region,country,country_code,display_name) values($1,'test-place','Test City','Test Region','Test Country','US','Test City, US')",
    [location],
  );
}, 60_000);
afterAll(async () => {
  await db?.close();
});

async function directGrowth(name: string, args: unknown[] = []) {
  return (
    await call(
      `select growth_jobs.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
      null,
      "atomic_bond_growth",
    )
  )[0]!.result as Record<string, unknown> | null;
}

const growth = directGrowth;
async function call(
  sql: string,
  args: unknown[] = [],
  user: string | null = null,
  role = "authenticated",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(deletionClaims.get(user || "") || {}),
    ]);
    return (await tx.query<{ result: unknown }>(sql, args)).rows;
  });
}
const deletionClaims = new Map<string, unknown>();
async function recentAccess(user: string, age = 0) {
  const session = randomUUID();
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    user,
  ]);
  deletionClaims.set(user, {
    session_id: session,
    amr: [{ method: "otp", timestamp: Date.now() / 1000 - age }],
  });
}
async function rpc(
  name: string,
  user: string | null = null,
  args: unknown[] = [],
) {
  return (
    await call(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
      user,
    )
  )[0]!.result as Record<string, unknown>;
}
async function pending(verified = true, email = `${randomUUID()}@example.com`) {
  const user = randomUUID();
  await db.query("insert into auth.users values($1,$2,$3)", [
    user,
    email,
    verified ? new Date().toISOString() : null,
  ]);
  const atom = await rpc("begin_atom", user, [
    location,
    "Alex",
    "@curious_person",
  ]);
  return { user, atom };
}
async function active() {
  const { user } = await pending();
  const atom = await rpc("activate_atom", user);
  return { user, number: atom.publicId as string };
}

describe("migrations and production database invariants", () => {
  it("creates pending identities and assigns permanent bigint numbers only after verified activation", async () => {
    const { user, atom } = await pending(false, "  Person+tag@Example.COM  ");
    expect(atom).toEqual({ status: "PENDING", publicId: null });
    await expect(rpc("activate_atom", user)).rejects.toThrow(
      "Email verification required",
    );
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [user],
    );
    const activated = await rpc("activate_atom", user);
    expect(activated.publicId).toBe("1");
    expect(await rpc("activate_atom", user)).toEqual(activated);
    expect(
      (await rpc("begin_atom", user, [location, "Other", null])).publicId,
    ).toBe("1");
    const id = await internal(user);
    expect(
      (
        await db.query<{ normalized_email: string }>(
          "select normalized_email from private.atom_identities where atom_id=$1",
          [id],
        )
      ).rows[0]!.normalized_email,
    ).toBe("person+tag@example.com");
    await expect(
      db.query("update public.atoms set public_id=null where id=$1", [id]),
    ).rejects.toThrow("permanent");
    await expect(
      db.query("delete from public.atoms where id=$1", [id]),
    ).rejects.toThrow("deletion policy");
    await expect(db.exec("delete from private.atom_numbers")).rejects.toThrow(
      "permanently retired",
    );
    await db.query("update public.atoms set status='DELETED' where id=$1", [
      id,
    ]);
    await expect(rpc("activate_atom", user)).rejects.toThrow("unavailable");
    expect(BigInt((await active()).number)).toBeGreaterThan(1n);
  });
  it("enforces normalized email uniqueness without stripping dots or plus tags", async () => {
    const address = `case.${randomUUID()}+tag@example.com`;
    const first = await pending(true, address);
    await expect(pending(true, ` ${address.toUpperCase()} `)).rejects.toThrow(
      "unique",
    );
    expect(
      (await rpc("begin_atom", first.user, [location, null, null])).status,
    ).toBe("PENDING");
    await expect(
      pending(true, address.replace("+tag", "")),
    ).resolves.toBeDefined();
  });
  it("persists alias, validated X and canonical location; rejects arbitrary URLs and unknown locations", async () => {
    const a = await active();
    const g = await rpc("public_graph", null, [a.number]);
    expect(JSON.stringify(g)).toContain("curious_person");
    expect(JSON.stringify(g)).toContain("Test Region");
    await expect(
      rpc("update_my_atom", a.user, ["Alias", "https://x.com/abc", location]),
    ).rejects.toThrow();
    await expect(
      rpc("update_my_atom", a.user, ["Alias", "abc", randomUUID()]),
    ).rejects.toThrow();
    await rpc("update_my_atom", a.user, ["Changed", "@abc", location]);
    expect(
      JSON.stringify(await rpc("public_graph", null, [a.number])),
    ).toContain("Changed");
  });
  it("reuses the active invitation and stores only its hash plus private encrypted recovery", async () => {
    const a = await active();
    const first = await rpc("create_bond_invitation", a.user);
    const again = await Promise.all(
      Array.from({ length: 8 }, () => rpc("create_bond_invitation", a.user)),
    );
    expect(
      again.every((x) => x.token === first.token && x.id === first.id),
    ).toBe(true);
    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    const row = (
      await db.query<{ hash: string; ciphertext: string }>(
        "select encode(i.token_hash,'hex') as hash,encode(s.ciphertext,'hex') as ciphertext from public.bond_invitations i join private.invitation_secrets s on s.invitation_id=i.id where i.id=$1",
        [first.id],
      )
    ).rows[0]!;
    expect(row.hash).toBe(
      createHash("sha256")
        .update(first.token as string)
        .digest("hex"),
    );
    expect(row.ciphertext).not.toContain(first.token);
    await expect(rpc("resolve_bond_invitation", null, ["bad"])).rejects.toThrow(
      "unavailable",
    );
    await expect(
      rpc("resolve_bond_invitation", null, ["0".repeat(64)]),
    ).rejects.toThrow("unavailable");
    await rpc("cancel_bond_invitation", a.user, [first.id]);
    await expect(
      rpc("resolve_bond_invitation", null, [first.token]),
    ).rejects.toThrow("unavailable");
    const next = await rpc("create_bond_invitation", a.user);
    expect(next.token).not.toBe(first.token);
    await db.query(
      "update public.bond_invitations set created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' where id=$1",
      [next.id],
    );
    await expect(
      rpc("resolve_bond_invitation", null, [next.token]),
    ).rejects.toThrow("unavailable");
    const recipient = await active();
    await expect(
      rpc("accept_bond_invitation", recipient.user, [next.token]),
    ).rejects.toThrow("unavailable");
    expect((await rpc("create_bond_invitation", a.user)).id).not.toBe(next.id);
  });
  it("requires separate verified recipient, confirms atomically and prohibits replay, self and reverse duplicates", async () => {
    const a = await active(),
      b = await active(),
      unverified = await pending(false);
    const invite = await rpc("create_bond_invitation", a.user);
    await expect(
      rpc("accept_bond_invitation", a.user, [invite.token]),
    ).rejects.toThrow("Self");
    await expect(
      rpc("accept_bond_invitation", unverified.user, [invite.token]),
    ).rejects.toThrow("ownership");
    await rpc("accept_bond_invitation", b.user, [invite.token]);
    await expect(
      rpc("accept_bond_invitation", b.user, [invite.token]),
    ).rejects.toThrow("unavailable");
    await expect(
      rpc("resolve_bond_invitation", null, [invite.token]),
    ).rejects.toThrow("unavailable");
    const reverse = await rpc("create_bond_invitation", b.user);
    await expect(
      rpc("accept_bond_invitation", a.user, [reverse.token]),
    ).rejects.toThrow("unique");
    const graph = await rpc("public_graph", null, [a.number]);
    expect((graph.nodes as unknown[]).length).toBe(2);
    expect((graph.edges as unknown[]).length).toBe(1);
    const id = await internal(a.user);
    await expect(
      db.query("insert into public.bonds(atom_a_id,atom_b_id) values($1,$1)", [
        id,
      ]),
    ).rejects.toThrow("check");
    await db.query("update public.atoms set status='DORMANT' where id=$1", [
      id,
    ]);
    expect((await rpc("public_graph", null, [a.number])).nodes).toHaveLength(2);
    await rpc("activate_atom", a.user);
    expect(
      (await rpc("begin_atom", a.user, [location, null, null])).publicId,
    ).toBe(a.number);
  });
  it("excludes pending Bonds and preserves inactive structures without updating activity on public reads", async () => {
    const a = await active(),
      b = await active();
    const ai = await internal(a.user),
      bi = await internal(b.user);
    await db.query(
      "insert into public.bonds(atom_a_id,atom_b_id) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid))",
      [ai, bi],
    );
    const before = (
      await db.query("select last_active_at from public.atoms where id=$1", [
        ai,
      ])
    ).rows;
    expect((await rpc("public_graph", null, [a.number])).edges).toHaveLength(0);
    expect(
      (
        await db.query("select last_active_at from public.atoms where id=$1", [
          ai,
        ])
      ).rows,
    ).toEqual(before);
  });
  it("persists all eight emotions, replaces instead of accumulating history, and gates connected visibility", async () => {
    const a = await active(),
      b = await active(),
      c = await active();
    for (const emotion of [
      "JOY",
      "CALM",
      "EXCITED",
      "CURIOUS",
      "SAD",
      "ANXIOUS",
      "ANGRY",
      "AFRAID",
    ]) {
      const p = await rpc("send_emotional_pulse", a.user, [emotion]);
      expect(p.emotion).toBe(emotion.toLowerCase());
      expect(Number(p.expiresAt) - Number(p.createdAt)).toBe(86_400_000);
    }
    const ai = await internal(a.user);
    expect(
      (
        await db.query(
          "select * from public.emotional_pulses where atom_id=$1",
          [ai],
        )
      ).rows,
    ).toHaveLength(1);
    expect(await rpc("connected_emotional_pulses", b.user)).toHaveLength(0);
    const invitation = await rpc("create_bond_invitation", a.user);
    await rpc("accept_bond_invitation", b.user, [invitation.token]);
    expect(await rpc("connected_emotional_pulses", b.user)).toHaveLength(1);
    expect(await rpc("connected_emotional_pulses", c.user)).toHaveLength(0);
    expect(
      JSON.stringify(await rpc("public_graph", null, [a.number])),
    ).not.toMatch(
      /emotion|email|auth_user|last_active|token|centroid|preferences/,
    );
    await db.query(
      "update public.emotional_pulses set created_at=now()-interval '24 hours',expires_at=now() where atom_id=$1",
      [ai],
    );
    expect(await rpc("connected_emotional_pulses", a.user)).toHaveLength(0);
  });
  it("resolves only the authenticated owner without private identity serialization", async () => {
    const a = await active(),
      b = await active();
    const mine = await rpc("my_atom", a.user),
      theirs = await rpc("my_atom", b.user);
    expect(mine.publicId).toBe(a.number);
    expect(theirs.publicId).toBe(b.number);
    expect(JSON.stringify(mine)).not.toMatch(
      /email|auth_user|notification|token|emotion/,
    );
    await expect(
      call("select public.my_atom()", [], null, "anon"),
    ).rejects.toThrow("permission denied");
    await rpc("update_my_atom", a.user, ["Owner alias", "@owner", location]);
    expect((await rpc("my_atom", a.user)).alias).toBe("Owner alias");
    expect((await rpc("my_atom", b.user)).alias).not.toBe("Owner alias");
  });
  it("denies anonymous/private access and direct mutations even with guessed UUIDs", async () => {
    const a = await active(),
      b = await active();
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "public.atoms",
        "public.bonds",
        "public.bond_invitations",
        "public.emotional_pulses",
        "private.atom_identities",
        "private.notification_preferences",
        "private.invitation_secrets",
        "private.invitation_key",
      ]) {
        await expect(
          call(`select * from ${table}`, [], b.user, role),
        ).rejects.toThrow("permission denied");
        await expect(
          call(`delete from ${table}`, [], b.user, role),
        ).rejects.toThrow("permission denied");
      }
      await expect(
        call(
          "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values($1,$2,'CONFIRMED',now())",
          [await internal(a.user), await internal(b.user)],
          b.user,
          role,
        ),
      ).rejects.toThrow("permission denied");
      await expect(
        call(
          "insert into public.emotional_pulses(atom_id,emotion) values($1,'JOY')",
          [await internal(a.user)],
          b.user,
          role,
        ),
      ).rejects.toThrow("permission denied");
    }
    await expect(
      call("select public.send_emotional_pulse('JOY')", [], null, "anon"),
    ).rejects.toThrow("permission denied");
    await expect(rpc("send_emotional_pulse", null, ["JOY"])).rejects.toThrow(
      "ownership",
    );
    await expect(
      call("select public.connected_emotional_pulses()", [], null, "anon"),
    ).rejects.toThrow("permission denied");
    const invite = await rpc("create_bond_invitation", a.user);
    await expect(
      rpc("cancel_bond_invitation", b.user, [invite.id]),
    ).rejects.toThrow("unavailable");
    // Verify the RLS layer itself still denies rows if a SELECT grant is added.
    await db.exec("grant select on public.atoms to anon, authenticated");
    expect(await call("select * from public.atoms", [], null, "anon")).toEqual(
      [],
    );
    expect(await call("select * from public.atoms", [], b.user)).toEqual([]);
    await db.exec("revoke select on public.atoms from anon, authenticated");
    await rpc("update_notification_preferences", a.user, ["weekly", true]);
    expect(await rpc("my_notification_preferences", a.user)).toEqual({
      transactionalAccess: true,
      growthDigest: "weekly",
      pulseNotifications: true,
    });
    expect(await rpc("my_notification_preferences", b.user)).toEqual({
      transactionalAccess: true,
      growthDigest: "weekly",
      pulseNotifications: false,
    });
  });
});

describe("growth role boundary", () => {
  it("denies all seven pilot RPCs to browser roles and preserves private schema isolation", async () => {
    const signatures = [
      "scan(bigint,integer)",
      "evaluate(bigint,boolean)",
      "reserve(bigint)",
      "claim(uuid)",
      "authorize_send(uuid,uuid,text)",
      "finish(uuid,uuid,boolean)",
      "unsubscribe(text)",
    ];
    for (const signature of signatures) {
      for (const role of ["anon", "authenticated", "atomic_bond_growth"]) {
        const result = await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,$2,'EXECUTE') as allowed",
          [role, `public.growth_${signature}`],
        );
        expect(result.rows[0]!.allowed).toBe(false);
      }
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('service_role',$1,'EXECUTE') as allowed",
            [`public.growth_${signature}`],
          )
        ).rows[0]!.allowed,
      ).toBe(true);
    }
    for (const role of ["anon", "authenticated"]) {
      await expect(
        call("select public.growth_scan(0,10)", [], null, role),
      ).rejects.toThrow();
      await expect(
        call(
          "select public.growth_unsubscribe($1)",
          ["a".repeat(64)],
          null,
          role,
        ),
      ).rejects.toThrow();
    }
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_schema_privilege('service_role','growth_jobs','USAGE') as allowed",
        )
      ).rows[0]!.allowed,
    ).toBe(false);
  });
  it("denies private reads, arbitrary writes, auth modification, unrelated RPCs and role escalation", async () => {
    const denied = [
      "select * from private.atom_identities",
      "select normalized_email from private.atom_identities",
      "update public.atoms set display_name='Bad'",
      "insert into public.bonds default values",
      "update public.bonds set status='CONFIRMED'",
      "delete from public.emotional_pulses",
      "update auth.users set email='bad@example.com'",
      "select public.activate_atom()",
      "select public.update_notification_preferences('weekly',false)",
      "create table public.unapproved_growth_table(id int)",
      "select * from private.growth_deliveries",
    ];
    for (const sql of denied)
      await expect(call(sql, [], null, "atomic_bond_growth")).rejects.toThrow();
    const role = (
      await db.query(
        "select rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname='atomic_bond_growth'",
      )
    ).rows[0];
    expect(Object.values(role!)).toEqual([false, false, false, false, false]);
    for (const roleName of ["anon", "authenticated"])
      await expect(
        call("select growth_jobs.scan()", [], null, roleName),
      ).rejects.toThrow();
  });
  it.each(["dedicated", "rpc"])(
    "%s baselines real confirmed reach, reserves once, preserves failed growth, and scopes unsubscribe",
    async (transport) => {
      const invoke = directGrowth;
      const run = async (name: string, args: unknown[] = []) =>
        transport === "dedicated"
          ? invoke(name, args)
          : ((
              await call(
                `select public.growth_${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
                args,
                null,
                "service_role",
              )
            )[0]!.result as Record<string, unknown> | null);
      const growth = run;
      const a = await active(),
        b = await active();
      expect(await growth("evaluate", [a.number, false])).toEqual({
        outcome: "baseline",
      });
      expect(await growth("evaluate", [a.number, true])).toEqual({
        outcome: "baseline",
      });
      expect(await growth("evaluate", [a.number, true])).toEqual({
        outcome: "no_growth",
      });
      const invitation = await rpc("create_bond_invitation", a.user);
      await rpc("accept_bond_invitation", b.user, [invitation.token]);
      expect(await growth("evaluate", [a.number, false])).toEqual({
        outcome: "would_send",
      });
      const id = await growth("reserve", [a.number]);
      expect(await growth("reserve", [a.number])).toBe(id);
      const delivery = (await growth("claim", [id]))!;
      expect(delivery.current).toMatchObject({
        connectedAtoms: 1,
        directBonds: 1,
        regions: 1,
        countries: 1,
      });
      expect(await growth("claim", [id])).toBeNull();
      expect(
        await growth("authorize_send", [
          id,
          delivery.attemptId,
          "a".repeat(64),
        ]),
      ).toBe(true);
      expect(await growth("finish", [id, delivery.attemptId, false])).toBe(
        true,
      );
      expect(await growth("evaluate", [a.number, false])).toEqual({
        outcome: "would_send",
      });
      await db.query(
        "update private.growth_deliveries set lease_until=now()-interval '1 second' where id=$1",
        [id],
      );
      const retry = (await growth("claim", [id]))!;
      expect(retry.unsubscribeToken).toBe(delivery.unsubscribeToken);
      expect(
        await growth("authorize_send", [id, retry.attemptId, "a".repeat(64)]),
      ).toBe(true);
      expect(await growth("finish", [id, retry.attemptId, true])).toBe(true);
      expect(await growth("evaluate", [a.number, true])).toEqual({
        outcome: "already_sent",
      });
      expect(await growth("reserve", [a.number])).toBeNull();
      expect(await growth("unsubscribe", ["bad"])).toBe(false);
      expect(await growth("unsubscribe", ["0".repeat(64)])).toBe(false);
      expect(await growth("unsubscribe", [delivery.unsubscribeToken])).toBe(
        true,
      );
      expect(await growth("unsubscribe", [delivery.unsubscribeToken])).toBe(
        true,
      );
      expect(await rpc("my_notification_preferences", a.user)).toMatchObject({
        growthDigest: "disabled",
        transactionalAccess: true,
      });
      expect(await rpc("my_notification_preferences", b.user)).toMatchObject({
        growthDigest: "weekly",
      });
      expect(await growth("evaluate", [a.number, true])).toEqual({
        outcome: "disabled",
      });
      await rpc("update_notification_preferences", a.user, ["weekly", false]);
      expect(await growth("evaluate", [a.number, false])).toEqual({
        outcome: "already_sent",
      });
    },
  );
  it("excludes dormant, deleted, unverified and OFF recipients", async () => {
    for (const status of ["DORMANT", "DELETED"]) {
      const a = await active();
      await db.query("update public.atoms set status=$1 where id=$2", [
        status,
        await internal(a.user),
      ]);
      expect(await growth("evaluate", [a.number, false])).toEqual({
        outcome: "ineligible",
      });
    }
    const a = await active();
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [a.user],
    );
    expect(await growth("evaluate", [a.number, false])).toEqual({
      outcome: "ineligible",
    });
  });
});

describe("coarse region migration", () => {
  it("seeds the full canonical catalog without replacing legacy places", async () => {
    const rows = await db.query<{ count: number }>(
      "select count(*)::int as count from public.locations where canonical_key like 'iso3166:%'",
    );
    expect(rows.rows[0]!.count).toBe(3639);
    const legacy = await db.query(
      "select * from public.locations where city='Boynton Beach'",
    );
    expect(legacy.rows).toHaveLength(1);
    const region = await rpc("canonical_location", null, [
      "ab830000-0000-4000-8000-55532d464c00",
    ]);
    expect(region).toMatchObject({
      city: "",
      region: "Florida",
      country: "United States",
      country_code: "US",
      subdivision_code: "US-FL",
    });
  });
  it("persists canonical registration and publishes no city or private identity", async () => {
    const user = randomUUID();
    await db.query("insert into auth.users values($1,$2,now())", [
      user,
      `${user}@example.invalid`,
    ]);
    await rpc("begin_atom", user, [
      "ab830000-0000-4000-8000-55532d464c00",
      "Region test",
      null,
    ]);
    const atom = await rpc("activate_atom", user);
    const graph = await rpc("public_graph", null, [atom.publicId]);
    const nodes = graph.nodes as {
      publicId: string;
      metadata: Record<string, unknown>;
    }[];
    const node = nodes.find((n) => n.publicId === atom.publicId)!;
    expect(node.metadata).toMatchObject({
      region: "Florida",
      countryName: "United States",
      countryCode: "US",
      subdivisionCode: "US-FL",
    });
    expect(node.metadata).not.toHaveProperty("city");
    expect(JSON.stringify(node)).not.toContain("@example.invalid");
  });
  it("defaults only new first activations and preserves explicit OFF and unsubscribe across owner operations", async () => {
    const { user } = await pending();
    const id = await internal(user);
    const preference = async () =>
      (
        await db.query<{
          growth_digest: string;
          growth_preference_source: string;
          transactional_access: boolean;
        }>(
          "select growth_digest,growth_preference_source,transactional_access from private.notification_preferences where atom_id=$1",
          [id],
        )
      ).rows[0]!;
    expect(await preference()).toMatchObject({
      growth_digest: "disabled",
      growth_preference_source: "unset",
    });
    await rpc("activate_atom", user);
    expect(await preference()).toMatchObject({
      growth_digest: "weekly",
      growth_preference_source: "activation_default",
    });
    await rpc("update_notification_preferences", user, ["disabled", false]);
    await rpc("begin_atom", user, [location, null, null]);
    await rpc("activate_atom", user);
    await rpc("update_my_atom", user, ["Changed", null, location]);
    expect(await preference()).toMatchObject({
      growth_digest: "disabled",
      growth_preference_source: "owner_choice",
      transactional_access: true,
    });
    await rpc("update_notification_preferences", user, ["weekly", false]);
    await db.query("select private.unsubscribe_growth($1)", [id]);
    await rpc("activate_atom", user);
    await rpc("update_my_atom", user, ["Changed again", null, location]);
    expect(await preference()).toMatchObject({
      growth_digest: "disabled",
      growth_preference_source: "unsubscribe",
      transactional_access: true,
    });
    await expect(
      call("select private.unsubscribe_growth($1)", [id], null, "anon"),
    ).rejects.toThrow();
    await expect(
      rpc("update_notification_preferences", null, ["weekly", false]),
    ).rejects.toThrow();
    await rpc("update_notification_preferences", user, ["weekly", false]);
    expect(await preference()).toMatchObject({
      growth_digest: "weekly",
      growth_preference_source: "owner_choice",
    });
  });

  it("preserves legacy values and explicit pending preferences at activation", async () => {
    for (const source of ["legacy_unknown", "owner_choice", "unsubscribe"]) {
      for (const digest of source === "unsubscribe"
        ? ["disabled"]
        : ["disabled", "weekly", "monthly"]) {
        const { user } = await pending();
        await db.query(
          "update private.notification_preferences set growth_digest=$1,growth_preference_source=$2 where atom_id=$3",
          [digest, source, await internal(user)],
        );
        await rpc("activate_atom", user);
        expect(await rpc("my_notification_preferences", user)).toMatchObject({
          growthDigest: digest,
          transactionalAccess: true,
        });
      }
    }
  });
});

describe("owner-authorized account deletion", () => {
  it("requires recent real session, deliberate confirmation, and denies public/admin RPC access", async () => {
    const a = await active();
    expect(await rpc("delete_my_account", a.user, ["DELETE"])).toEqual({
      state: "reauthenticate",
    });
    await recentAccess(a.user, 601);
    expect(await rpc("delete_my_account", a.user, ["DELETE"])).toEqual({
      state: "reauthenticate",
    });
    await recentAccess(a.user);
    await expect(
      rpc("delete_my_account", a.user, ["delete"]),
    ).rejects.toThrow();
    await expect(
      call("select public.delete_my_account('DELETE')", [], null, "anon"),
    ).rejects.toThrow();
    await expect(
      rpc("account_cleanup_pending", a.user, [a.user]),
    ).rejects.toThrow();
    await expect(
      call("select * from private.account_deletions", [], a.user),
    ).rejects.toThrow();
    await db.query("delete from auth.sessions where user_id=$1", [a.user]);
    expect(await rpc("delete_my_account", a.user, ["DELETE"])).toEqual({
      state: "reauthenticate",
    });
    expect((await rpc("my_atom", a.user)).status).toBe("ACTIVE");
  });
  it("anonymizes atomically, retains topology/number, removes capabilities and allows a new identity only after Auth cleanup", async () => {
    const a = await active(),
      b = await active(),
      c = await active();
    const id = await internal(b.user);
    const email = (
      await db.query<{ email: string }>(
        "select email from auth.users where id=$1",
        [b.user],
      )
    ).rows[0]!.email;
    for (const [from, to] of [
      [a, b],
      [b, c],
    ] as const) {
      const invite = await rpc("create_bond_invitation", from.user);
      await rpc("accept_bond_invitation", to.user, [invite.token]);
    }
    const invitation = await rpc("create_bond_invitation", b.user);
    await rpc("send_emotional_pulse", b.user, ["CURIOUS"]);
    await recentAccess(b.user);
    const sequence = (
      await db.query("select last_value from private.atom_number_seq")
    ).rows;
    expect(await rpc("delete_my_account", b.user, ["DELETE"])).toMatchObject({
      state: "auth_cleanup_pending",
      publicId: b.number,
    });
    expect(await rpc("delete_my_account", b.user, ["DELETE"])).toEqual({
      state: "auth_cleanup_pending",
    });
    expect(
      (await db.query("select last_value from private.atom_number_seq")).rows,
    ).toEqual(sequence);
    expect(
      (
        await db.query(
          "select status,public_id::text,display_name,x_handle,location_id,last_active_at from public.atoms where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({
      status: "DELETED",
      public_id: b.number,
      display_name: null,
      x_handle: null,
      location_id: null,
      last_active_at: null,
    });
    for (const table of [
      "private.atom_identities",
      "private.notification_preferences",
      "private.growth_state",
      "private.growth_deliveries",
      "public.emotional_pulses",
    ])
      expect(
        (
          await db.query(
            `select count(*)::int n from ${table} where atom_id=$1`,
            [id],
          )
        ).rows[0],
      ).toEqual({ n: 0 });
    expect(await rpc("my_atom", b.user)).toBeNull();
    for (const [name, args] of [
      ["send_emotional_pulse", ["JOY"]],
      ["create_bond_invitation", []],
      ["activate_atom", []],
      ["begin_atom", [location, null, null]],
    ] as const)
      await expect(rpc(name, b.user, [...args])).rejects.toThrow();
    await expect(
      rpc("accept_bond_invitation", c.user, [invitation.token]),
    ).rejects.toThrow();
    const graph = await rpc("public_graph", null, [a.number]);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes).toHaveLength(3);
    const tombstone = (graph.nodes as { publicId: string }[]).find(
      (n) => n.publicId === b.number,
    );
    expect(tombstone).toMatchObject({ status: "DELETED", metadata: {} });
    expect(JSON.stringify(tombstone)).not.toMatch(
      /Alex|curious_person|email|country|location/,
    );
    expect(await rpc("connected_emotional_pulses", a.user)).toEqual([]);
    expect(await growth("evaluate", [b.number, false])).toEqual({
      outcome: "ineligible",
    });
    expect((await rpc("my_atom", a.user)).status).toBe("ACTIVE");
    expect(
      (
        await call(
          "select public.account_cleanup_finish($1) as result",
          [b.user],
          null,
          "service_role",
        )
      )[0]!.result,
    ).toBe(false);
    await db.query("delete from auth.users where id=$1", [b.user]);
    expect(
      (
        await call(
          "select public.account_cleanup_finish($1) as result",
          [b.user],
          null,
          "service_role",
        )
      )[0]!.result,
    ).toBe(true);
    const replacement = await pending(true, email);
    const newAtom = await rpc("activate_atom", replacement.user);
    expect(BigInt(newAtom.publicId as string)).toBeGreaterThan(
      BigInt(b.number),
    );
    expect((await rpc("public_graph", null, [newAtom.publicId])).edges).toEqual(
      [],
    );
    await expect(
      rpc("begin_atom", b.user, [location, null, null]),
    ).rejects.toThrow();
  });
  it("blocks prepared sends after deletion and waits for already authorized provider handoff", async () => {
    for (const authorized of [false, true]) {
      const a = await active(),
        b = await active();
      await growth("evaluate", [a.number, true]);
      const invite = await rpc("create_bond_invitation", a.user);
      await rpc("accept_bond_invitation", b.user, [invite.token]);
      const job = await growth("reserve", [a.number]);
      const delivery = (await growth("claim", [job]))!;
      await recentAccess(a.user);
      if (authorized) {
        expect(
          await growth("authorize_send", [
            job,
            delivery.attemptId,
            "a".repeat(64),
          ]),
        ).toBe(true);
        expect(await rpc("delete_my_account", a.user, ["DELETE"])).toEqual({
          state: "delivery_in_progress",
        });
        expect((await rpc("my_atom", a.user)).status).toBe("ACTIVE");
        await growth("finish", [job, delivery.attemptId, true]);
      }
      expect(await rpc("delete_my_account", a.user, ["DELETE"])).toMatchObject({
        state: "auth_cleanup_pending",
      });
      expect(
        await growth("authorize_send", [
          job,
          delivery.attemptId,
          "a".repeat(64),
        ]),
      ).toBe(false);
      expect(await growth("claim", [job])).toBeNull();
      expect(await growth("unsubscribe", [delivery.unsubscribeToken])).toBe(
        false,
      );
    }
  });
});

describe("reversible account lifecycle", () => {
  it("accepts same-second verified new sessions but never revives a pre-deactivation JWT", async () => {
    const a = await active();
    await recentAccess(a.user);
    const oldClaims = deletionClaims.get(a.user);
    await rpc("deactivate_my_account", a.user);
    await expect(rpc("reactivate_my_account", a.user)).rejects.toThrow();
    await recentAccess(a.user);
    const seconds = (
      await db.query<{ seconds: string }>(
        "select floor(extract(epoch from authenticated_after))::text seconds from private.account_lifecycle where atom_id=(select id from public.atoms where public_id=$1)",
        [a.number],
      )
    ).rows[0]!.seconds;
    const fresh = deletionClaims.get(a.user) as {
      session_id: string;
      amr: Array<{ method: string; timestamp: number }>;
    };
    fresh.amr[0]!.timestamp = Number(seconds);
    expect(await rpc("reactivate_my_account", a.user)).toMatchObject({
      state: "active",
      publicId: a.number,
    });
    deletionClaims.set(a.user, oldClaims);
    expect(await rpc("my_atom", a.user)).toBeNull();
    await expect(
      rpc("send_emotional_pulse", a.user, ["JOY"]),
    ).rejects.toThrow();
  });
  it("cancels prepared delivery permanently, excludes private regions, resets genuine intervening growth, and preserves same-email uniqueness", async () => {
    const a = await active(),
      b = await active(),
      c = await active();
    await recentAccess(a.user);
    await recentAccess(b.user);
    await growth("evaluate", [a.number, true]);
    const invite = await rpc("create_bond_invitation", a.user);
    await rpc("accept_bond_invitation", b.user, [invite.token]);
    const job = await growth("reserve", [a.number]);
    expect(job).toBeTypeOf("string");
    await rpc("deactivate_my_account", a.user);
    expect(await growth("claim", [job])).toBeNull();
    expect(
      (
        await db.query(
          "select status from private.growth_deliveries where id=$1",
          [job],
        )
      ).rows,
    ).toEqual([{ status: "cancelled" }]);
    const owned = (
      await db.query<{ normalized_email: string }>(
        "select normalized_email from private.atom_identities where auth_user_id=$1",
        [a.user],
      )
    ).rows[0]!;
    await expect(pending(true, owned.normalized_email)).rejects.toThrow();
    const next = await rpc("create_bond_invitation", b.user);
    await rpc("accept_bond_invitation", c.user, [next.token]);
    const graph = await rpc("public_graph", null, [a.number]);
    expect(graph.nodes).toHaveLength(3);
    const state = await rpc("reactivate_my_account", b.user);
    expect(state.publicId).toBe(b.number); // A different owner cannot target a.
    expect(
      (
        await db.query("select status from public.atoms where public_id=$1", [
          a.number,
        ])
      ).rows,
    ).toEqual([{ status: "DEACTIVATED" }]);
    await expect(
      call("select public.reactivate_my_account() as result", [], null, "anon"),
    ).rejects.toThrow();
    await expect(
      call("select * from private.account_lifecycle", [], a.user),
    ).rejects.toThrow();
    await expect(
      call(
        "select public.reactivate_my_account() as result",
        [],
        null,
        "atomic_bond_growth",
      ),
    ).rejects.toThrow();
    await db.query(
      "update private.account_lifecycle set authenticated_after=now()-interval '2 seconds' where atom_id=(select id from public.atoms where public_id=$1)",
      [a.number],
    );
    await recentAccess(a.user);
    await rpc("reactivate_my_account", a.user);
    expect(await growth("evaluate", [a.number, false])).toMatchObject({
      outcome: "no_growth",
    });
    expect(await growth("claim", [job])).toBeNull();
    expect(
      (
        await db.query(
          "select baseline->>'connectedAtoms' n from private.growth_state where atom_id=(select id from public.atoms where public_id=$1)",
          [a.number],
        )
      ).rows,
    ).toEqual([{ n: "2" }]);
  });
  it("preserves identity, profile, Bonds and preference; hides public data and requires explicit freshly authenticated return", async () => {
    const a = await active(),
      b = await active();
    await recentAccess(a.user);
    const invite = await rpc("create_bond_invitation", a.user);
    await rpc("accept_bond_invitation", b.user, [invite.token]);
    await rpc("send_emotional_pulse", a.user, ["CURIOUS"]);
    const stale = await rpc("create_bond_invitation", a.user);
    await growth("evaluate", [a.number, true]);
    const before = await rpc("my_atom", a.user);
    const prefs = await rpc("my_notification_preferences", a.user);
    const sequence = (
      await db.query("select last_value from private.atom_number_seq")
    ).rows;
    const bonds = (await db.query("select * from public.bonds order by id"))
      .rows;
    await expect(rpc("deactivate_my_account")).rejects.toThrow();
    expect(await rpc("deactivate_my_account", a.user)).toMatchObject({
      state: "deactivated",
      publicId: a.number,
    });
    expect(await rpc("my_atom", a.user)).toBeNull();
    await expect(rpc("reactivate_my_account", a.user)).rejects.toThrow();
    await expect(
      rpc("send_emotional_pulse", a.user, ["JOY"]),
    ).rejects.toThrow();
    await expect(
      rpc("accept_bond_invitation", b.user, [stale.token]),
    ).rejects.toThrow();
    expect(await growth("evaluate", [a.number, false])).toMatchObject({
      outcome: "ineligible",
    });
    const graph = await rpc("public_graph", null, [a.number]);
    const node = (graph.nodes as Array<Record<string, unknown>>).find(
      (n) => n.publicId === a.number,
    )!;
    expect(node).toMatchObject({ status: "DEACTIVATED", metadata: {} });
    expect(node.displayName ?? null).toBeNull();
    expect(node.xHandle ?? null).toBeNull();
    expect(JSON.stringify(graph)).not.toContain("@example.com");
    // Move only the isolated test cutoff back to model later verified access.
    await db.query(
      "update private.account_lifecycle set authenticated_after=now()-interval '2 seconds' where atom_id=(select id from public.atoms where public_id=$1)",
      [a.number],
    );
    await recentAccess(a.user);
    expect(await rpc("my_atom", a.user)).toEqual({
      ...before,
      status: "DEACTIVATED",
    });
    await expect(rpc("activate_atom", a.user)).rejects.toThrow(
      "Explicit reactivation",
    );
    expect(await rpc("deactivate_my_account", a.user)).toMatchObject({
      state: "deactivated",
    });
    await expect(rpc("create_bond_invitation", a.user)).rejects.toThrow();
    expect(await rpc("reactivate_my_account", a.user)).toMatchObject({
      state: "active",
      publicId: a.number,
    });
    expect(await rpc("my_atom", a.user)).toEqual(before);
    expect(await rpc("my_notification_preferences", a.user)).toEqual(prefs);
    expect(await rpc("connected_emotional_pulses", a.user)).toEqual([]);
    expect(await growth("evaluate", [a.number, false])).toMatchObject({
      outcome: "no_growth",
    });
    const state = (
      await db.query(
        "select * from private.growth_state where atom_id=(select id from public.atoms where public_id=$1)",
        [a.number],
      )
    ).rows;
    await rpc("reactivate_my_account", a.user);
    expect(
      (
        await db.query(
          "select * from private.growth_state where atom_id=(select id from public.atoms where public_id=$1)",
          [a.number],
        )
      ).rows,
    ).toEqual(state);
    expect(
      (await db.query("select * from public.bonds order by id")).rows,
    ).toEqual(bonds);
    expect(
      (await db.query("select last_value from private.atom_number_seq")).rows,
    ).toEqual(sequence);
    await expect(
      rpc("accept_bond_invitation", b.user, [stale.token]),
    ).rejects.toThrow();
    await rpc("send_emotional_pulse", a.user, ["CALM"]);
    expect(await rpc("connected_emotional_pulses", a.user)).toHaveLength(1);
  });
  it("preserves explicit OFF and permits permanent deletion without reactivation", async () => {
    const a = await active();
    await recentAccess(a.user);
    await rpc("update_notification_preferences", a.user, ["disabled", false]);
    await rpc("deactivate_my_account", a.user);
    await db.query(
      "update private.account_lifecycle set authenticated_after=now()-interval '2 seconds' where atom_id=(select id from public.atoms where public_id=$1)",
      [a.number],
    );
    await recentAccess(a.user);
    await rpc("reactivate_my_account", a.user);
    expect(await rpc("my_notification_preferences", a.user)).toMatchObject({
      growthDigest: "disabled",
    });
    await rpc("deactivate_my_account", a.user);
    await db.query(
      "update private.account_lifecycle set authenticated_after=now()-interval '2 seconds' where atom_id=(select id from public.atoms where public_id=$1)",
      [a.number],
    );
    await recentAccess(a.user);
    expect(await rpc("delete_my_account", a.user, ["DELETE"])).toMatchObject({
      state: "auth_cleanup_pending",
    });
    await expect(rpc("reactivate_my_account", a.user)).rejects.toThrow();
    expect(
      (
        await db.query("select status from public.atoms where public_id=$1", [
          a.number,
        ])
      ).rows,
    ).toEqual([{ status: "DELETED" }]);
  });
});
async function internal(user: string) {
  return (
    await db.query<{ atom_id: string }>(
      "select atom_id from private.atom_identities where auth_user_id=$1",
      [user],
    )
  ).rows[0]!.atom_id;
}

describe("Network Signal database authorization and scheduling", () => {
  it("protects membership, drafts and publication and exposes only active display data", async () => {
    const admin = await active(),
      ordinary = await active();
    await recentAccess(admin.user);
    await recentAccess(ordinary.user);
    await db.query("select private.provision_signal_administrator($1,true)", [
      admin.number,
    ]);
    expect(await rpc("signal_admin_history", admin.user)).toEqual([]);
    for (const user of [null, ordinary.user]) {
      await expect(rpc("signal_admin_history", user)).rejects.toThrow();
      await expect(
        rpc("save_signal_draft", user, [
          null,
          "COMMUNITY",
          "Title",
          "Message",
          null,
          null,
          null,
          null,
        ]),
      ).rejects.toThrow();
      await expect(
        rpc("publish_network_signal", user, [randomUUID(), null]),
      ).rejects.toThrow();
      await expect(
        rpc("end_network_signal", user, [randomUUID()]),
      ).rejects.toThrow();
    }
    await expect(
      call("select * from private.signal_administrators", [], ordinary.user),
    ).rejects.toThrow();
    await expect(
      call(
        "select private.provision_signal_administrator($1,true)",
        [ordinary.number],
        ordinary.user,
      ),
    ).rejects.toThrow();
    await expect(
      call(
        "insert into private.signal_administrators(auth_user_id) values($1)",
        [ordinary.user],
        ordinary.user,
      ),
    ).rejects.toThrow();
    await expect(rpc("current_network_signal")).rejects.toThrow();
    const draftArgs = [
      null,
      "ATOMIC_BOND",
      "Test title",
      "Test message",
      null,
      null,
      null,
      null,
    ];
    const id = await rpc("save_signal_draft", admin.user, draftArgs);
    expect(await rpc("current_network_signal", ordinary.user)).toBeNull();
    await expect(
      rpc("save_signal_draft", ordinary.user, [id, ...draftArgs.slice(1)]),
    ).rejects.toThrow();
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,bad",
      "file:///x",
      "https://user:pass@example.com",
      "https://example.com\\bad",
    ])
      await expect(
        rpc("save_signal_draft", admin.user, [
          null,
          "COMMUNITY",
          "Test",
          "Test",
          "Visit",
          url,
          null,
          null,
        ]),
      ).rejects.toThrow();
    await rpc("publish_network_signal", admin.user, [id, null]);
    const display = await rpc("current_network_signal", ordinary.user);
    expect(Object.keys(display).sort()).toEqual(
      [
        "id",
        "type",
        "title",
        "message",
        "linkLabel",
        "linkUrl",
        "publishedAt",
        "startsAt",
        "endsAt",
      ].sort(),
    );
    const second = await rpc("save_signal_draft", admin.user, draftArgs);
    await expect(
      rpc("publish_network_signal", admin.user, [second, null]),
    ).rejects.toThrow(/overlaps/);
    await rpc("publish_network_signal", admin.user, [second, id]);
    expect((await rpc("current_network_signal", ordinary.user)).id).toBe(
      second,
    );
    await rpc("end_network_signal", admin.user, [second]);
    const future = await rpc("save_signal_draft", admin.user, [
      null,
      "COMMUNITY",
      "Later",
      "Later",
      null,
      null,
      new Date(Date.now() + 3600000).toISOString(),
      new Date(Date.now() + 7200000).toISOString(),
    ]);
    await rpc("publish_network_signal", admin.user, [future, null]);
    expect(await rpc("current_network_signal", ordinary.user)).toBeNull();
    const overlap = await rpc("save_signal_draft", admin.user, [
      null,
      "COMMUNITY",
      "Overlap",
      "Overlap",
      null,
      null,
      new Date(Date.now() + 4000000).toISOString(),
      null,
    ]);
    await expect(
      rpc("publish_network_signal", admin.user, [overlap, null]),
    ).rejects.toThrow(/overlaps/);
    await db.query(
      "update private.network_signals set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",
      [future],
    );
    expect(await rpc("current_network_signal", ordinary.user)).toBeNull();
    await expect(
      rpc("save_signal_draft", admin.user, [
        null,
        "SPONSORED",
        "Ad",
        "Ad",
        null,
        null,
        null,
        null,
      ]),
    ).rejects.toThrow();
    const sponsored = randomUUID();
    await db.query(
      "insert into private.network_signals(id,type,title,message) values($1,'SPONSORED','Reserved','Disabled')",
      [sponsored],
    );
    await expect(
      rpc("publish_network_signal", admin.user, [sponsored, null]),
    ).rejects.toThrow();
    await rpc("deactivate_my_account", admin.user);
    await recentAccess(admin.user);
    await expect(rpc("signal_admin_history", admin.user)).rejects.toThrow();
    await expect(rpc("current_network_signal", admin.user)).rejects.toThrow();
    await rpc("delete_my_account", admin.user, ["DELETE"]);
    await db.query("delete from auth.users where id=$1", [admin.user]);
    expect(
      (
        await db.query(
          "select count(*)::int n from private.signal_administrators where auth_user_id=$1",
          [admin.user],
        )
      ).rows[0],
    ).toEqual({ n: 0 });
  });
});

describe("read-only administrator connected groups", () => {
  it("protects access and computes current components without claiming history or changing data", async () => {
    const admin = await active(),
      ordinary = await active();
    await recentAccess(admin.user);
    await recentAccess(ordinary.user);
    await db.query("select private.provision_signal_administrator($1,true)", [
      admin.number,
    ]);
    for (const user of [null, ordinary.user]) {
      await expect(rpc("admin_network_report", user)).rejects.toThrow();
    }
    await expect(
      call("select public.admin_network_report()", [], null, "anon"),
    ).rejects.toThrow();
    const read = async () =>
      (await rpc(
        "admin_network_report",
        admin.user,
      )) as unknown as NetworkReport;
    const a = await active(),
      b = await active(),
      c = await active(),
      d = await active();
    const ids = await Promise.all([a, b, c, d].map((x) => internal(x.user)));
    const hiddenPlace = randomUUID();
    await db.query(
      "insert into public.locations(id,canonical_key,city,region,country,country_code,display_name) values($1,'admin-private-test','','Hidden Region','Hidden Country','ZZ','Hidden Region')",
      [hiddenPlace],
    );
    await db.query("update public.atoms set location_id=$1 where id=$2", [
      hiddenPlace,
      ids[1],
    ]);
    const bond = async (left: string, right: string, confirmed = true) => {
      await db.query(
        "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),$3::public.bond_status,$4)",
        [
          left,
          right,
          confirmed ? "CONFIRMED" : "PENDING",
          confirmed ? "2026-09-30T12:00:00Z" : null,
        ],
      );
    };
    let report = await read();
    expect(report.isolatedAtoms).toEqual(
      expect.arrayContaining([a.number, b.number, c.number, d.number]),
    );
    const baseGroups = report.connectedGroups,
      baseOrganic = report.organicGroups;
    await bond(ids[1]!, ids[0]!); // reversed representation is the same undirected edge
    await bond(ids[2]!, ids[3]!);
    await bond(ids[0]!, ids[2]!, false); // pending does not merge components
    report = await read();
    expect(report.connectedGroups).toBe(baseGroups + 2);
    expect(report.organicGroups).toBe(baseOrganic + 2);
    expect(
      report.groups.find((g) => g.publicNumbers.includes(a.number)),
    ).toMatchObject({ atomCount: 2, bondCount: 1, founding: false });
    await db.query(
      "delete from public.bonds where status='PENDING' and atom_a_id=least($1::uuid,$2::uuid) and atom_b_id=greatest($1::uuid,$2::uuid)",
      [ids[0], ids[2]],
    );
    await bond(ids[0]!, ids[2]!); // organic -> organic current-state merge
    report = await read();
    expect(report.connectedGroups).toBe(baseGroups + 1);
    expect(
      report.groups.find((g) => g.publicNumbers.includes(a.number)),
    ).toMatchObject({ atomCount: 4, bondCount: 3 });
    await recentAccess(b.user);
    await rpc("deactivate_my_account", b.user);
    await recentAccess(c.user);
    await rpc("delete_my_account", c.user, ["DELETE"]);
    report = await read();
    expect(
      report.groups.find((g) => g.publicNumbers.includes(a.number)),
    ).toMatchObject({
      atomCount: 4,
      activeAtomCount: 2,
      bondCount: 3,
      regions: 1,
      countries: 1,
    });
    const founder = (
      await db.query<{ id: string }>(
        "select id from public.atoms where public_id=1",
      )
    ).rows[0]!;
    const beforeFounding = report.foundingNetwork!;
    await bond(ids[3]!, founder.id); // organic -> founding current-state merge
    report = await read();
    expect(report.foundingNetwork!.atomCount).toBe(
      beforeFounding.atomCount + 4,
    );
    expect(report.foundingNetwork!.bondCount).toBe(
      beforeFounding.bondCount + 4,
    );
    expect(report.organicGroups).toBe(baseOrganic);
    const all = report.groups.flatMap((g) => g.publicNumbers);
    expect(new Set(all).size).toBe(all.length);
    expect(report.historyAvailable).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(
      /email|auth_user|display_name|x_handle|emotion|preference|location_id/i,
    );
    expect(Object.keys(report).sort()).toEqual(
      [
        "generatedAt",
        "activeAtoms",
        "confirmedBonds",
        "connectedGroups",
        "organicGroups",
        "isolatedAtoms",
        "largestGroup",
        "foundingNetwork",
        "groups",
        "historyAvailable",
      ].sort(),
    );
    // The actual RPC runs successfully inside a database-enforced read-only transaction.
    await db.transaction(async (tx) => {
      await tx.exec("set transaction read only; set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        admin.user,
      ]);
      await tx.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(deletionClaims.get(admin.user)),
      ]);
      expect(
        (await tx.query("select public.admin_network_report() result")).rows,
      ).toHaveLength(1);
    });
    expect(
      (
        await db.query(
          "select provolatile from pg_proc where oid='public.admin_network_report()'::regprocedure",
        )
      ).rows,
    ).toEqual([{ provolatile: "s" }]);
    await rpc("deactivate_my_account", admin.user);
    await expect(read()).rejects.toThrow();
    await recentAccess(admin.user);
    await expect(read()).rejects.toThrow();
    await rpc("reactivate_my_account", admin.user);
    expect((await read()).historyAvailable).toBe(false);
    await rpc("delete_my_account", admin.user, ["DELETE"]);
    await expect(read()).rejects.toThrow();
  });
});
