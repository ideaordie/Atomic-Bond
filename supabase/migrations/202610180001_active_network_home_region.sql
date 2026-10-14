-- Task #14.1. Local candidate: ACTIVE-only connectivity and dedicated Home Region editing.
begin;
select private.lifecycle_lock();
-- Do not change a digest whose provider handoff might already be in flight.
do $$ begin
 if exists(select 1 from private.growth_deliveries where status='attempted' and lease_until>clock_timestamp()) then
  raise exception 'Growth delivery in flight; retry migration after settlement';
 end if;
end $$;
create or replace function private.reachable(p_root uuid) returns table(id uuid)
language plpgsql stable security definer set search_path='' as $$
declare members uuid[];
begin
 -- Demand-driven recursive UNION deduplicates cycles. LIMIT bounds recursive output
 -- before aggregation; never sort/materialize the full historical component first.
 with recursive reach(id) as (
  select a.id from public.atoms a where a.id=p_root and a.public_id is not null and a.status='ACTIVE'
  union
  select a.id from reach r cross join lateral (
   select b.atom_b_id id from public.bonds b where b.atom_a_id=r.id and b.status='CONFIRMED'
   union all
   select b.atom_a_id id from public.bonds b where b.atom_b_id=r.id and b.status='CONFIRMED'
  ) e join public.atoms a on a.id=e.id where a.status='ACTIVE' and a.public_id is not null
 ) select array_agg(bounded.id) into members from (select reach.id from reach limit 5001) bounded;
 if cardinality(members)>5000 then raise exception 'Network exceeds initial retrieval limit'; end if;
 return query select unnest(members);
end $$;
revoke all on function private.reachable(uuid) from public,anon,authenticated,atomic_bond_growth;


create or replace function public.public_graph(p_public_id text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare root uuid; members uuid[]; nodes jsonb; edges jsonb;
begin
 select id into root from public.atoms where public_id is not null and status='ACTIVE' and (p_public_id is null or public_id::text=p_public_id) order by public_id limit 1;
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
 join public.locations l on l.id=a.location_id where a.id<>p_atom and a.status='ACTIVE')
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

create or replace function public.connected_emotional_pulses() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'atomId',a.public_id::text,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000) order by a.public_id),'[]'::jsonb) into result
 from public.emotional_pulses p join private.reachable(owner) r on r.id=p.atom_id join public.atoms a on a.id=p.atom_id
 where a.status='ACTIVE' and p.created_at<=now() and p.expires_at>now();
 return result;
end $$;

create or replace function public.admin_network_report() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 root record; members uuid[]; seen uuid[] := array[]::uuid[];
 groups jsonb := '[]'::jsonb; founding jsonb := null;
 isolated jsonb := '[]'::jsonb; item jsonb; numbers jsonb;
 n bigint; active_n bigint; edges bigint; earliest timestamptz;
 regions bigint; countries bigint; largest bigint := 0;
 total_edges bigint := 0; organic bigint := 0;
begin
 perform private.require_signal_admin();
 for root in select id,public_id from public.atoms
   where public_id is not null and status='ACTIVE' order by public_id
 loop
  if root.id=any(seen) then continue; end if;
  select array_agg(id) into members from private.reachable(root.id);
  seen:=seen||members;
  select count(*),count(*) filter(where status='ACTIVE'),jsonb_agg(public_id::text order by public_id)
   into n,active_n,numbers from public.atoms where id=any(members);
  select count(*),min(confirmed_at) into edges,earliest from public.bonds
   where status='CONFIRMED' and atom_a_id=any(members) and atom_b_id=any(members);
  -- Aggregate only normally visible coarse geography; never retained inactive locations.
  select count(distinct coalesce(l.subdivision_code,
    (select q.subdivision_code from public.locations q where q.country_code=l.country_code and q.region=l.region and q.subdivision_code is not null order by q.id limit 1),
    l.country_code||':'||nullif(l.region,''),l.country_code)),count(distinct l.country_code)
   into regions,countries from public.atoms a join public.locations l on l.id=a.location_id
   where a.id=any(members) and a.status='ACTIVE';
  item:=jsonb_build_object('id',root.public_id::text,'atomCount',n,'activeAtomCount',active_n,
   'bondCount',edges,'publicNumbers',numbers,'regions',regions,'countries',countries,
   'earliestRetainedBond',earliest,'founding',numbers ? '1');
  if numbers ? '1' then founding:=item; end if;
  if edges>0 then
   groups:=groups||jsonb_build_array(item);
   total_edges:=total_edges+edges;
   largest:=greatest(largest,n);
   if not (numbers ? '1') then organic:=organic+1; end if;
  elsif active_n>0 then isolated:=isolated||numbers;
  end if;
 end loop;
 return jsonb_build_object('generatedAt',statement_timestamp(),'activeAtoms',
  (select count(*) from public.atoms where status='ACTIVE'),
  'confirmedBonds',total_edges,'connectedGroups',jsonb_array_length(groups),
  'organicGroups',organic,'isolatedAtoms',isolated,'largestGroup',largest,
  'foundingNetwork',founding,'groups',groups,'historyAvailable',false);
end $$;

create or replace function private.doodle_network_feed(p_before timestamptz,p_id uuid,p_visible jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); t timestamptz:=private.doodle_now(); members uuid[]; page jsonb; last_item jsonb; more boolean;
begin
 if jsonb_typeof(p_visible)<>'array' or jsonb_array_length(p_visible)>100 then raise exception 'Invalid visible window'; end if;
 if (p_before is null)<>(p_id is null) then raise exception 'Complete cursor required'; end if;
 -- One shared bounded ACTIVE-only traversal, rooted in verified ownership.
 select array_agg(id) into members from private.reachable(owner);
 with eligible as materialized (
 select d.* from private.doodles d join public.atoms a on a.id=d.atom_id
 where d.atom_id=any(members) and a.status='ACTIVE' and d.state='PUBLISHED' and d.expires_at>t
 and (p_before is null or (d.published_at,d.id)<(p_before,p_id))
 order by d.published_at desc,d.id desc limit 21),
 displayed as (select * from eligible order by published_at desc,id desc limit 20)
 select coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.published_at desc,d.id desc) from displayed d),'[]'::jsonb),
 (select count(*)>20 from eligible) into page,more;
 last_item:=page->-1;
 return jsonb_build_object('serverTime',t,'submissionsPaused',(select submissions_paused from private.doodle_settings),
 'nextEligibleAt',(select last_submitted+interval '60 minutes' from private.doodle_accounts where atom_id=owner),
 'items',page,'nextCursor',case when more then jsonb_build_array(last_item->>'publishedAt',last_item->>'id') else null end,
 'refreshed',coalesce((select jsonb_agg(private.doodle_display(d,owner)) from private.doodles d join public.atoms a on a.id=d.atom_id
 where d.id in(select value::uuid from jsonb_array_elements_text(p_visible)) and d.atom_id=any(members)
 and a.status='ACTIVE' and d.state='PUBLISHED' and d.expires_at>t),'[]'::jsonb),
 'hall',coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.final_score desc,d.promoted_at,d.id)
 from private.doodle_hall h join private.doodles d on d.id=h.doodle_id join public.atoms a on a.id=d.atom_id where d.state='HALL' and a.status='ACTIVE'),'[]'::jsonb));
end $$;


create function public.update_my_home_region(p_location_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 perform private.lifecycle_lock();
 owner:=private.owner_atom();
 perform 1 from public.atoms where id=owner and status='ACTIVE' for update;
 if not found then raise exception 'ACTIVE verified owner required' using errcode='42501'; end if;
 -- Only operator-seeded canonical country/root-subdivision records, not legacy cities.
 if not exists(select 1 from public.locations l where l.id=p_location_id
  and l.canonical_key='iso3166:'||coalesce(l.subdivision_code,l.country_code)
  and l.id::text='ab830000-0000-4000-8000-'||rpad(encode(convert_to(coalesce(l.subdivision_code,l.country_code),'UTF8'),'hex'),12,'0')
  and l.city='') then raise exception 'Canonical Home Region required' using errcode='22023'; end if;
 update public.atoms set location_id=p_location_id where id=owner;
end $$;
revoke all on function public.update_my_home_region(uuid) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.update_my_home_region(uuid) to authenticated;
alter function public.update_my_home_region(uuid) owner to postgres;

create or replace function public.update_my_atom(p_display_name text,p_x_handle text,p_location_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid; current_location uuid;
begin
 perform private.lifecycle_lock();
 owner:=private.owner_atom();
 select location_id into current_location from public.atoms where id=owner for update;
 -- Retain the legacy signature for deployed clients, but never accept its location.
 -- Reading after the lifecycle lock also prevents stale profile saves undoing edits.
 perform private.before_deletion_update_my_atom(p_display_name,p_x_handle,current_location);
end $$;

-- Only mutable future baselines change. Sent-period/history/preferences are untouched.
update private.growth_state set baseline=private.growth_metrics(atom_id),evaluated_at=now();
-- Re-evaluate outstanding work against the rebased baseline: no transition growth.
-- Retain period keys, snapshots and provider hashes. An uncertain old attempt must
-- not be retried with obsolete metrics or a changed idempotent payload.
update private.growth_deliveries set status='cancelled',lease_until=null
 where status in ('prepared','attempted','failed');
commit;
