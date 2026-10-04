// Disposable loopback-only PostgreSQL. Never connects to an environment DB URL.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { Client } from "pg";

const root = resolve("artifacts/database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(`${root}${sep}postgres-`);
const listener = createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password: randomBytes(32).toString("hex"),
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let started = false,
  admin;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  await admin.query(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await admin.query(await readFile(`supabase/migrations/${file}`, "utf8"));
  const location = randomUUID();
  await admin.query(
    "insert into public.locations(id,canonical_key,city,region,country,country_code,display_name) values($1,'concurrency-test','Test','Test','Test','US','Test')",
    [location],
  );
  const deletionClaims = new Map();
  async function call(user, name, args = []) {
    const client = postgres.getPgClient();
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(deletionClaims.get(user) || {}),
      ]);
      const result = await client.query(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
        args,
      );
      await client.query("commit");
      return result.rows[0].result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      await client.end();
    }
  }
  async function user() {
    const id = randomUUID();
    await admin.query("insert into auth.users values($1,$2,now())", [
      id,
      `${id}@example.com`,
    ]);
    return id;
  }
  async function active() {
    const id = await user();
    await call(id, "begin_atom", [location, null, null]);
    await call(id, "activate_atom");
    return id;
  }
  const same = await user();
  await Promise.all(
    Array.from({ length: 12 }, () =>
      call(same, "begin_atom", [location, "Concurrent", "@test"]),
    ),
  );
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as count from private.atom_identities where auth_user_id=$1",
        [same],
      )
    ).rows[0].count,
    1,
  );
  const activation = await Promise.all(
    Array.from({ length: 12 }, () => call(same, "activate_atom")),
  );
  assert.equal(new Set(activation.map((a) => a.publicId)).size, 1);
  const users = [];
  for (let i = 0; i < 12; i++) users.push(await user());
  await Promise.all(
    users.map(async (id) => {
      await call(id, "begin_atom", [location, null, null]);
      await call(id, "activate_atom");
    }),
  );
  const numbers = (
    await admin.query("select public_id::text from public.atoms")
  ).rows.map((r) => r.public_id);
  assert.equal(new Set(numbers).size, 13);
  const invitations = await Promise.all(
    Array.from({ length: 12 }, () => call(same, "create_bond_invitation")),
  );
  assert.equal(new Set(invitations.map((i) => i.token)).size, 1);
  const acceptance = await Promise.allSettled(
    users.map((u) => call(u, "accept_bond_invitation", [invitations[0].token])),
  );
  assert.equal(acceptance.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await admin.query("select count(*)::int as count from public.bonds"))
      .rows[0].count,
    1,
  );
  const a = await active(),
    b = await active();
  const [ia, ib] = await Promise.all([
    call(a, "create_bond_invitation"),
    call(b, "create_bond_invitation"),
  ]);
  const reversed = await Promise.allSettled([
    call(a, "accept_bond_invitation", [ib.token]),
    call(b, "accept_bond_invitation", [ia.token]),
  ]);
  assert.equal(reversed.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await admin.query("select count(*)::int as count from public.bonds"))
      .rows[0].count,
    2,
  );
  const collisionEmail = `${randomUUID()}@example.com`,
    u1 = await user(),
    u2 = await user();
  await admin.query("update auth.users set email=$1 where id=any($2::uuid[])", [
    collisionEmail,
    [u1, u2],
  ]);
  const duplicateIdentity = await Promise.allSettled([
    call(u1, "begin_atom", [location, null, null]),
    call(u2, "begin_atom", [location, null, null]),
  ]);
  assert.equal(
    duplicateIdentity.filter((r) => r.status === "fulfilled").length,
    1,
  );
  // Real restricted LOGIN sessions, not an administrator-side role simulation.
  const growthPassword = randomBytes(32).toString("hex");
  await admin.query(
    `alter role atomic_bond_growth password '${growthPassword}'`,
  );
  async function worker(sql, args = []) {
    const client = new Client({
      host: "127.0.0.1",
      port,
      database: "postgres",
      user: "atomic_bond_growth",
      password: growthPassword,
    });
    await client.connect();
    try {
      return await client.query(sql, args);
    } finally {
      await client.end();
    }
  }
  assert.equal(
    (await worker("select current_user as role")).rows[0].role,
    "atomic_bond_growth",
  );
  for (const sql of [
    "select * from private.atom_identities",
    "select normalized_email from private.atom_identities",
    "update public.atoms set display_name='bad'",
    "insert into public.bonds default values",
    "update public.bonds set status='CONFIRMED'",
    "delete from public.emotional_pulses",
    "update auth.users set email='bad@example.com'",
    "select public.activate_atom()",
    "set role postgres",
    "select * from private.growth_deliveries",
  ])
    await assert.rejects(worker(sql));
  const g = await active(),
    h = await active();
  const number = (
    await admin.query(
      "select a.public_id::text as n from public.atoms a join private.atom_identities i on i.atom_id=a.id where i.auth_user_id=$1",
      [g],
    )
  ).rows[0].n;
  await worker("select growth_jobs.evaluate($1,true)", [number]);
  const gi = await call(g, "create_bond_invitation");
  await call(h, "accept_bond_invitation", [gi.token]);
  const reservations = await Promise.all(
    Array.from({ length: 4 }, () =>
      worker("select growth_jobs.reserve($1) as id", [number]),
    ),
  );
  const job = reservations[0].rows[0].id;
  assert.equal(new Set(reservations.map((r) => r.rows[0].id)).size, 1);
  const claims = await Promise.all(
    Array.from({ length: 4 }, () =>
      worker("select growth_jobs.claim($1) as result", [job]),
    ),
  );
  assert.equal(claims.filter((r) => r.rows[0].result).length, 1);
  const claim = claims.find((r) => r.rows[0].result).rows[0].result;
  await worker("select growth_jobs.authorize_send($1,$2,$3)", [
    job,
    claim.attemptId,
    "a".repeat(64),
  ]);
  await worker("select growth_jobs.finish($1,$2,true)", [job, claim.attemptId]);
  // Restart verifies durability, not just an in-process cache.
  await admin.end();
  admin = undefined;
  await postgres.stop();
  started = false;
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  assert.equal(
    (await admin.query("select count(*)::int as count from public.bonds"))
      .rows[0].count,
    3,
  );
  assert.equal(
    (await worker("select growth_jobs.reserve($1) as id", [number])).rows[0].id,
    null,
  );
  // Real PostgreSQL sessions exercise concurrent deletion against owner/job writes.
  for (const mode of ["pulse", "bond", "digest"]) {
    const owner = await active(),
      peer = await active();
    const session = randomUUID();
    await admin.query("insert into auth.sessions values($1,$2)", [
      session,
      owner,
    ]);
    deletionClaims.set(owner, {
      session_id: session,
      amr: [{ method: "otp", timestamp: Date.now() / 1000 }],
    });
    const atom = (
      await admin.query(
        "select atom_id from private.atom_identities where auth_user_id=$1",
        [owner],
      )
    ).rows[0].atom_id;
    const n = (
      await admin.query(
        "select public_id::text n from public.atoms where id=$1",
        [atom],
      )
    ).rows[0].n;
    const invitation = await call(owner, "create_bond_invitation");
    let job, delivery;
    if (mode === "digest") {
      await worker("select growth_jobs.evaluate($1,true)", [n]);
      await call(peer, "accept_bond_invitation", [invitation.token]);
      job = (await worker("select growth_jobs.reserve($1) id", [n])).rows[0].id;
      delivery = (await worker("select growth_jobs.claim($1) result", [job]))
        .rows[0].result;
    }
    const results = await Promise.allSettled([
      call(owner, "delete_my_account", ["DELETE"]),
      mode === "pulse"
        ? call(owner, "send_emotional_pulse", ["CURIOUS"])
        : mode === "bond"
          ? call(peer, "accept_bond_invitation", [invitation.token])
          : worker("select growth_jobs.authorize_send($1,$2,$3) allowed", [
              job,
              delivery.attemptId,
              "a".repeat(64),
            ]),
      call(owner, "delete_my_account", ["DELETE"]),
    ]);
    for (const index of [0, 2])
      assert.equal(results[index].status, "fulfilled");
    if (mode === "digest") {
      const authorization = results[1];
      if (
        authorization.status === "fulfilled" &&
        authorization.value.rows[0].allowed
      ) {
        assert.equal(
          (
            await admin.query("select status from public.atoms where id=$1", [
              atom,
            ])
          ).rows[0].status,
          "ACTIVE",
        );
        await worker("select growth_jobs.finish($1,$2,false)", [
          job,
          delivery.attemptId,
        ]);
        await call(owner, "delete_my_account", ["DELETE"]);
      }
      assert.equal(
        (
          await worker("select growth_jobs.authorize_send($1,$2,$3) allowed", [
            job,
            delivery.attemptId,
            "a".repeat(64),
          ])
        ).rows[0].allowed,
        false,
      );
    }
    assert.equal(
      (await admin.query("select status from public.atoms where id=$1", [atom]))
        .rows[0].status,
      "DELETED",
    );
    assert.equal(
      (
        await admin.query(
          "select count(*)::int n from public.emotional_pulses where atom_id=$1",
          [atom],
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(call(owner, "send_emotional_pulse", ["JOY"]));
    await assert.rejects(
      call(peer, "accept_bond_invitation", [invitation.token]),
    );
    assert.equal(
      (await call(owner, "delete_my_account", ["DELETE"])).state,
      "auth_cleanup_pending",
    );
  }
  console.log(
    "PASS: concurrent deletion/Pulse/Bond/provider-authorization/repeated deletion invariants.",
  );
  console.log(
    "PASS: identity/Bond concurrency, dedicated growth LOGIN denial checks, overlapping growth reservations/claims, and restart-persistent idempotency.",
  );
} finally {
  await admin?.end();
  if (started) await postgres.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw new Error("Unsafe test cleanup path");
  // Windows can briefly retain the stopped PostgreSQL directory handle.
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
