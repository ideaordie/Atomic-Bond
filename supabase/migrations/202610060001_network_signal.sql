-- Global beta communication. No participant rows or memberships are seeded.
begin;
create table private.signal_administrators (
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table private.network_signals (
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('COMMUNITY','ATOMIC_BOND','SPONSORED')),
 title text not null check(length(btrim(title)) between 1 and 80),
 message text not null check(length(btrim(message)) between 1 and 500),
 link_label text check(length(btrim(link_label)) between 1 and 40),
 link_url text check(length(link_url)<=2048 and link_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(/[^[:space:]\\]*)?$' and link_url !~ '[[:cntrl:]]'),
 starts_at timestamptz, ends_at timestamptz,
 publication text not null default 'DRAFT' check(publication in ('DRAFT','PUBLISHED','UNPUBLISHED')),
 published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((link_label is null) = (link_url is null)),
 check (ends_at is null or starts_at is null or ends_at>starts_at),
 check (publication<>'PUBLISHED' or (type<>'SPONSORED' and starts_at is not null and published_at is not null))
);
create index network_signals_window on private.network_signals(starts_at,ends_at) where publication='PUBLISHED';
alter table private.signal_administrators enable row level security;
alter table private.network_signals enable row level security;
revoke all on private.signal_administrators,private.network_signals from public,anon,authenticated,atomic_bond_growth;

create function private.require_signal_admin() returns void language plpgsql stable security definer set search_path='' as $$
declare owned uuid;
begin
 owned:=private.account_owner();
 if not exists(select 1 from public.atoms where id=owned and status='ACTIVE')
 or not exists(select 1 from private.signal_administrators where auth_user_id=auth.uid())
 then raise exception 'Signal administration denied' using errcode='42501'; end if;
end $$;
create function private.signal_state(s private.network_signals) returns text language sql stable set search_path='' as $$
 select case when s.publication<>'PUBLISHED' then s.publication
 when s.ends_at<=now() then 'EXPIRED' when s.starts_at>now() then 'SCHEDULED' else 'ACTIVE' end
$$;
create function private.signal_display(s private.network_signals) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'type',s.type,'title',s.title,'message',s.message,
 'linkLabel',s.link_label,'linkUrl',s.link_url,'publishedAt',s.published_at,'startsAt',s.starts_at,'endsAt',s.ends_at)
$$;
-- Operational provisioning only; no client or application role can execute this.
create function private.provision_signal_administrator(p_number bigint,p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select i.auth_user_id into target from public.atoms a join private.atom_identities i on i.atom_id=a.id
 join auth.users u on u.id=i.auth_user_id where a.public_id=p_number and a.status='ACTIVE'
 and i.email_verified_at is not null and u.email_confirmed_at is not null
 and i.normalized_email=private.normalize_email(u.email);
 if target is null then raise exception 'Verified active ownership required'; end if;
 if p_enabled then insert into private.signal_administrators(auth_user_id) values(target) on conflict do nothing;
 else delete from private.signal_administrators where auth_user_id=target; end if;
 return true;
end $$;
create function public.signal_admin_history() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return coalesce((select jsonb_agg(private.signal_display(s)||jsonb_build_object('state',private.signal_state(s)) order by s.created_at desc)
 from (select * from private.network_signals where id in (select id from private.network_signals order by created_at desc limit 50) or private.signal_state(network_signals)='ACTIVE') s),'[]'::jsonb);
end $$;
create function public.current_network_signal() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owned uuid;
begin
 owned:=private.account_owner();
 if not exists(select 1 from public.atoms where id=owned and status='ACTIVE') then raise exception 'Active ownership required' using errcode='42501'; end if;
 return (select private.signal_display(s) from private.network_signals s where publication='PUBLISHED'
 and type in ('COMMUNITY','ATOMIC_BOND') and starts_at<=now() and (ends_at is null or ends_at>now()) limit 1);
end $$;
create function public.save_signal_draft(p_id uuid,p_type text,p_title text,p_message text,p_label text,p_url text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_signal_admin();
 perform pg_advisory_xact_lock(100010);
 if p_type not in ('COMMUNITY','ATOMIC_BOND') then raise exception 'Type unavailable in beta'; end if;
 if p_id is null then
 insert into private.network_signals(type,title,message,link_label,link_url,starts_at,ends_at)
 values(p_type,btrim(p_title),btrim(p_message),nullif(btrim(p_label),''),nullif(btrim(p_url),''),p_start,p_end) returning id into result;
 else
 update private.network_signals set type=p_type,title=btrim(p_title),message=btrim(p_message),link_label=nullif(btrim(p_label),''),
 link_url=nullif(btrim(p_url),''),starts_at=p_start,ends_at=p_end,updated_at=now() where id=p_id and publication='DRAFT' returning id into result;
 if result is null then raise exception 'Editable draft unavailable'; end if;
 end if;
 return result;
end $$;
create function public.publish_network_signal(p_id uuid,p_replace uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare draft private.network_signals; starts timestamptz;
begin
 perform private.require_signal_admin();
 perform pg_advisory_xact_lock(100010);
 select * into draft from private.network_signals where id=p_id and publication='DRAFT' for update;
 if draft.id is null or draft.type='SPONSORED' then raise exception 'Publishable draft required'; end if;
 starts:=greatest(coalesce(draft.starts_at,now()),now());
 if draft.ends_at<=starts then raise exception 'End must be after start'; end if;
 if p_replace is not null then
 if starts>now() then raise exception 'End scheduled conflicts explicitly before scheduling'; end if;
 update private.network_signals set publication='UNPUBLISHED',updated_at=now() where id=p_replace and private.signal_state(network_signals)='ACTIVE';
 if not found then raise exception 'Replacement changed; review current Signal'; end if;
 end if;
 if exists(select 1 from private.network_signals where publication='PUBLISHED'
 and tstzrange(starts_at,ends_at,'[)') && tstzrange(starts,draft.ends_at,'[)')) then raise exception 'Publication window overlaps; explicitly end or replace the existing Signal'; end if;
 update private.network_signals set publication='PUBLISHED',starts_at=starts,published_at=now(),updated_at=now() where id=p_id;
end $$;
create function public.end_network_signal(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin(); perform pg_advisory_xact_lock(100010);
 update private.network_signals set publication='UNPUBLISHED',updated_at=now() where id=p_id;
end $$;
revoke all on function private.require_signal_admin(),private.signal_state(private.network_signals),private.signal_display(private.network_signals),private.provision_signal_administrator(bigint,boolean) from public,anon,authenticated,atomic_bond_growth;
revoke all on function public.signal_admin_history(),public.current_network_signal(),public.save_signal_draft(uuid,text,text,text,text,text,timestamptz,timestamptz),public.publish_network_signal(uuid,uuid),public.end_network_signal(uuid) from public,anon;
grant execute on function public.signal_admin_history(),public.current_network_signal(),public.save_signal_draft(uuid,text,text,text,text,text,timestamptz,timestamptz),public.publish_network_signal(uuid,uuid),public.end_network_signal(uuid) to authenticated;
commit;
