import { readFile } from "node:fs/promises";
import { createDoodleFixture } from "./doodle-fixture.mjs";
export async function createEvolveFixture(db) {
  const f = await createDoodleFixture(db, true, true);
  if (
    !(await f.db.query("select to_regclass('private.evolve_settings') present"))
      .rows[0].present
  )
    await f.db.exec(
      await readFile("supabase/candidates/202610210001_evolve.sql", "utf8"),
    );
  await f.db.exec(
    `create or replace function private.evolve_now() returns timestamptz language sql volatile set search_path='' as $$select t from private.doodle_test_clock$$;`,
  );
  const rpc = async (actor, name, args = []) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid fixture RPC");
    const p = f.people[actor];
    return f.db.transaction(async (tx) => {
      const timestamp = (
        await tx.query("select floor(extract(epoch from now()))::float8 t")
      ).rows[0].t;
      await tx.exec(`set local role ${p ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        p?.user ?? "",
      ]);
      await tx.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(
          p
            ? { session_id: p.session, amr: [{ method: "otp", timestamp }] }
            : {},
        ),
      ]);
      return (
        await tx.query(
          `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
          args,
        )
      ).rows[0].result;
    });
  };
  const call = (actor, operation, payload = {}) =>
    rpc(actor, "evolve_request", [operation, JSON.stringify(payload)]);
  const enable = () =>
    f.exec("update private.evolve_settings set enabled=true");
  const submit = async (actor, body = "Synthetic community idea") => {
    const state = await call(actor, "list");
    return call(actor, "submit", { body, revision: state.revision });
  };
  const moderate = (idea, moderation = "VISIBLE", status = "PROPOSED") =>
    call(0, "moderate", {
      id: idea.id,
      revision: idea.revision,
      moderation,
      status,
      explanation: "Synthetic review decision",
    });
  return { ...f, rpc, call, enable, submit, moderate };
}
