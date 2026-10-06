-- Read-only structural analytics. Reuses existing verified ACTIVE admin membership.
create function public.admin_network_report() returns jsonb
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
   where public_id is not null and status in ('ACTIVE','DORMANT','DEACTIVATED','DELETED') order by public_id
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
   where a.id=any(members) and a.status in ('ACTIVE','DORMANT');
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
alter function public.admin_network_report() owner to postgres;
revoke all on function public.admin_network_report() from public,anon,authenticated;
grant execute on function public.admin_network_report() to authenticated;
comment on function public.admin_network_report() is 'Read-only current structural components; verified ACTIVE Signal administrator required. No historical event claims.';
