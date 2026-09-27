// Disposable loopback-only PostgreSQL. Never connects to an environment DB URL.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";

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
  await admin.query(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
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
  async function call(user, name, args = []) {
    const client = postgres.getPgClient();
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
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
    2,
  );
  console.log(
    "PASS: concurrent identity creation, activation/number assignment, invitation reuse, single-use acceptance, reversed Bond races, email uniqueness, and restart persistence.",
  );
} finally {
  await admin?.end();
  if (started) await postgres.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw new Error("Unsafe test cleanup path");
  await rm(target, { recursive: true, force: true });
}
