-- LOCAL PERMISSION CANDIDATE. Requires actual Storage schema at deployment.
-- No password, signing key, JWT or membership is created by this file.
begin;
create role atomic_bond_puzzle_media nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,storage to atomic_bond_puzzle_media;
grant select on storage.objects to atomic_bond_puzzle_media;
-- The custom-role JWT may be selected by the managed API authenticator only.
grant atomic_bond_puzzle_media to authenticator;
create function private.puzzle_source_available(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.puzzles where source_key::text||'.png'=p_name and ends_at+interval '30 days'>private.puzzle_now())
$$;
revoke all on function private.puzzle_source_available(text) from public,anon,authenticated,service_role,atomic_bond_growth;
grant usage on schema private to atomic_bond_puzzle_media;
grant execute on function private.puzzle_source_available(text) to atomic_bond_puzzle_media;
create policy puzzle_media_read on storage.objects for select to atomic_bond_puzzle_media
 using(bucket_id='puzzle-sources' and private.puzzle_source_available(name));
-- No INSERT/UPDATE/DELETE, no bucket administration, no application table access.
create function public.puzzle_media_resolve(p_ticket uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare k private.puzzle_tile_tickets; q private.puzzles; x private.puzzle_pieces; t timestamptz;
begin
 perform private.puzzle_lock(); t:=private.puzzle_now();
 select * into k from private.puzzle_tile_tickets where id=p_ticket and expires_at>t for update;
 if k.id is null then raise exception 'Tile unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.atoms a join private.atom_identities i on i.atom_id=a.id join auth.users u on u.id=i.auth_user_id join auth.sessions s on s.user_id=u.id
 where a.id=k.atom_id and a.status='ACTIVE' and i.auth_user_id=k.user_id and s.id=k.session_id and i.email_verified_at is not null and u.email_confirmed_at is not null and i.normalized_email=private.normalize_email(u.email)) then raise exception 'Tile unavailable' using errcode='42501'; end if;
 select * into q from private.puzzles where id=k.puzzle_id and starts_at<=t and ends_at+interval '30 days'>t;
 if q.id is null then raise exception 'Tile unavailable' using errcode='42501'; end if;
 if k.piece_id is null then
  if q.completed_at is null then raise exception 'Tile unavailable' using errcode='42501'; end if;
 else
  select * into x from private.puzzle_pieces where id=k.piece_id and puzzle_id=q.id;
  if x.id is null or (x.position is null and not exists(select 1 from private.puzzle_reservations where piece_id=x.id and atom_id=k.atom_id and expires_at>t)) then raise exception 'Tile unavailable' using errcode='42501'; end if;
 end if;
 delete from private.puzzle_tile_tickets where id=k.id;
 return jsonb_build_object('object',q.source_key::text||'.png','region',x.solution);
end $$;
revoke all on function public.puzzle_media_resolve(uuid) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.puzzle_media_resolve(uuid) to atomic_bond_puzzle_media;
alter function public.puzzle_media_resolve(uuid) owner to postgres;
alter function private.puzzle_source_available(text) owner to postgres;
commit;
