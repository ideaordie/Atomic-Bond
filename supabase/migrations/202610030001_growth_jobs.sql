-- Task #9.1: dedicated job login, never a service-role key or owner identity.
begin;
create role atomic_bond_growth login nosuperuser nocreatedb nocreaterole
 noinherit noreplication nobypassrls connection limit 4 password null;
-- Database name is deployment metadata, not caller-controlled SQL.
do $$ begin execute format('grant connect on database %I to atomic_bond_growth',current_database()); end $$;
create schema growth_jobs authorization postgres;
revoke all on schema growth_jobs from public,anon,authenticated;
grant usage on schema growth_jobs to atomic_bond_growth;

create table private.growth_state (
 atom_id uuid primary key references public.atoms(id),
 baseline jsonb not null,
 evaluated_at timestamptz not null default now(),
 sent_at timestamptz,
 sent_period date
);
create table private.growth_deliveries (
 id uuid primary key default gen_random_uuid(),
 atom_id uuid not null references public.atoms(id),
 period date not null,
 previous_metrics jsonb not null,
 current_metrics jsonb not null,
 recipient text not null,
 status text not null default 'prepared' check(status in ('prepared','attempted','accepted','failed','blocked')),
 created_at timestamptz not null default now(),
 first_attempt_at timestamptz,
 lease_until timestamptz,
 attempt_id uuid,
 payload_hash text,
 accepted_at timestamptz,
 unsubscribe_hash text not null unique,
 unsubscribe_cipher bytea not null,
 unique(atom_id,period)
);
create table private.growth_key (
 singleton boolean primary key default true check(singleton),
 secret text not null
);
insert into private.growth_key(secret) values(encode(extensions.gen_random_bytes(32),'hex'));
alter table private.growth_state enable row level security;
alter table private.growth_deliveries enable row level security;
alter table private.growth_key enable row level security;
revoke all on private.growth_state,private.growth_deliveries,private.growth_key from public,anon,authenticated,atomic_bond_growth;

create function private.growth_eligibility(p_atom uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when a.status <> 'ACTIVE' or a.public_id is null or p.atom_id is null
 or i.email_verified_at is null or u.email_confirmed_at is null
 or i.normalized_email is distinct from private.normalize_email(u.email)
 then 'ineligible' when p.growth_digest <> 'weekly' or p.growth_preference_source='unsubscribe'
 then 'disabled' else 'eligible' end
 from public.atoms a left join private.atom_identities i on i.atom_id=a.id
 left join auth.users u on u.id=i.auth_user_id
 left join private.notification_preferences p on p.atom_id=a.id
 where a.id=p_atom;
$$;

create function private.growth_metrics(p_atom uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with members as materialized(select id from private.reachable(p_atom)),
 places as (select l.* from members m join public.atoms a on a.id=m.id
 join public.locations l on l.id=a.location_id where a.id<>p_atom)
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

create function growth_jobs.scan(p_after bigint default 0,p_limit integer default 50)
returns table(public_id text,eligibility text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_after is null or p_after<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch'; end if;
 return query select a.public_id::text,private.growth_eligibility(a.id)
 from public.atoms a where a.public_id>p_after order by a.public_id limit p_limit;
end $$;

create function growth_jobs.evaluate(p_number bigint,p_persist boolean default false) returns jsonb
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
 if exists(select 1 from private.growth_deliveries where atom_id=a and status<>'accepted'
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

create function growth_jobs.reserve(p_number bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare a uuid; result jsonb; job uuid; token text; key text;
 v_period date := date_trunc('week',now() at time zone 'UTC')::date;
begin
 result:=growth_jobs.evaluate(p_number,true);
 if result->>'outcome'<>'would_send' then return null; end if;
 select id into a from public.atoms where public_id=p_number;
 -- An uncertain earlier attempt blocks new periods until safely reconciled.
 select id into job from private.growth_deliveries where atom_id=a and status<>'accepted' order by created_at limit 1;
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

create function growth_jobs.claim(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.growth_deliveries; key text; a uuid; claim uuid;
begin
 select atom_id into a from private.growth_deliveries where id=p_job;
 perform 1 from public.atoms where id=a for update;
 perform 1 from private.notification_preferences where atom_id=a for update;
 select * into d from private.growth_deliveries where id=p_job for update;
 if d.id is null or d.status in ('accepted','blocked') or d.lease_until>now()
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

-- Bind an immutable provider payload before any network request. Retries cannot
-- change recipient, origin, template or token under the same idempotency key.
create function growth_jobs.authorize_send(p_job uuid,p_attempt uuid,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d private.growth_deliveries;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid payload'; end if;
 select * into d from private.growth_deliveries where id=p_job for update;
 if d.id is null or d.status<>'attempted' or d.attempt_id is distinct from p_attempt
 or d.lease_until<=now() or private.growth_eligibility(d.atom_id) is distinct from 'eligible'
 then return false; end if;
 if d.payload_hash is not null and d.payload_hash<>p_hash then
 update private.growth_deliveries set status='blocked' where id=d.id; return false; end if;
 update private.growth_deliveries set payload_hash=p_hash where id=d.id;
 return true;
end $$;

create function growth_jobs.finish(p_job uuid,p_attempt uuid,p_accepted boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare d private.growth_deliveries; a uuid;
begin
 if p_accepted is null then raise exception 'Invalid result'; end if;
 select atom_id into a from private.growth_deliveries where id=p_job;
 perform 1 from public.atoms where id=a for update;
 select * into d from private.growth_deliveries where id=p_job for update;
 if d.id is null or d.attempt_id is distinct from p_attempt or d.status<>'attempted' or d.payload_hash is null then return false; end if;
 update private.growth_deliveries set status=case when p_accepted then 'accepted' else 'failed' end,
 accepted_at=case when p_accepted then now() else null end,lease_until=now()+interval '1 minute' where id=d.id;
 if p_accepted then update private.growth_state set baseline=d.current_metrics,sent_at=now(),sent_period=date_trunc('week',now() at time zone 'UTC')::date where atom_id=d.atom_id; end if;
 return true;
end $$;

create function growth_jobs.unsubscribe(p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
 select atom_id into a from private.growth_deliveries where unsubscribe_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if a is null then return false; end if;
 perform private.unsubscribe_growth(a);
 return true;
end $$;

alter function private.growth_eligibility(uuid) owner to postgres;
alter function private.growth_metrics(uuid) owner to postgres;
alter function growth_jobs.scan(bigint,integer) owner to postgres;
alter function growth_jobs.evaluate(bigint,boolean) owner to postgres;
alter function growth_jobs.reserve(bigint) owner to postgres;
alter function growth_jobs.claim(uuid) owner to postgres;
alter function growth_jobs.authorize_send(uuid,uuid,text) owner to postgres;
alter function growth_jobs.finish(uuid,uuid,boolean) owner to postgres;
alter function growth_jobs.unsubscribe(text) owner to postgres;
revoke all on function private.growth_eligibility(uuid),private.growth_metrics(uuid) from public,anon,authenticated,atomic_bond_growth;
revoke all on function growth_jobs.scan(bigint,integer),growth_jobs.evaluate(bigint,boolean),growth_jobs.reserve(bigint),growth_jobs.claim(uuid),growth_jobs.authorize_send(uuid,uuid,text),growth_jobs.finish(uuid,uuid,boolean),growth_jobs.unsubscribe(text) from public,anon,authenticated;
grant execute on function growth_jobs.scan(bigint,integer),growth_jobs.evaluate(bigint,boolean),growth_jobs.reserve(bigint),growth_jobs.claim(uuid),growth_jobs.authorize_send(uuid,uuid,text),growth_jobs.finish(uuid,uuid,boolean),growth_jobs.unsubscribe(text) to atomic_bond_growth;
commit;
