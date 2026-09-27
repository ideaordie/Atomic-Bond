-- Task #7: session-derived owner projection. No ownership IDs accepted from clients.
begin;
create function public.my_atom() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.atoms;
begin
 select t.* into a from public.atoms t join private.atom_identities i on i.atom_id=t.id
 join auth.users u on u.id=i.auth_user_id
 where i.auth_user_id=auth.uid() and i.normalized_email=private.normalize_email(u.email);
 if a.id is null then return null; end if;
 return jsonb_build_object('publicId',a.public_id::text,'status',a.status,'locationId',a.location_id,'alias',a.display_name,'xHandle',a.x_handle);
end $$;
revoke all on function public.my_atom() from public,anon,authenticated;
grant execute on function public.my_atom() to authenticated;

-- Small curated real-place catalog for initial onboarding, not a synthetic network.
-- Existing verification-only locations are excluded from onboarding searches.
insert into public.locations(canonical_key,city,region,country,country_code,display_name) values
 ('place:us:fl:boynton-beach','Boynton Beach','Florida','United States','US','Boynton Beach, Florida, United States'),
 ('place:us:ny:new-york','New York','New York','United States','US','New York, New York, United States'),
 ('place:us:fl:miami','Miami','Florida','United States','US','Miami, Florida, United States'),
 ('place:ca:on:toronto','Toronto','Ontario','Canada','CA','Toronto, Ontario, Canada'),
 ('place:gb:eng:london','London','England','United Kingdom','GB','London, England, United Kingdom')
 on conflict(canonical_key) do nothing;
create or replace function public.canonical_locations(p_query text default '') returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(t),'[]'::jsonb) from (select id,canonical_key,city,region,country,country_code,display_name from public.locations where canonical_key not like 'verification-%' and display_name ilike '%' || left(p_query,100) || '%' order by display_name limit 50) t;
$$;
commit;
