-- Task #9.2. No existing participant, Bond, number or preference is modified.
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

alter function public.begin_atom(uuid,text,text) set schema private;
alter function private.begin_atom(uuid,text,text) rename to before_deletion_begin_atom;
revoke all on function private.before_deletion_begin_atom(uuid,text,text) from public,anon,authenticated,atomic_bond_growth;
create function public.begin_atom(p_location_id uuid,p_display_name text default null,p_x_handle text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return private.before_deletion_begin_atom(p_location_id,p_display_name,p_x_handle);
end $$;
revoke all on function public.begin_atom(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_atom(uuid,text,text) to authenticated;

alter function public.activate_atom() set schema private;
alter function private.activate_atom() rename to before_deletion_activate_atom;
revoke all on function private.before_deletion_activate_atom() from public,anon,authenticated,atomic_bond_growth;
create function public.activate_atom() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return private.before_deletion_activate_atom();
end $$;
revoke all on function public.activate_atom() from public,anon,authenticated;
grant execute on function public.activate_atom() to authenticated;

alter function public.update_my_atom(text,text,uuid) set schema private;
alter function private.update_my_atom(text,text,uuid) rename to before_deletion_update_my_atom;
revoke all on function private.before_deletion_update_my_atom(text,text,uuid) from public,anon,authenticated,atomic_bond_growth;
create function public.update_my_atom(p_display_name text,p_x_handle text,p_location_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 perform private.before_deletion_update_my_atom(p_display_name,p_x_handle,p_location_id);
end $$;
revoke all on function public.update_my_atom(text,text,uuid) from public,anon,authenticated;
grant execute on function public.update_my_atom(text,text,uuid) to authenticated;

alter function public.update_notification_preferences(text,boolean) set schema private;
alter function private.update_notification_preferences(text,boolean) rename to before_deletion_update_notification_preferences;
revoke all on function private.before_deletion_update_notification_preferences(text,boolean) from public,anon,authenticated,atomic_bond_growth;
create function public.update_notification_preferences(p_growth_digest text,p_pulse_notifications boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 perform private.before_deletion_update_notification_preferences(p_growth_digest,p_pulse_notifications);
end $$;
revoke all on function public.update_notification_preferences(text,boolean) from public,anon,authenticated;
grant execute on function public.update_notification_preferences(text,boolean) to authenticated;

alter function public.create_bond_invitation() set schema private;
alter function private.create_bond_invitation() rename to before_deletion_create_bond_invitation;
revoke all on function private.before_deletion_create_bond_invitation() from public,anon,authenticated,atomic_bond_growth;
create function public.create_bond_invitation() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return private.before_deletion_create_bond_invitation();
end $$;
revoke all on function public.create_bond_invitation() from public,anon,authenticated;
grant execute on function public.create_bond_invitation() to authenticated;

alter function public.cancel_bond_invitation(uuid) set schema private;
alter function private.cancel_bond_invitation(uuid) rename to before_deletion_cancel_bond_invitation;
revoke all on function private.before_deletion_cancel_bond_invitation(uuid) from public,anon,authenticated,atomic_bond_growth;
create function public.cancel_bond_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 perform private.before_deletion_cancel_bond_invitation(p_id);
end $$;
revoke all on function public.cancel_bond_invitation(uuid) from public,anon,authenticated;
grant execute on function public.cancel_bond_invitation(uuid) to authenticated;

alter function public.accept_bond_invitation(text) set schema private;
alter function private.accept_bond_invitation(text) rename to before_deletion_accept_bond_invitation;
revoke all on function private.before_deletion_accept_bond_invitation(text) from public,anon,authenticated,atomic_bond_growth;
create function public.accept_bond_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return private.before_deletion_accept_bond_invitation(p_token);
end $$;
revoke all on function public.accept_bond_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_bond_invitation(text) to authenticated;

alter function public.send_emotional_pulse(public.emotion) set schema private;
alter function private.send_emotional_pulse(public.emotion) rename to before_deletion_send_emotional_pulse;
revoke all on function private.before_deletion_send_emotional_pulse(public.emotion) from public,anon,authenticated,atomic_bond_growth;
create function public.send_emotional_pulse(p_emotion public.emotion) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return private.before_deletion_send_emotional_pulse(p_emotion);
end $$;
revoke all on function public.send_emotional_pulse(public.emotion) from public,anon,authenticated;
grant execute on function public.send_emotional_pulse(public.emotion) to authenticated;

alter function growth_jobs.scan(bigint,integer) rename to before_deletion_scan;
revoke all on function growth_jobs.before_deletion_scan(bigint,integer) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.scan(p_after bigint default 0,p_limit integer default 50) returns table(public_id text,eligibility text) language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return query select * from growth_jobs.before_deletion_scan(p_after,p_limit);
end $$;
revoke all on function growth_jobs.scan(bigint,integer) from public,anon,authenticated;
grant execute on function growth_jobs.scan(bigint,integer) to atomic_bond_growth;

alter function growth_jobs.evaluate(bigint,boolean) rename to before_deletion_evaluate;
revoke all on function growth_jobs.before_deletion_evaluate(bigint,boolean) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.evaluate(p_number bigint,p_persist boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_evaluate(p_number,p_persist);
end $$;
revoke all on function growth_jobs.evaluate(bigint,boolean) from public,anon,authenticated;
grant execute on function growth_jobs.evaluate(bigint,boolean) to atomic_bond_growth;

alter function growth_jobs.reserve(bigint) rename to before_deletion_reserve;
revoke all on function growth_jobs.before_deletion_reserve(bigint) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.reserve(p_number bigint) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_reserve(p_number);
end $$;
revoke all on function growth_jobs.reserve(bigint) from public,anon,authenticated;
grant execute on function growth_jobs.reserve(bigint) to atomic_bond_growth;

alter function growth_jobs.claim(uuid) rename to before_deletion_claim;
revoke all on function growth_jobs.before_deletion_claim(uuid) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.claim(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_claim(p_job);
end $$;
revoke all on function growth_jobs.claim(uuid) from public,anon,authenticated;
grant execute on function growth_jobs.claim(uuid) to atomic_bond_growth;

alter function growth_jobs.authorize_send(uuid,uuid,text) rename to before_deletion_authorize_send;
revoke all on function growth_jobs.before_deletion_authorize_send(uuid,uuid,text) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.authorize_send(p_job uuid,p_attempt uuid,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_authorize_send(p_job,p_attempt,p_hash);
end $$;
revoke all on function growth_jobs.authorize_send(uuid,uuid,text) from public,anon,authenticated;
grant execute on function growth_jobs.authorize_send(uuid,uuid,text) to atomic_bond_growth;

alter function growth_jobs.finish(uuid,uuid,boolean) rename to before_deletion_finish;
revoke all on function growth_jobs.before_deletion_finish(uuid,uuid,boolean) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.finish(p_job uuid,p_attempt uuid,p_accepted boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_finish(p_job,p_attempt,p_accepted);
end $$;
revoke all on function growth_jobs.finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function growth_jobs.finish(uuid,uuid,boolean) to atomic_bond_growth;

alter function growth_jobs.unsubscribe(text) rename to before_deletion_unsubscribe;
revoke all on function growth_jobs.before_deletion_unsubscribe(text) from public,anon,authenticated,atomic_bond_growth;
create function growth_jobs.unsubscribe(p_token text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.lifecycle_lock();
 return growth_jobs.before_deletion_unsubscribe(p_token);
end $$;
revoke all on function growth_jobs.unsubscribe(text) from public,anon,authenticated;
grant execute on function growth_jobs.unsubscribe(text) to atomic_bond_growth;

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
create or replace function private.reachable(p_root uuid) returns table(id uuid) language sql stable security definer set search_path = '' as $$
 with recursive reach(id) as (
  select a.id from public.atoms a where a.id=p_root and a.public_id is not null and a.status in ('ACTIVE','DORMANT','DELETED')
  union
  select case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  from reach r join public.bonds b on b.atom_a_id=r.id or b.atom_b_id=r.id
  join public.atoms a on a.id=case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  where b.status='CONFIRMED' and a.public_id is not null and a.status in ('ACTIVE','DORMANT','DELETED')
 ) select id from reach;
$$;
create or replace function public.connected_emotional_pulses() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'atomId',a.public_id::text,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000) order by a.public_id),'[]'::jsonb) into result
 from public.emotional_pulses p join private.reachable(owner) r on r.id=p.atom_id join public.atoms a on a.id=p.atom_id
 where a.status in ('ACTIVE','DORMANT') and p.created_at<=now() and p.expires_at>now();
 return result;
end $$;
create or replace function public.public_graph(p_public_id text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare root uuid; members uuid[]; nodes jsonb; edges jsonb;
begin
 select id into root from public.atoms where public_id is not null and (status in ('ACTIVE','DORMANT') or (status='DELETED' and p_public_id is not null)) and (p_public_id is null or public_id::text=p_public_id) order by public_id limit 1;
 if root is null then return jsonb_build_object('nodes','[]'::jsonb,'edges','[]'::jsonb); end if;
 select array_agg(id) into members from private.reachable(root);
 if cardinality(members)>5000 then raise exception 'Network exceeds initial retrieval limit'; end if;
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',a.public_id::text,'publicId',a.public_id::text,'status',a.status,'displayName',case when a.status<>'DELETED' then a.display_name end,'xHandle',case when a.status<>'DELETED' then a.x_handle end,'createdAt',a.created_at,
  'degree',(select count(*) from public.bonds b where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members) and (b.atom_a_id=a.id or b.atom_b_id=a.id)),
  'metadata',case when a.status='DELETED' then '{}'::jsonb else jsonb_build_object('region',l.region,'homeRegion',concat_ws(', ',nullif(l.region,''),l.country),'countryCode',l.country_code,'countryName',l.country,'subdivisionCode',l.subdivision_code) end
 )) order by a.public_id),'[]'::jsonb) into nodes from public.atoms a left join public.locations l on l.id=a.location_id where a.id=any(members);
 select coalesce(jsonb_agg(jsonb_build_object('id',concat(a.public_id,':',z.public_id),'source',a.public_id::text,'target',z.public_id::text,'createdAt',b.confirmed_at) order by b.id),'[]'::jsonb) into edges
 from public.bonds b join public.atoms a on a.id=b.atom_a_id join public.atoms z on z.id=b.atom_b_id where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members);
 return jsonb_build_object('nodes',nodes,'edges',edges);
end $$;

commit;
