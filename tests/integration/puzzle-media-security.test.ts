import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error shared isolated database fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture();
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const reserve = async (actor = 1) =>
  (await f.call(actor, "reveal", { revision: (await f.read(actor)).revision }))
    .puzzle.reservation.piece;

it("denies absent, foreign, expired and arbitrary reservations and incomplete full images", async () => {
  await expect(f.call(-1, "tile", { piece: randomUUID() })).rejects.toThrow();
  expect((await f.call(1, "tile", { piece: randomUUID() })).error).toBe(
    "TILE_DENIED",
  );
  const id = await reserve();
  expect((await f.call(2, "tile", { piece: id })).error).toBe("TILE_DENIED");
  expect((await f.call(1, "image")).error).toBe("HIDDEN_IMAGE");
  await f.advance(5);
  expect((await f.call(1, "tile", { piece: id })).error).toBe("TILE_DENIED");
});

it("revalidates session and lifecycle after a ticket was issued", async () => {
  const id = await reserve();
  const ticket = (await f.call(1, "tile", { piece: id })).ticket;
  await f.rpc(1, "deactivate_my_account");
  await expect(f.media(ticket)).rejects.toThrow();
  await expect(f.call(1, "tile", { piece: id })).rejects.toThrow();
  const other = await reserve(2);
  const sessionTicket = (await f.call(2, "tile", { piece: other })).ticket;
  await f.exec(
    "delete from auth.sessions where id=(select session_id from private.puzzle_tile_tickets where id=$1)",
    [sessionTicket],
  );
  await expect(f.media(sessionTicket)).rejects.toThrow();
});

it("bounds repeated tickets and never accepts crop coordinates from an owner", async () => {
  const id = await reserve();
  for (let n = 0; n < 32; n++)
    expect((await f.call(1, "tile", { piece: id, to: n })).ticket).toBeTruthy();
  expect((await f.call(1, "tile", { piece: id })).error).toBe("RATE_LIMITED");
  const tickets = (await f.exec("select id from private.puzzle_tile_tickets"))
    .rows;
  const result = await f.media(tickets[0].id);
  expect(result.region).toBe(await f.solution(id));
  await expect(f.media(tickets[0].id)).rejects.toThrow();
  for (let n = 0; n < 125; n++)
    await f.call(1, "tile", { piece: randomUUID() });
  expect((await f.call(1, "read")).error).toBe("RATE_LIMITED");
});

it("permits completed image and placed crops until retention deadline, not hidden expired pieces", async () => {
  const id = await reserve();
  await f.call(1, "place", {
    revision: (await f.read()).revision,
    piece: id,
    to: await f.solution(id),
  });
  expect((await f.call(2, "tile", { piece: id })).ticket).toBeTruthy();
  await f.advance(10080);
  expect((await f.call(2, "image")).error).toBe("HIDDEN_IMAGE");
  expect((await f.call(2, "tile", { piece: id })).ticket).toBeTruthy();
  // Isolated fixture completes the board; no production data or gameplay change.
  await f.exec(
    "update private.puzzle_pieces set position=solution,locked=true where puzzle_id=$1",
    [f.puzzle],
  );
  await f.exec("update private.puzzles set completed_at=ends_at where id=$1", [
    f.puzzle,
  ]);
  const ticket = (await f.call(2, "image")).ticket;
  expect((await f.media(ticket)).region).toBeNull();
  await f.advance(30 * 1440);
  expect((await f.call(2, "image")).status).toBe("WAITING");
});

it("audits effective table/function privileges and role attributes, including PUBLIC inheritance", async () => {
  const role = (
    await f.exec(
      "select rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolinherit from pg_roles where rolname='atomic_bond_puzzle_media'",
    )
  ).rows[0];
  expect(Object.values(role).every((v) => v === false)).toBe(true);
  const access = (
    await f.exec(
      `select n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage') and c.relkind='r' and (has_table_privilege('atomic_bond_puzzle_media',c.oid,'SELECT') or has_table_privilege('atomic_bond_puzzle_media',c.oid,'INSERT') or has_table_privilege('atomic_bond_puzzle_media',c.oid,'UPDATE') or has_table_privilege('atomic_bond_puzzle_media',c.oid,'DELETE')) order by 1`,
    )
  ).rows;
  expect(access).toEqual([{ name: "storage.objects" }]);
  const funcs = (
    await f.exec(
      `select n.nspname||'.'||p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('atomic_bond_puzzle_media',p.oid,'EXECUTE') order by 1`,
    )
  ).rows;
  expect(funcs).toEqual([
    { name: "private.puzzle_source_available" },
    { name: "public.puzzle_media_resolve" },
  ]);
  for (const privilege of ["INSERT", "UPDATE", "DELETE"])
    expect(
      (
        await f.exec(
          "select has_table_privilege('atomic_bond_puzzle_media','storage.objects',$1) allowed",
          [privilege],
        )
      ).rows[0].allowed,
    ).toBe(false);
});
