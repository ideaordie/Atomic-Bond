// Generates explicit version-controlled wrappers around the approved baseline bodies.
// Run only when authoring the migration; never during deployment.
import { readFileSync, writeFileSync } from "node:fs";
const base = "supabase/migrations/";
let sql = `-- Task #9.2. No existing participant, Bond, number or preference is modified.
begin;
alter table public.atoms alter column location_id drop not null;
alter table public.atoms add constraint live_atom_location check(status='DELETED' or location_id is not null);
create table private.account_deletions (
 auth_user_id uuid primary key,
 atom_id uuid not null unique references public.atoms(id),
 created_at timestamptz not null default now()
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated,atomic_bond_growth;

-- Short database transactions serialize lifecycle changes with all owner/job writes.
-- No lock is held during an external Auth or email HTTP request.
create function private.lifecycle_lock() returns void language sql volatile set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(920026,1);
$$;
revoke all on function private.lifecycle_lock() from public,anon,authenticated,atomic_bond_growth;

create function private.guard_retired_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.account_deletions where auth_user_id=NEW.auth_user_id)
 then raise exception 'Account removal pending' using errcode='42501'; end if;
 return NEW;
end $$;
revoke all on function private.guard_retired_identity() from public,anon,authenticated,atomic_bond_growth;
create trigger guard_retired_identity before insert or update on private.atom_identities for each row execute function private.guard_retired_identity();
`;
const owners = [
  [
    "begin_atom",
    "p_location_id uuid,p_display_name text default null,p_x_handle text default null",
    "uuid,text,text",
    "p_location_id,p_display_name,p_x_handle",
    "jsonb",
  ],
  ["activate_atom", "", "", "", "jsonb"],
  [
    "update_my_atom",
    "p_display_name text,p_x_handle text,p_location_id uuid",
    "text,text,uuid",
    "p_display_name,p_x_handle,p_location_id",
    "void",
  ],
  [
    "update_notification_preferences",
    "p_growth_digest text,p_pulse_notifications boolean",
    "text,boolean",
    "p_growth_digest,p_pulse_notifications",
    "void",
  ],
  ["create_bond_invitation", "", "", "", "jsonb"],
  ["cancel_bond_invitation", "p_id uuid", "uuid", "p_id", "void"],
  ["accept_bond_invitation", "p_token text", "text", "p_token", "jsonb"],
  [
    "send_emotional_pulse",
    "p_emotion public.emotion",
    "public.emotion",
    "p_emotion",
    "jsonb",
  ],
];
for (const [name, params, types, args, result] of owners) {
  sql += `
alter function public.${name}(${types}) set schema private;
alter function private.${name}(${types}) rename to before_deletion_${name};
revoke all on function private.before_deletion_${name}(${types}) from public,anon,authenticated,atomic_bond_growth;
create function public.${name}(${params}) returns ${result} language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 ${result === "void" ? "perform" : "return"} private.before_deletion_${name}(${args});
end $$;
revoke all on function public.${name}(${types}) from public,anon,authenticated;
grant execute on function public.${name}(${types}) to authenticated;
`;
}
const jobs = [
  [
    "scan",
    "p_after bigint default 0,p_limit integer default 50",
    "bigint,integer",
    "p_after,p_limit",
    "table(public_id text,eligibility text)",
  ],
  [
    "evaluate",
    "p_number bigint,p_persist boolean default false",
    "bigint,boolean",
    "p_number,p_persist",
    "jsonb",
  ],
  ["reserve", "p_number bigint", "bigint", "p_number", "uuid"],
  ["claim", "p_job uuid", "uuid", "p_job", "jsonb"],
  [
    "authorize_send",
    "p_job uuid,p_attempt uuid,p_hash text",
    "uuid,uuid,text",
    "p_job,p_attempt,p_hash",
    "boolean",
  ],
  [
    "finish",
    "p_job uuid,p_attempt uuid,p_accepted boolean",
    "uuid,uuid,boolean",
    "p_job,p_attempt,p_accepted",
    "boolean",
  ],
  ["unsubscribe", "p_token text", "text", "p_token", "boolean"],
];
for (const [name, params, types, args, result] of jobs) {
  sql += `
alter function growth_jobs.${name}(${types}) rename to before_deletion_${name};
revoke all on function growth_jobs.before_deletion_${name}(${types}) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.${name}(${params}) returns ${result} language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 ${name === "scan" ? "return query select * from" : "return"} growth_jobs.before_deletion_${name}(${args});
end $$;
revoke all on function growth_jobs.${name}(${types}) from public,anon,authenticated;
grant execute on function growth_jobs.${name}(${types}) to atomic_bond_growth;
`;
}
sql += `
create function public.account_deletion_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare claims jsonb := nullif(current_setting('request.jwt.claims',true),'')::jsonb; recent boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) m
 where m->>'method' in ('otp','magiclink')
 and (m->>'timestamp')::numeric between extract(epoch from clock_timestamp())-600 and extract(epoch from clock_timestamp())
 ) and exists(select 1 from auth.sessions s where s.id::text=claims->>'session_id' and s.user_id=auth.uid()) into recent;
 return jsonb_build_object('recent',coalesce(recent,false),'pending',exists(select 1 from private.account_deletions where auth_user_id=auth.uid()));
end $$;

create function public.delete_my_account(p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; number text;
begin
 perform private.lifecycle_lock();
 if auth.uid() is null or p_confirmation is distinct from 'DELETE' then raise exception 'Confirmation required' using errcode='42501'; end if;
 if exists(select 1 from private.account_deletions where auth_user_id=auth.uid()) then return jsonb_build_object('state','auth_cleanup_pending'); end if;
 if not (public.account_deletion_status()->>'recent')::boolean then return jsonb_build_object('state','reauthenticate'); end if;
 owner:=private.owner_atom();
 perform 1 from public.atoms where id=owner for update;
 -- A provider handoff authorized before deletion must settle/expire first.
 if exists(select 1 from private.growth_deliveries where atom_id=owner and status='attempted' and payload_hash is not null and lease_until>clock_timestamp())
 then return jsonb_build_object('state','delivery_in_progress'); end if;
 insert into private.account_deletions(auth_user_id,atom_id) values(auth.uid(),owner);
 update public.atoms set status='DELETED',display_name=null,x_handle=null,location_id=null,last_active_at=null where id=owner returning public_id::text into number;
 delete from public.emotional_pulses where atom_id=owner;
 delete from private.notification_preferences where atom_id=owner;
 delete from private.growth_deliveries where atom_id=owner;
 delete from private.growth_state where atom_id=owner;
 delete from private.invitation_secrets s using public.bond_invitations i where s.invitation_id=i.id and i.creator_atom_id=owner;
 update public.bond_invitations set status='CANCELLED' where creator_atom_id=owner and status='ACTIVE';
 delete from private.atom_identities where atom_id=owner;
 return jsonb_build_object('state','auth_cleanup_pending','publicId',number);
end $$;

-- Admin cleanup is bound to a persisted owner-authorized deletion, never arbitrary Auth removal.
create function public.account_cleanup_pending(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.account_deletions where auth_user_id=p_user);
$$;
create function public.account_cleanup_finish(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 if exists(select 1 from auth.users where id=p_user) then return false; end if;
 delete from private.account_deletions where auth_user_id=p_user;
 return true;
end $$;
revoke all on function public.account_deletion_status(),public.delete_my_account(text),public.account_cleanup_pending(uuid),public.account_cleanup_finish(uuid) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.account_deletion_status(),public.delete_my_account(text) to authenticated;
grant execute on function public.account_cleanup_pending(uuid),public.account_cleanup_finish(uuid) to service_role;
alter function public.account_deletion_status() owner to postgres;
alter function public.delete_my_account(text) owner to postgres;
alter function public.account_cleanup_pending(uuid) owner to postgres;
alter function public.account_cleanup_finish(uuid) owner to postgres;
`;
const original = readFileSync(base + "202609260001_atomic_bond.sql", "utf8");
let reachable = original.slice(
  original.indexOf("create function private.reachable"),
  original.indexOf("create function public.connected_emotional_pulses"),
);
reachable = reachable
  .replace("create function", "create or replace function")
  .replaceAll(
    "a.status in ('ACTIVE','DORMANT')",
    "a.public_id is not null and a.status in ('ACTIVE','DORMANT','DELETED')",
  );
sql += reachable;
let pulse = original.slice(
  original.indexOf("create function public.connected_emotional_pulses"),
  original.indexOf("create function public.public_graph"),
);
sql += pulse
  .replace("create function", "create or replace function")
  .replace(
    "where p.created_at",
    "where a.status in ('ACTIVE','DORMANT') and p.created_at",
  );
const coarse = readFileSync(base + "202609280001_coarse_regions.sql", "utf8");
let graph = coarse.slice(
  coarse.indexOf("create or replace function public.public_graph"),
  coarse.lastIndexOf("commit;"),
);
graph = graph.replace(
  "status in ('ACTIVE','DORMANT') and (p_public_id",
  "public_id is not null and (status in ('ACTIVE','DORMANT') or (status='DELETED' and p_public_id is not null)) and (p_public_id",
);
graph = graph.replace(
  "'displayName',a.display_name,'xHandle',a.x_handle",
  "'status',a.status,'displayName',case when a.status<>'DELETED' then a.display_name end,'xHandle',case when a.status<>'DELETED' then a.x_handle end",
);
graph = graph
  .replace(
    "'metadata',jsonb_build_object",
    "'metadata',case when a.status='DELETED' then '{}'::jsonb else jsonb_build_object",
  )
  .replace(
    "'subdivisionCode',l.subdivision_code)",
    "'subdivisionCode',l.subdivision_code) end",
  );
graph = graph.replace(
  "join public.locations l",
  "left join public.locations l",
);
sql += graph + "\ncommit;\n";
writeFileSync(base + "202610040001_account_deletion.sql", sql);
