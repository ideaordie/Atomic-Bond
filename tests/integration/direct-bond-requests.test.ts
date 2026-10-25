import { beforeEach, afterEach, it, expect } from "vitest";
// @ts-expect-error isolated fixture
import { createDirectFixture } from "../helpers/direct-bond-fixture.mjs";
let f: Awaited<ReturnType<typeof createDirectFixture>>;
beforeEach(async () => {
  f = await createDirectFixture();
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const send = (from = 1, to = 2) => f.request(from, "create", f.target(to));
it("binds requests, retries once, hides self/direct/inaccessible and isolates inboxes", async () => {
  for (const target of [0, 1, 25])
    await expect(send(1, target)).rejects.toThrow();
  await expect(send(26, 2)).rejects.toThrow();
  const r = await send();
  expect((await send()).id).toBe(r.id);
  expect((await f.request(1, "list")).items).toHaveLength(1);
  expect((await f.request(2, "list")).items).toHaveLength(1);
  expect((await f.request(3, "list")).items).toHaveLength(0);
  for (const op of ["accept", "decline", "dismiss"])
    await expect(f.request(1, op, { id: r.id })).rejects.toThrow();
  await expect(f.request(2, "cancel", { id: r.id })).rejects.toThrow();
  expect((await f.request(2, "accept", { id: r.id })).replayed).toBe(false);
  expect((await f.request(2, "accept", { id: r.id })).replayed).toBe(true);
  expect(
    (await f.exec("select count(*)::int n from public.bonds")).rows[0].n,
  ).toBe(25);
});
it("claims notice once; NOT NOW retains pending and does not decline", async () => {
  const r = await send();
  expect((await f.request(2, "notice")).notice).toBe(r.id);
  expect((await f.request(2, "notice")).notice).toBeNull();
  await f.request(2, "dismiss", { id: r.id });
  expect((await f.request(2, "list")).items).toHaveLength(1);
  await f.request(2, "accept", { id: r.id });
});
it("enforces exact expiry without cleanup and preserves seven-day deadline on retry", async () => {
  const r = await send();
  const first = (await f.request(1, "list")).items[0].expiresAt;
  await f.advance(60);
  await send();
  expect((await f.request(1, "list")).items[0].expiresAt).toBe(first);
  await f.advance(7 * 1440 - 60);
  await expect(f.request(2, "accept", { id: r.id })).rejects.toThrow();
  expect((await f.request(2, "list")).items).toHaveLength(0);
});
it("decline has a thirty-day cooldown; cancellation has no extra pair restriction", async () => {
  const r = await send();
  await f.request(2, "decline", { id: r.id });
  await expect(send()).rejects.toThrow();
  await f.advance(30 * 1440);
  const next = await send();
  await f.request(1, "cancel", { id: next.id });
  await expect(f.request(2, "accept", { id: next.id })).rejects.toThrow();
  expect((await send()).id).not.toBe(next.id);
});
it("enforces five rolling daily and ten outstanding, including cancelled attempts", async () => {
  for (let i = 2; i <= 6; i++) await send(1, i);
  await expect(send(1, 7)).rejects.toThrow(/Daily/);
  await f.advance(1440);
  for (let i = 7; i <= 11; i++) await send(1, i);
  await f.advance(1440);
  await expect(send(1, 12)).rejects.toThrow(/Outstanding/);
  const r = (await f.request(1, "list")).items[0];
  await f.request(1, "cancel", { id: r.id });
  await send(1, 12);
});
it("opt-out cancels pending; opt-in does not restore; inaccessible bridge denies acceptance", async () => {
  const r = await send();
  await f.request(2, "set_preference", { receiving: false });
  await expect(send()).rejects.toThrow();
  await expect(f.request(2, "accept", { id: r.id })).rejects.toThrow();
  await f.request(2, "set_preference", { receiving: true });
  expect((await f.request(2, "list")).items).toHaveLength(0);
  const q = await send();
  await f.exec("update public.atoms set status='DEACTIVATED' where id=$1", [
    f.people[0].atom,
  ]);
  await expect(f.request(2, "accept", { id: q.id })).rejects.toThrow();
});
it("deactivation invalidates without resurrection and deletion erases private request data", async () => {
  const r = await send();
  await f.exec("update public.atoms set status='DEACTIVATED' where id=$1", [
    f.people[2].atom,
  ]);
  await expect(f.request(2, "list")).rejects.toThrow();
  await f.exec("update public.atoms set status='ACTIVE' where id=$1", [
    f.people[2].atom,
  ]);
  await expect(f.request(2, "accept", { id: r.id })).rejects.toThrow();
  await f.exec(
    "update public.atoms set status='DELETED',location_id=null where id=$1",
    [f.people[2].atom],
  );
  expect(
    (await f.exec("select count(*)::int n from private.direct_bond_requests"))
      .rows[0].n,
  ).toBe(0);
});
it("reciprocal acceptance supersedes the other request and external invitations remain 24-hour", async () => {
  const a = await send(),
    b = await send(2, 1);
  await f.request(2, "accept", { id: a.id });
  await expect(f.request(1, "accept", { id: b.id })).rejects.toThrow();
  const invite = await f.rpc(3, "create_bond_invitation");
  await f.rpc(25, "accept_bond_invitation", [invite.token]);
  expect(
    (
      await f.exec(
        "select extract(epoch from expires_at-created_at)::int seconds from public.bond_invitations where id=$1",
        [invite.id],
      )
    ).rows[0].seconds,
  ).toBe(86400);
});
it("RLS denies direct access and cleanup is bounded and idempotent", async () => {
  await send();
  await f.advance(7 * 1440);
  expect(
    (await f.exec("select private.direct_bond_cleanup(1) result")).rows[0]
      .result.expired,
  ).toBe(1);
  await f.advance(30 * 1440);
  expect(
    (await f.exec("select private.direct_bond_cleanup(1) result")).rows[0]
      .result.purged,
  ).toBe(1);
  expect(
    (await f.exec("select private.direct_bond_cleanup(1) result")).rows[0]
      .result.purged,
  ).toBe(0);
  await expect(
    f.db.transaction(async (tx: { exec: (s: string) => Promise<unknown> }) => {
      await tx.exec("set local role authenticated");
      await tx.exec("select * from private.direct_bond_requests");
    }),
  ).rejects.toThrow();
});
it("retains a sender's daily allowance when a recipient deletes their account", async () => {
  for (let i = 2; i < 7; i++) await send(1, i);
  await f.exec("update public.atoms set status='DELETED' where id=$1", [
    f.people[2].atom,
  ]);
  await expect(send(1, 7)).rejects.toThrow("Daily request limit");
});
it("rejects cancelled acceptance and malformed operations without a Bond", async () => {
  const r = await send();
  await f.request(1, "cancel", { id: r.id });
  await expect(f.request(2, "accept", { id: r.id })).rejects.toThrow();
  await expect(
    f.request(2, "set_preference", { receiving: "false" }),
  ).rejects.toThrow();
  await expect(f.request(2, "accept", { id: "invalid" })).rejects.toThrow();
  await expect(f.request(2, "unknown")).rejects.toThrow();
});
it("records cleanup failure safely and permits a successful bounded retry", async () => {
  const failed = (await f.exec("select private.direct_bond_cleanup(null) r"))
    .rows[0].r;
  expect(failed.ok).toBe(false);
  expect(
    (await f.exec("select error_code from private.direct_bond_cleanup_status"))
      .rows[0].error_code,
  ).toBeTruthy();
  const ok = (await f.exec("select private.direct_bond_cleanup(10) r")).rows[0]
    .r;
  expect(ok.ok).toBe(true);
  expect(
    (
      await f.exec(
        "select error_code,last_success,last_failure from private.direct_bond_cleanup_status",
      )
    ).rows[0],
  ).toMatchObject({ error_code: null });
});
it("fails closed at the database gate and rejects revoked owner sessions", async () => {
  await f.exec("update private.direct_bond_settings set enabled=false");
  await expect(send()).rejects.toThrow("Requests unavailable");
  await f.exec("update private.direct_bond_settings set enabled=true");
  await f.exec("delete from auth.sessions where id=$1", [f.people[1].session]);
  await expect(send()).rejects.toThrow();
});
