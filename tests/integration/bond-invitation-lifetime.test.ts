import { afterAll, beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { Transaction } from "@electric-sql/pglite";
// @ts-expect-error shared isolated JavaScript fixture
import { createDoodleFixture } from "../helpers/doodle-fixture.mjs";
const migration =
  "supabase/migrations/202610200001_bond_invitation_24_hours.sql";
const rollback = "docs/operations/ROLLBACK_BOND_INVITATION_24_HOURS.sql";
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture();
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
const duration = (i: { createdAt: string; expiresAt: string }) =>
  Date.parse(i.expiresAt) - Date.parse(i.createdAt);

it("preserves legacy deadlines, tokens, rows and ACLs; rollback affects only future issuance", async () => {
  await f.db.exec(await readFile(rollback, "utf8"));
  const legacy = await f.rpc(1, "create_bond_invitation");
  expect(duration(legacy)).toBe(300000);
  const snapshot = async () =>
    (
      await f.exec(
        "select to_jsonb(i) row from public.bond_invitations i order by id",
      )
    ).rows;
  const rows = await snapshot();
  const acl = async () =>
    (
      await f.exec(
        "select oid::regprocedure::text name,proacl::text,prosecdef,proconfig from pg_proc where oid in ('private.before_deletion_create_bond_invitation()'::regprocedure,'public.create_bond_invitation()'::regprocedure) order by name",
      )
    ).rows;
  const privileges = await acl();
  await f.db.exec(await readFile(migration, "utf8"));
  expect(await snapshot()).toEqual(rows);
  expect(await acl()).toEqual(privileges);
  expect(await f.rpc(1, "create_bond_invitation")).toEqual(legacy);
  const fresh = await f.rpc(2, "create_bond_invitation");
  expect(duration(fresh)).toBe(86400000);
  expect(await f.rpc(2, "create_bond_invitation")).toEqual(fresh);
  await f.db.exec(await readFile(rollback, "utf8"));
  expect(await f.rpc(2, "create_bond_invitation")).toEqual(fresh);
  expect(duration(await f.rpc(3, "create_bond_invitation"))).toBe(300000);
  await f.db.exec(await readFile(migration, "utf8"));
});

it("enforces the exact 24-hour boundary without cleanup and never accepts cancelled/replayed tokens", async () => {
  // Test-only clock substitution: never installed by the production migration.
  await f.db.exec(
    "create table private.invitation_test_clock(t timestamptz); insert into private.invitation_test_clock values(clock_timestamp()); create function private.invitation_test_now() returns timestamptz language sql stable as $$select t from private.invitation_test_clock$$",
  );
  for (const name of [
    "private.before_deletion_create_bond_invitation()",
    "private.before_deletion_accept_bond_invitation(text)",
    "public.resolve_bond_invitation(text)",
  ]) {
    const definition = (
      await f.exec("select pg_get_functiondef($1::regprocedure) def", [name])
    ).rows[0].def;
    await f.db.exec(
      definition.replace(
        /clock_timestamp\(\)|\bnow\(\)/g,
        "private.invitation_test_now()",
      ),
    );
  }
  const a = await f.rpc(4, "create_bond_invitation");
  const b = await f.rpc(5, "create_bond_invitation");
  expect(duration(a)).toBe(86400000);
  // A compensating rollback must still accept an issued 24-hour token after five minutes.
  await f.db.exec(await readFile(rollback, "utf8"));
  await f.exec(
    "update private.invitation_test_clock set t=t+interval '86399.999 seconds'",
  );
  await expect(
    f.rpc(-1, "resolve_bond_invitation", [a.token]),
  ).resolves.toBeTruthy();
  await expect(f.rpc(6, "accept_bond_invitation", [a.token])).resolves.toEqual({
    confirmed: true,
  });
  await f.exec(
    "update private.invitation_test_clock set t=t+interval '0.001 seconds'",
  );
  await expect(
    f.rpc(-1, "resolve_bond_invitation", [b.token]),
  ).rejects.toThrow();
  await expect(f.rpc(7, "accept_bond_invitation", [b.token])).rejects.toThrow();
  await expect(f.rpc(7, "accept_bond_invitation", [a.token])).rejects.toThrow();
  await f.db.exec(await readFile(migration, "utf8"));
  const c = await f.rpc(8, "create_bond_invitation");
  await f.rpc(8, "cancel_bond_invitation", [c.id]);
  await expect(f.rpc(9, "accept_bond_invitation", [c.token])).rejects.toThrow();
  await expect(f.rpc(-1, "create_bond_invitation")).rejects.toThrow();
  await f.db.transaction(async (tx: Transaction) => {
    await tx.exec("set local role authenticated");
    await expect(
      tx.exec(
        "update public.bond_invitations set expires_at=now()+interval '48 hours'",
      ),
    ).rejects.toThrow();
  });
});
