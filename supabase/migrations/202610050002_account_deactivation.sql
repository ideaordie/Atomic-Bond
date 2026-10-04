-- Task #9.3: reversible owner deactivation; DELETED remains terminal.
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
create or replace function private.owner_atom(require_active boolean default true) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare result uuid;
begin
 select a.id into result from public.atoms a join private.atom_identities i on i.atom_id=a.id
 join auth.users u on u.id=i.auth_user_id
 where i.auth_user_id=auth.uid() and a.status <> 'DELETED' and private.lifecycle_session(a.id)
 and (not require_active or (a.status in ('ACTIVE','DORMANT') and i.email_verified_at is not null and u.email_confirmed_at is not null and i.normalized_email=private.normalize_email(u.email)));
 if result is null then raise exception 'Verified Atom ownership required' using errcode='42501'; end if;
 return result;
end $$;


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
create or replace function public.my_atom() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.atoms;
begin
 select t.* into a from public.atoms t join private.atom_identities i on i.atom_id=t.id
 join auth.users u on u.id=i.auth_user_id
 where i.auth_user_id=auth.uid() and t.status<>'DELETED' and private.lifecycle_session(t.id) and i.normalized_email=private.normalize_email(u.email);
 if a.id is null then return null; end if;
 return jsonb_build_object('publicId',a.public_id::text,'status',a.status,'locationId',a.location_id,'alias',a.display_name,'xHandle',a.x_handle);
end $$;
create or replace function public.delete_my_account(p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; number text;
begin
 perform private.lifecycle_lock();
 if auth.uid() is null or p_confirmation is distinct from 'DELETE' then raise exception 'Confirmation required' using errcode='42501'; end if;
 if exists(select 1 from private.account_deletions where auth_user_id=auth.uid()) then return jsonb_build_object('state','auth_cleanup_pending'); end if;
 if not (public.account_deletion_status()->>'recent')::boolean then return jsonb_build_object('state','reauthenticate'); end if;
 owner:=private.account_owner();
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
 delete from private.account_lifecycle where atom_id=owner;
 delete from private.atom_identities where atom_id=owner;
 return jsonb_build_object('state','auth_cleanup_pending','publicId',number);
end $$;

create or replace function private.reachable(p_root uuid) returns table(id uuid) language sql stable security definer set search_path = '' as $$
 with recursive reach(id) as (
  select a.id from public.atoms a where a.id=p_root and a.public_id is not null and a.status in ('ACTIVE','DORMANT','DEACTIVATED','DELETED')
  union
  select case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  from reach r join public.bonds b on b.atom_a_id=r.id or b.atom_b_id=r.id
  join public.atoms a on a.id=case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  where b.status='CONFIRMED' and a.public_id is not null and a.status in ('ACTIVE','DORMANT','DEACTIVATED','DELETED')
 ) select id from reach;
$$;
create or replace function public.public_graph(p_public_id text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare root uuid; members uuid[]; nodes jsonb; edges jsonb;
begin
 select id into root from public.atoms where public_id is not null and (status in ('ACTIVE','DORMANT') or (status in ('DELETED','DEACTIVATED') and p_public_id is not null)) and (p_public_id is null or public_id::text=p_public_id) order by public_id limit 1;
 if root is null then return jsonb_build_object('nodes','[]'::jsonb,'edges','[]'::jsonb); end if;
 select array_agg(id) into members from private.reachable(root);
 if cardinality(members)>5000 then raise exception 'Network exceeds initial retrieval limit'; end if;
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',a.public_id::text,'publicId',a.public_id::text,'status',a.status,'displayName',case when a.status not in ('DELETED','DEACTIVATED') then a.display_name end,'xHandle',case when a.status not in ('DELETED','DEACTIVATED') then a.x_handle end,'createdAt',a.created_at,
  'degree',(select count(*) from public.bonds b where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members) and (b.atom_a_id=a.id or b.atom_b_id=a.id)),
  'metadata',case when a.status in ('DELETED','DEACTIVATED') then '{}'::jsonb else jsonb_build_object('region',l.region,'homeRegion',concat_ws(', ',nullif(l.region,''),l.country),'countryCode',l.country_code,'countryName',l.country,'subdivisionCode',l.subdivision_code) end
 )) order by a.public_id),'[]'::jsonb) into nodes from public.atoms a left join public.locations l on l.id=a.location_id where a.id=any(members);
 select coalesce(jsonb_agg(jsonb_build_object('id',concat(a.public_id,':',z.public_id),'source',a.public_id::text,'target',z.public_id::text,'createdAt',b.confirmed_at) order by b.id),'[]'::jsonb) into edges
 from public.bonds b join public.atoms a on a.id=b.atom_a_id join public.atoms z on z.id=b.atom_b_id where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members);
 return jsonb_build_object('nodes',nodes,'edges',edges);
end $$;

create or replace function private.growth_metrics(p_atom uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with members as materialized(select id from private.reachable(p_atom)),
 places as (select l.* from members m join public.atoms a on a.id=m.id
 join public.locations l on l.id=a.location_id where a.id<>p_atom and a.status in ('ACTIVE','DORMANT'))
 select jsonb_build_object(
 'connectedAtoms',(select count(*) from members where id<>p_atom),
 'directBonds',(select count(*) from public.bonds b where b.status='CONFIRMED'
 and (b.atom_a_id=p_atom or b.atom_b_id=p_atom)
 and b.atom_a_id in (select id from members) and b.atom_b_id in (select id from members)),
 'regions',(select count(distinct coalesce(p.subdivision_code,
   (select q.subdivision_code from public.locations q where q.country_code=p.country_code and q.region=p.region and q.subdivision_code is not null order by q.id limit 1),
   p.country_code||':'||nullif(p.region,''),p.country_code)) from places p),
 'countries',(select count(distinct country_code) from places));
$$;

create or replace function growth_jobs.before_deletion_evaluate(p_number bigint,p_persist boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid; eligibility text; metrics jsonb; state private.growth_state; outcome text;
 v_period date := date_trunc('week',now() at time zone 'UTC')::date;
begin
 if p_number is null or p_number<1 or p_persist is null then raise exception 'Invalid evaluation'; end if;
 select id into a from public.atoms where public_id=p_number for update;
 if a is null then return jsonb_build_object('outcome','ineligible'); end if;
 perform 1 from private.notification_preferences where atom_id=a for update;
 eligibility:=private.growth_eligibility(a);
 if eligibility is distinct from 'eligible' then return jsonb_build_object('outcome',coalesce(eligibility,'ineligible')); end if;
 select * into state from private.growth_state where atom_id=a;
 if state.sent_period=v_period then return jsonb_build_object('outcome','already_sent'); end if;
 if exists(select 1 from private.growth_deliveries where atom_id=a and status not in ('accepted','cancelled')
 and (status='blocked' or (first_attempt_at is not null and first_attempt_at<now()-interval '23 hours'))) then
 return jsonb_build_object('outcome','blocked'); end if;
 metrics:=private.growth_metrics(a);
 if state.atom_id is null then
  if p_persist then insert into private.growth_state(atom_id,baseline) values(a,metrics); end if;
  return jsonb_build_object('outcome','baseline');
 end if;
 outcome:='no_growth';
 if exists(select 1 from jsonb_each_text(metrics) m where m.value::bigint>(state.baseline->>m.key)::bigint) then outcome:='would_send'; end if;
 if p_persist then update private.growth_state set evaluated_at=now() where atom_id=a; end if;
 return jsonb_build_object('outcome',outcome);
end $$;

create or replace function growth_jobs.before_deletion_reserve(p_number bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare a uuid; result jsonb; job uuid; token text; key text;
 v_period date := date_trunc('week',now() at time zone 'UTC')::date;
begin
 result:=growth_jobs.evaluate(p_number,true);
 if result->>'outcome'<>'would_send' then return null; end if;
 select id into a from public.atoms where public_id=p_number;
 -- An uncertain earlier attempt blocks new periods until safely reconciled.
 select id into job from private.growth_deliveries where atom_id=a and status not in ('accepted','cancelled') order by created_at limit 1;
 if job is not null then return job; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 select secret into key from private.growth_key where singleton;
 insert into private.growth_deliveries(atom_id,period,previous_metrics,current_metrics,recipient,unsubscribe_hash,unsubscribe_cipher)
 select a,v_period,s.baseline,private.growth_metrics(a),i.normalized_email,
 encode(extensions.digest(token,'sha256'),'hex'),extensions.pgp_sym_encrypt(token,key)
 from private.growth_state s join private.atom_identities i using(atom_id) where s.atom_id=a
 on conflict(atom_id,period) do nothing returning id into job;
 return job;
end $$;

create or replace function growth_jobs.before_deletion_claim(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.growth_deliveries; key text; a uuid; claim uuid;
begin
 select atom_id into a from private.growth_deliveries where id=p_job;
 perform 1 from public.atoms where id=a for update;
 perform 1 from private.notification_preferences where atom_id=a for update;
 select * into d from private.growth_deliveries where id=p_job for update;
 if d.id is null or d.status in ('accepted','blocked','cancelled') or d.lease_until>now()
 or private.growth_eligibility(a) is distinct from 'eligible' then return null; end if;
 if d.first_attempt_at<now()-interval '23 hours' or d.recipient is distinct from
 (select normalized_email from private.atom_identities where atom_id=a) then
 update private.growth_deliveries set status='blocked' where id=d.id; return null; end if;
 claim:=gen_random_uuid();
 update private.growth_deliveries set status='attempted',first_attempt_at=coalesce(first_attempt_at,now()),
 lease_until=now()+interval '5 minutes',attempt_id=claim where id=d.id;
 select secret into key from private.growth_key where singleton;
 return jsonb_build_object('id',d.id,'attemptId',claim,'email',d.recipient,
 'publicId',(select public_id::text from public.atoms where id=a),
 'previous',d.previous_metrics,'current',d.current_metrics,
 'unsubscribeToken',extensions.pgp_sym_decrypt(d.unsubscribe_cipher,key));
end $$;


commit;
