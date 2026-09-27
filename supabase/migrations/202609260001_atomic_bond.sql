-- Atomic Bond v0.6.0. No synthetic network or real credentials are seeded.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.atom_status as enum ('PENDING','ACTIVE','DORMANT','DELETED');
create type public.bond_status as enum ('PENDING','CONFIRMED','REVOKED');
create type public.invitation_status as enum ('ACTIVE','ACCEPTED','EXPIRED','CANCELLED');
create type public.emotion as enum ('JOY','CALM','EXCITED','CURIOUS','SAD','ANXIOUS','ANGRY','AFRAID');

create function private.normalize_email(value text) returns text language sql immutable set search_path = '' as $$
 select lower(regexp_replace(value,E'^[ \t\r\n]+|[ \t\r\n]+$','','g'));
$$;

create table public.locations (
 id uuid primary key default gen_random_uuid(),
 canonical_key text not null unique check (length(canonical_key) between 1 and 200),
 city text not null, region text not null, country text not null,
 country_code text not null check (country_code ~ '^[A-Z]{2}$'),
 display_name text not null,
 centroid_latitude double precision check (centroid_latitude between -90 and 90),
 centroid_longitude double precision check (centroid_longitude between -180 and 180)
);
-- This ledger is append-only, including after retirement/deletion of an Atom.
create sequence private.atom_number_seq as bigint start 1 no cycle;
create table private.atom_numbers (
 number bigint primary key default nextval('private.atom_number_seq') check (number > 0)
);
create table public.atoms (
 id uuid primary key default gen_random_uuid(),
 public_id bigint unique references private.atom_numbers(number),
 display_name text check (length(display_name) between 1 and 80),
 x_handle text check (x_handle ~ '^[A-Za-z0-9_]{1,15}$'),
 location_id uuid not null references public.locations(id),
 status public.atom_status not null default 'PENDING',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_active_at timestamptz,
 check ((status = 'PENDING' and public_id is null) or (status in ('ACTIVE','DORMANT') and public_id is not null) or status = 'DELETED')
);
create table private.atom_identities (
 atom_id uuid primary key references public.atoms(id),
 normalized_email text not null unique check (normalized_email = private.normalize_email(normalized_email) and length(normalized_email) <= 254 and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'),
 email_verified_at timestamptz,
 auth_user_id uuid unique references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.notification_preferences (
 atom_id uuid primary key references public.atoms(id),
 transactional_access boolean not null default true check (transactional_access),
 growth_digest text not null default 'disabled' check (growth_digest in ('weekly','monthly','disabled')),
 pulse_notifications boolean not null default false,
 updated_at timestamptz not null default now()
);
create table private.invitation_key (
 singleton boolean primary key default true check (singleton),
 secret text not null
);
insert into private.invitation_key(secret) values (encode(extensions.gen_random_bytes(32),'hex'));
create table public.bond_invitations (
 id uuid primary key default gen_random_uuid(),
 creator_atom_id uuid not null references public.atoms(id),
 token_hash bytea not null unique check (octet_length(token_hash) = 32),
 status public.invitation_status not null default 'ACTIVE',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '5 minutes'),
 accepted_by_atom_id uuid references public.atoms(id), accepted_at timestamptz,
 check (expires_at > created_at and expires_at <= created_at + interval '5 minutes'),
 check (accepted_by_atom_id is distinct from creator_atom_id),
 check ((status = 'ACCEPTED' and accepted_by_atom_id is not null and accepted_at is not null) or (status <> 'ACCEPTED' and accepted_by_atom_id is null and accepted_at is null))
);
-- Expiration is validated on every use. Creation retires expired ACTIVE rows
-- under an owner-row lock before inserting; no volatile now() index predicate.
create unique index one_active_general_invite on public.bond_invitations(creator_atom_id) where status = 'ACTIVE';
create table private.invitation_secrets (
 invitation_id uuid primary key references public.bond_invitations(id), ciphertext bytea not null
);
create table public.bonds (
 id uuid primary key default gen_random_uuid(),
 atom_a_id uuid not null references public.atoms(id),
 atom_b_id uuid not null references public.atoms(id),
 status public.bond_status not null default 'PENDING',
 origin_invite_id uuid unique references public.bond_invitations(id),
 created_at timestamptz not null default now(), confirmed_at timestamptz,
 check (atom_a_id < atom_b_id),
 unique(atom_a_id, atom_b_id),
 check ((status = 'CONFIRMED') = (confirmed_at is not null))
);
create index bonds_reverse on public.bonds(atom_b_id) where status = 'CONFIRMED';
create table public.emotional_pulses (
 id uuid primary key default gen_random_uuid(),
 atom_id uuid not null unique references public.atoms(id),
 emotion public.emotion not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 check (expires_at = created_at + interval '24 hours')
);

create function private.protect_atom() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP = 'DELETE' then raise exception 'Atom deletion policy is deferred'; end if;
 if TG_OP = 'UPDATE' then
  if OLD.public_id is not null and NEW.public_id is distinct from OLD.public_id then raise exception 'Public Atom numbers are permanent'; end if;
  if OLD.status = 'DELETED' and NEW.status <> 'DELETED' then raise exception 'Retired Atoms cannot reactivate'; end if;
 end if;
 if NEW.status in ('ACTIVE','DORMANT') and not exists(select 1 from private.atom_identities where atom_id = NEW.id and email_verified_at is not null) then raise exception 'Verified identity required'; end if;
 NEW.updated_at := now();
 return NEW;
end $$;
create trigger protect_atom before insert or update or delete on public.atoms for each row execute function private.protect_atom();
create function private.protect_number() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Atom numbers remain permanently retired'; end $$;
create trigger protect_number before update or delete on private.atom_numbers for each row execute function private.protect_number();

create function private.owner_atom(require_active boolean default true) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare result uuid;
begin
 select a.id into result from public.atoms a join private.atom_identities i on i.atom_id=a.id
 join auth.users u on u.id=i.auth_user_id
 where i.auth_user_id=auth.uid() and a.status <> 'DELETED'
 and (not require_active or (a.status in ('ACTIVE','DORMANT') and i.email_verified_at is not null and u.email_confirmed_at is not null and i.normalized_email=private.normalize_email(u.email)));
 if result is null then raise exception 'Verified Atom ownership required' using errcode='42501'; end if;
 return result;
end $$;

-- Only Supabase Auth's trusted user record supplies identity/verification, never
-- browser-supplied email, owner UUID, verification flags or user_metadata.
create function public.begin_atom(p_location_id uuid, p_display_name text default null, p_x_handle text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u auth.users; a public.atoms; email text;
begin
 select * into u from auth.users where id=auth.uid() for update;
 if u.id is null or u.email is null then raise exception 'Authenticated identity required' using errcode='42501'; end if;
 email := private.normalize_email(u.email);
 select t.* into a from public.atoms t join private.atom_identities i on i.atom_id=t.id where i.auth_user_id=u.id;
 if a.id is not null then
  if a.status='DELETED' then raise exception 'Identity retired'; end if;
  return jsonb_build_object('status',a.status,'publicId',a.public_id::text);
 end if;
 -- Unique email constraint also serializes conflicting Auth identities.
 insert into public.atoms(location_id,display_name,x_handle) values(p_location_id,nullif(btrim(p_display_name),''),nullif(regexp_replace(btrim(p_x_handle),'^@',''),'')) returning * into a;
 insert into private.atom_identities(atom_id,normalized_email,auth_user_id) values(a.id,email,u.id);
 insert into private.notification_preferences(atom_id) values(a.id);
 return jsonb_build_object('status','PENDING','publicId',null);
end $$;

create function public.activate_atom() returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.atoms; u auth.users; n bigint;
begin
 select * into u from auth.users where id=auth.uid() for update;
 if u.email_confirmed_at is null then raise exception 'Email verification required' using errcode='42501'; end if;
 select t.* into a from public.atoms t join private.atom_identities i on i.atom_id=t.id where i.auth_user_id=u.id and i.normalized_email=private.normalize_email(u.email) for update of t;
 if a.id is null or a.status='DELETED' then raise exception 'Atom unavailable'; end if;
 update private.atom_identities set email_verified_at=coalesce(email_verified_at,u.email_confirmed_at),updated_at=now() where atom_id=a.id;
 n := a.public_id;
 if n is null then insert into private.atom_numbers default values returning number into n; end if;
 update public.atoms set public_id=n,status='ACTIVE',last_active_at=now() where id=a.id;
 return jsonb_build_object('status','ACTIVE','publicId',n::text);
end $$;

create function public.update_my_atom(p_display_name text, p_x_handle text, p_location_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.atoms set display_name=nullif(btrim(p_display_name),''),x_handle=nullif(regexp_replace(btrim(p_x_handle),'^@',''),''),location_id=p_location_id,last_active_at=now(),status='ACTIVE' where id=private.owner_atom();
end $$;
create function public.my_notification_preferences() returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('transactionalAccess',transactional_access,'growthDigest',growth_digest,'pulseNotifications',pulse_notifications) from private.notification_preferences where atom_id=private.owner_atom();
$$;
create function public.update_notification_preferences(p_growth_digest text,p_pulse_notifications boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom();
begin
 update private.notification_preferences set growth_digest=p_growth_digest,pulse_notifications=p_pulse_notifications,updated_at=now() where atom_id=owner;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner;
end $$;

create function public.create_bond_invitation() returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); inv public.bond_invitations; token text; encryption_key text; issued_at timestamptz;
begin
 perform 1 from public.atoms where id=owner for update;
 update public.bond_invitations set status='EXPIRED' where creator_atom_id=owner and status='ACTIVE' and expires_at<=clock_timestamp();
 delete from private.invitation_secrets s using public.bond_invitations i where s.invitation_id=i.id and i.creator_atom_id=owner and i.status<>'ACTIVE';
 select * into inv from public.bond_invitations where creator_atom_id=owner and status='ACTIVE';
 select secret into encryption_key from private.invitation_key;
 if inv.id is null then
  token := encode(extensions.gen_random_bytes(32),'hex');
  issued_at := clock_timestamp();
  insert into public.bond_invitations(creator_atom_id,token_hash,created_at,expires_at) values(owner,extensions.digest(token,'sha256'),issued_at,issued_at+interval '5 minutes') returning * into inv;
  insert into private.invitation_secrets values(inv.id,extensions.pgp_sym_encrypt(token,encryption_key));
 else
  select extensions.pgp_sym_decrypt(ciphertext,encryption_key) into token from private.invitation_secrets where invitation_id=inv.id;
 end if;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner;
 return jsonb_build_object('id',inv.id,'token',token,'expiresAt',inv.expires_at,'status',inv.status);
end $$;
create function public.resolve_bond_invitation(p_token text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inv public.bond_invitations; number text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation unavailable'; end if;
 select * into inv from public.bond_invitations where token_hash=extensions.digest(p_token,'sha256') and status='ACTIVE' and expires_at>now();
 select public_id::text into number from public.atoms where id=inv.creator_atom_id and status in ('ACTIVE','DORMANT');
 if number is null then raise exception 'Invitation unavailable'; end if;
 return jsonb_build_object('creatorPublicId',number,'expiresAt',inv.expires_at);
end $$;
create function public.cancel_bond_invitation(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom();
begin
 update public.bond_invitations set status='CANCELLED' where id=p_id and creator_atom_id=owner and status='ACTIVE';
 if not found then raise exception 'Invitation unavailable'; end if;
 delete from private.invitation_secrets where invitation_id=p_id;
end $$;
create function public.accept_bond_invitation(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); inv public.bond_invitations; bond public.bonds;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation unavailable'; end if;
 select * into inv from public.bond_invitations where token_hash=extensions.digest(p_token,'sha256') for update;
 if inv.id is null or inv.status<>'ACTIVE' or inv.expires_at<=clock_timestamp() then raise exception 'Invitation unavailable'; end if;
 if inv.creator_atom_id=owner then raise exception 'Self Bonds are prohibited'; end if;
 if not exists(select 1 from public.atoms where id=inv.creator_atom_id and status in ('ACTIVE','DORMANT')) then raise exception 'Invitation unavailable'; end if;
 insert into public.bonds(atom_a_id,atom_b_id,status,origin_invite_id,confirmed_at)
 values(least(owner,inv.creator_atom_id),greatest(owner,inv.creator_atom_id),'CONFIRMED',inv.id,now()) returning * into bond;
 update public.bond_invitations set status='ACCEPTED',accepted_by_atom_id=owner,accepted_at=now() where id=inv.id;
 delete from private.invitation_secrets where invitation_id=inv.id;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner;
 return jsonb_build_object('confirmed',true);
end $$;

create function public.send_emotional_pulse(p_emotion public.emotion) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); p public.emotional_pulses; number text;
begin
 insert into public.emotional_pulses(atom_id,emotion) values(owner,p_emotion)
 on conflict(atom_id) do update set id=gen_random_uuid(),emotion=excluded.emotion,created_at=excluded.created_at,expires_at=excluded.expires_at returning * into p;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner returning public_id::text into number;
 return jsonb_build_object('id',p.id,'atomId',number,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000);
end $$;

-- Graph reach is based exclusively on real, confirmed, non-deleted structure.
create function private.reachable(p_root uuid) returns table(id uuid) language sql stable security definer set search_path = '' as $$
 with recursive reach(id) as (
  select a.id from public.atoms a where a.id=p_root and a.status in ('ACTIVE','DORMANT')
  union
  select case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  from reach r join public.bonds b on b.atom_a_id=r.id or b.atom_b_id=r.id
  join public.atoms a on a.id=case when b.atom_a_id=r.id then b.atom_b_id else b.atom_a_id end
  where b.status='CONFIRMED' and a.status in ('ACTIVE','DORMANT')
 ) select id from reach;
$$;
create function public.connected_emotional_pulses() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'atomId',a.public_id::text,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000) order by a.public_id),'[]'::jsonb) into result
 from public.emotional_pulses p join private.reachable(owner) r on r.id=p.atom_id join public.atoms a on a.id=p.atom_id
 where p.created_at<=now() and p.expires_at>now();
 return result;
end $$;
create function public.public_graph(p_public_id text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare root uuid; members uuid[]; nodes jsonb; edges jsonb;
begin
 select id into root from public.atoms where status in ('ACTIVE','DORMANT') and (p_public_id is null or public_id::text=p_public_id) order by public_id limit 1;
 if root is null then return jsonb_build_object('nodes','[]'::jsonb,'edges','[]'::jsonb); end if;
 select array_agg(id) into members from private.reachable(root);
 if cardinality(members)>5000 then raise exception 'Network exceeds initial retrieval limit'; end if;
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',a.public_id::text,'publicId',a.public_id::text,'displayName',a.display_name,'xHandle',a.x_handle,'createdAt',a.created_at,
  'degree',(select count(*) from public.bonds b where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members) and (b.atom_a_id=a.id or b.atom_b_id=a.id)),
  'metadata',jsonb_build_object('region',l.region,'homeRegion',concat_ws(', ',l.region,l.country),'countryCode',l.country_code)
 )) order by a.public_id),'[]'::jsonb) into nodes from public.atoms a join public.locations l on l.id=a.location_id where a.id=any(members);
 select coalesce(jsonb_agg(jsonb_build_object('id',concat(a.public_id,':',z.public_id),'source',a.public_id::text,'target',z.public_id::text,'createdAt',b.confirmed_at) order by b.id),'[]'::jsonb) into edges
 from public.bonds b join public.atoms a on a.id=b.atom_a_id join public.atoms z on z.id=b.atom_b_id where b.status='CONFIRMED' and b.atom_a_id=any(members) and b.atom_b_id=any(members);
 return jsonb_build_object('nodes',nodes,'edges',edges);
end $$;
create function public.canonical_locations(p_query text default '') returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(t),'[]'::jsonb) from (select id,canonical_key,city,region,country,country_code,display_name from public.locations where display_name ilike '%' || left(p_query,100) || '%' order by display_name limit 50) t;
$$;
create function public.canonical_location(p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',id,'city',city,'region',region,'country',country,'country_code',country_code,'display_name',display_name) from public.locations where id=p_id;
$$;
revoke all on function public.canonical_location(uuid) from public,anon,authenticated;
grant execute on function public.canonical_location(uuid) to anon,authenticated;

-- RLS plus no table grants: only narrowly granted RPCs can cross boundaries.
alter table public.locations enable row level security;
alter table public.atoms enable row level security;
alter table public.bonds enable row level security;
alter table public.bond_invitations enable row level security;
alter table public.emotional_pulses enable row level security;
alter table private.atom_numbers enable row level security;
alter table private.atom_identities enable row level security;
alter table private.notification_preferences enable row level security;
alter table private.invitation_key enable row level security;
alter table private.invitation_secrets enable row level security;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema private from public,anon,authenticated;
revoke all on public.locations,public.atoms,public.bonds,public.bond_invitations,public.emotional_pulses from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.begin_atom(uuid,text,text),public.activate_atom(),public.update_my_atom(text,text,uuid),public.my_notification_preferences(),public.update_notification_preferences(text,boolean),public.create_bond_invitation(),public.resolve_bond_invitation(text),public.cancel_bond_invitation(uuid),public.accept_bond_invitation(text),public.send_emotional_pulse(public.emotion),public.connected_emotional_pulses(),public.public_graph(text),public.canonical_locations(text) from public,anon,authenticated;
grant execute on function public.public_graph(text),public.canonical_locations(text),public.resolve_bond_invitation(text) to anon,authenticated;
grant execute on function public.begin_atom(uuid,text,text),public.activate_atom(),public.update_my_atom(text,text,uuid),public.my_notification_preferences(),public.update_notification_preferences(text,boolean),public.create_bond_invitation(),public.cancel_bond_invitation(uuid),public.accept_bond_invitation(text),public.send_emotional_pulse(public.emotion),public.connected_emotional_pulses() to authenticated;
commit;
