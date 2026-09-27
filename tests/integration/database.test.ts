import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";

let db: PGlite;
const location = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query(
    "insert into public.locations(id,canonical_key,city,region,country,country_code,display_name) values($1,'test-place','Test City','Test Region','Test Country','US','Test City, US')",
    [location],
  );
}, 60_000);
afterAll(async () => {
  await db?.close();
});

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
    return (await tx.query<{ result: unknown }>(sql, args)).rows;
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
async function internal(user: string) {
  return (
    await db.query<{ atom_id: string }>(
      "select atom_id from private.atom_identities where auth_user_id=$1",
      [user],
    )
  ).rows[0]!.atom_id;
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
      growthDigest: "disabled",
      pulseNotifications: false,
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
});
