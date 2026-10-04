// Authoring helper only; deploy the checked-in migration.
import { readFileSync, writeFileSync } from "node:fs";
const dir = "supabase/migrations/";
const original = readFileSync(dir + "202609260001_atomic_bond.sql", "utf8");
const deletion = readFileSync(
  dir + "202610040001_account_deletion.sql",
  "utf8",
);
const growth = readFileSync(dir + "202610030001_growth_jobs.sql", "utf8");
const body = (source, start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end));
let sql = `-- Task #9.3: reversible owner deactivation; DELETED remains terminal.
begin;
alter table public.atoms drop constraint atoms_check;
alter table public.atoms add constraint atoms_check check (
 (status='PENDING' and public_id is null) or
 (status in ('ACTIVE','DORMANT','DEACTIVATED') and public_id is not null) or status='DELETED');
alter table private.growth_deliveries drop constraint growth_deliveries_status_check;
alter table private.growth_deliveries add constraint growth_deliveries_status_check
 check(status in ('prepared','attempted','accepted','failed','blocked','cancelled'));
-- A retained epoch denies pre-deactivation JWTs even after later reactivation.
create table private.account_lifecycle (
 atom_id uuid primary key references public.atoms(id),
 authenticated_after timestamptz not null
);
alter table private.account_lifecycle enable row level security;
revoke all on private.account_lifecycle from public,anon,authenticated,atomic_bond_growth;

create function private.lifecycle_session(p_atom uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.account_lifecycle where atom_id=p_atom)
 or exists (
 select 1 from private.account_lifecycle l join auth.sessions s on s.user_id=auth.uid()
 where l.atom_id=p_atom
 and s.id::text=(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'session_id'
 and exists(select 1 from jsonb_array_elements(coalesce(
 (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->'amr','[]'::jsonb)) m
 where m->>'method' in ('otp','magiclink')
 and ((m->>'timestamp')::numeric>extract(epoch from l.authenticated_after)
 or (s.created_at>l.authenticated_after and (m->>'timestamp')::numeric>=floor(extract(epoch from l.authenticated_after))))
 and (m->>'timestamp')::numeric<=extract(epoch from now())));
$$;
revoke all on function private.lifecycle_session(uuid) from public,anon,authenticated,atomic_bond_growth;
`;
sql += body(
  original,
  "create function private.owner_atom",
  "-- Only Supabase Auth",
)
  .replace("create function", "create or replace function")
  .replace(
    "and a.status <> 'DELETED'",
    "and a.status <> 'DELETED' and private.lifecycle_session(a.id)",
  );
sql += `
create function private.account_owner() returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 result:=private.owner_atom(false);
 if not exists(select 1 from auth.sessions s where s.user_id=auth.uid()
 and s.id::text=(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'session_id')
 then raise exception 'Live owner session required' using errcode='42501'; end if;
 if not exists(select 1 from private.atom_identities i join auth.users u on u.id=i.auth_user_id
 join public.atoms a on a.id=i.atom_id where a.id=result and a.status in ('ACTIVE','DORMANT','DEACTIVATED')
 and i.email_verified_at is not null and u.email_confirmed_at is not null
 and i.normalized_email=private.normalize_email(u.email))
 then raise exception 'Verified ownership required' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function private.account_owner() from public,anon,authenticated,atomic_bond_growth;

create or replace function public.activate_atom() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 perform private.lifecycle_lock();
 select a.id into owner from public.atoms a join private.atom_identities i on i.atom_id=a.id
 where i.auth_user_id=auth.uid() and a.status<>'DELETED' and private.lifecycle_session(a.id);
 if owner is null then raise exception 'Atom unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.atoms where id=owner and status='DEACTIVATED')
 then raise exception 'Explicit reactivation required' using errcode='42501'; end if;
 return private.before_deletion_activate_atom();
end $$;

create function public.deactivate_my_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; number text;
begin
 perform private.lifecycle_lock();
 owner:=private.account_owner();
 select public_id::text into number from public.atoms where id=owner for update;
 if exists(select 1 from public.atoms where id=owner and status='DEACTIVATED')
 then return jsonb_build_object('state','deactivated','publicId',number); end if;
 if exists(select 1 from private.growth_deliveries where atom_id=owner and status='attempted'
 and payload_hash is not null and lease_until>clock_timestamp())
 then return jsonb_build_object('state','delivery_in_progress'); end if;
 update public.atoms set status='DEACTIVATED' where id=owner;
 insert into private.account_lifecycle(atom_id,authenticated_after) values(owner,clock_timestamp())
 on conflict(atom_id) do update set authenticated_after=excluded.authenticated_after;
 delete from public.emotional_pulses where atom_id=owner;
 delete from private.invitation_secrets s using public.bond_invitations i
 where s.invitation_id=i.id and i.creator_atom_id=owner;
 update public.bond_invitations set status='CANCELLED' where creator_atom_id=owner and status='ACTIVE';
 -- Preserve period uniqueness even if a provider outcome was uncertain. Cancel backlog.
 update private.growth_deliveries set status='cancelled',lease_until=null
 where atom_id=owner and status not in ('accepted','cancelled');
 return jsonb_build_object('state','deactivated','publicId',number);
end $$;

create function public.reactivate_my_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; a public.atoms;
begin
 perform private.lifecycle_lock();
 owner:=private.account_owner();
 select * into a from public.atoms where id=owner for update;
 if a.status='DEACTIVATED' then
  update public.atoms set status='ACTIVE',last_active_at=now() where id=owner;
  insert into private.growth_state(atom_id,baseline) values(owner,private.growth_metrics(owner))
  on conflict(atom_id) do update set baseline=excluded.baseline,evaluated_at=now();
 end if;
 return jsonb_build_object('state','active','publicId',a.public_id::text);
end $$;
revoke all on function public.deactivate_my_account(),public.reactivate_my_account() from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.deactivate_my_account(),public.reactivate_my_account() to authenticated;
alter function public.deactivate_my_account() owner to postgres;
alter function public.reactivate_my_account() owner to postgres;
`;
const auth = readFileSync(dir + "202609270001_owner_access.sql", "utf8");
sql += body(
  auth,
  "create function public.my_atom",
  "revoke all on function public.my_atom",
)
  .replace("create function", "create or replace function")
  .replace(
    "where i.auth_user_id=auth.uid()",
    "where i.auth_user_id=auth.uid() and t.status<>'DELETED' and private.lifecycle_session(t.id)",
  );
sql += body(
  deletion,
  "create function public.delete_my_account",
  "-- Admin cleanup",
)
  .replace("create function", "create or replace function")
  .replace("owner:=private.owner_atom();", "owner:=private.account_owner();")
  .replace(
    "delete from private.atom_identities",
    "delete from private.account_lifecycle where atom_id=owner;\n delete from private.atom_identities",
  );
sql += body(
  deletion,
  "create or replace function private.reachable",
  "create or replace function public.connected_emotional_pulses",
).replaceAll(
  "'ACTIVE','DORMANT','DELETED'",
  "'ACTIVE','DORMANT','DEACTIVATED','DELETED'",
);
sql += body(
  deletion,
  "create or replace function public.public_graph",
  "commit;",
)
  .replaceAll("status='DELETED'", "status in ('DELETED','DEACTIVATED')")
  .replaceAll(
    "a.status<>'DELETED'",
    "a.status not in ('DELETED','DEACTIVATED')",
  );
sql += body(
  growth,
  "create function private.growth_metrics",
  "create function growth_jobs.scan",
)
  .replace("create function", "create or replace function")
  .replace(
    "where a.id<>p_atom",
    "where a.id<>p_atom and a.status in ('ACTIVE','DORMANT')",
  );
sql += body(
  growth,
  "create function growth_jobs.evaluate",
  "-- Bind an immutable provider payload",
)
  .replaceAll(
    "create function growth_jobs.",
    "create or replace function growth_jobs.before_deletion_",
  )
  .replaceAll("status<>'accepted'", "status not in ('accepted','cancelled')")
  .replace(
    "d.status in ('accepted','blocked')",
    "d.status in ('accepted','blocked','cancelled')",
  );
sql += "\ncommit;\n";
writeFileSync(dir + "202610050002_account_deactivation.sql", sql);
