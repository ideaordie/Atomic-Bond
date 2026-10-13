-- Task #13.2. Additive media replacement. Old Storage objects/policies remain
-- until verified copy and hosted acceptance; public participation stays OFF.
begin;
create table private.puzzle_media (
 asset_id uuid primary key references private.puzzle_assets(id) on delete cascade,
 content bytea not null check(octet_length(content) between 8 and 2000000),
 check(substring(content from 1 for 8)=decode('89504e470d0a1a0a','hex')),
 created_at timestamptz not null default clock_timestamp()
);
alter table private.puzzle_media enable row level security;
revoke all on private.puzzle_media from public,anon,authenticated,service_role,atomic_bond_growth;

-- Immutable uploads, including controlled migration of existing READY batches.
-- Migration imports are possible only while both database gates are closed.
create function public.puzzle_media_put(p_asset uuid,p_content text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload bytea; a private.puzzle_assets; b private.puzzle_batches; old bytea;
begin
 perform private.puzzle_lock(); perform private.require_signal_admin();
 if p_content is null or length(p_content)>2666668 then raise exception 'Invalid media';end if;
 payload:=decode(p_content,'base64');
 select * into a from private.puzzle_assets where id=p_asset;
 select * into b from private.puzzle_batches where id=a.batch_id;
 if a.id is null or a.kind not in ('tile','full') or b.retiring or
  (not b.ready and (b.created_by is distinct from auth.uid() or b.created_at<=clock_timestamp()-interval '1 hour')) or
  (b.ready and exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled)) then
  raise exception 'Media unavailable' using errcode='42501';end if;
 select content into old from private.puzzle_media where asset_id=p_asset;
 if old is not null and old<>payload then raise exception 'Immutable media';end if;
 insert into private.puzzle_media(asset_id,content) values(p_asset,payload) on conflict do nothing;
 return jsonb_build_object('bytes',octet_length(payload),'sha256',encode(sha256(payload),'hex'));
end $$;

-- No gameplay read/expire call: authorization cannot depend on cleanup.
-- The existing lifecycle/puzzle lock serializes cancellation and byte selection.
create function public.puzzle_media_get(p_puzzle uuid,p_piece uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; t timestamptz; account private.puzzle_allowances; payload bytea;
begin
 perform private.puzzle_lock(); actor:=private.puzzle_owner(); t:=private.puzzle_now();
 insert into private.puzzle_allowances(atom_id) values(actor) on conflict do nothing;
 select * into account from private.puzzle_allowances where atom_id=actor for update;
 if account.window_start+interval '1 minute'<=t then
  update private.puzzle_allowances set window_start=t,requests=1 where atom_id=actor;
 elsif account.requests>=120 then return jsonb_build_object('error','RATE_LIMITED');
 else update private.puzzle_allowances set requests=requests+1 where atom_id=actor;end if;
 select m.content into payload from private.puzzle_media m
 join private.puzzle_assets a on a.id=m.asset_id
 join private.puzzle_batches b on b.id=a.batch_id and b.ready and not b.retiring
 join private.puzzles q on q.source_key=b.id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where q.id=p_puzzle and q.starts_at<=t and q.ends_at+interval '30 days'>t and
 ((p_piece is null and a.kind='full' and (q.completed_at is not null or q.ends_at<=t)) or
 (p_piece=p.id and a.kind='tile' and (p.position is not null or
  (q.ends_at>t and q.completed_at is null and exists(select 1 from private.puzzle_reservations r
   where r.piece_id=p.id and r.atom_id=actor and r.expires_at>t)))));
 if payload is null then return jsonb_build_object('error','TILE_DENIED');end if;
 return jsonb_build_object('content',encode(payload,'base64'),'bytes',octet_length(payload));
end $$;

-- Readiness now requires 26 database assets and the private normalized source.
create or replace function public.puzzle_prepare(p_batch uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 if p_batch is null then
  if (select count(*) from private.puzzle_batches where created_by=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=3 then raise exception 'Preparation limit';end if;
  insert into private.puzzle_batches(created_by) values(auth.uid()) returning id into b;
  insert into private.puzzle_assets(batch_id,kind,solution) select b,'tile',n from generate_series(0,24)n;
  insert into private.puzzle_assets(batch_id,kind) values(b,'source'),(b,'full');
 else
  b:=p_batch;
  if not exists(select 1 from private.puzzle_batches where id=b and created_by=auth.uid() and not ready and not retiring and created_at>clock_timestamp()-interval '1 hour') then raise exception 'Batch unavailable';end if;
  if (select count(*) from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id=b and a.kind in ('tile','full'))<>26 or
   not exists(select 1 from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id='puzzle-originals'
    where a.batch_id=b and a.kind='source' and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint between 1 and 2000000) then raise exception 'Incomplete upload';end if;
  update private.puzzle_batches set ready=true where id=b;
 end if;
 return jsonb_build_object('batch',b,'assets',(select jsonb_agg(jsonb_build_object('name',id::text||'.png','kind',kind,'solution',solution)) from private.puzzle_assets where batch_id=b));
end $$;

revoke all on function public.puzzle_media_get(uuid,uuid),public.puzzle_media_put(uuid,text) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.puzzle_media_get(uuid,uuid),public.puzzle_media_put(uuid,text) to authenticated;
alter function public.puzzle_media_get(uuid,uuid) owner to postgres;
alter function public.puzzle_media_put(uuid,text) owner to postgres;
-- Existing bounded cleanup deletes assets only after retention/Storage acknowledgement.
-- ON DELETE CASCADE removes their byte records atomically; active assets are untouched.
-- Temporary migration-only read authority: existing administrators, READY tiles,
-- both gates OFF. It is removed by the separately staged retirement migration.
create function private.puzzle_media_copy_allowed(b text,n text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return b='puzzle-tiles' and not exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled)
 and exists(select 1 from private.puzzle_assets a join private.puzzle_batches x on x.id=a.batch_id
 where a.id::text||'.png'=n and a.kind in ('tile','full') and x.ready and not x.retiring);
exception when insufficient_privilege then return false;end $$;
create function public.puzzle_media_copy_inventory() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 if exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled) then raise exception 'Close gates before migration';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'bytes',octet_length(m.content),'sha256',encode(sha256(m.content),'hex')) order by (m.asset_id is null) desc,a.id),'[]'::jsonb)
 from private.puzzle_assets a join private.puzzle_batches b on b.id=a.batch_id
 left join private.puzzle_media m on m.asset_id=a.id
 where a.kind in ('tile','full') and b.ready and not b.retiring);
end $$;
revoke all on function private.puzzle_media_copy_allowed(text,text),public.puzzle_media_copy_inventory() from public,anon,service_role,atomic_bond_growth;
grant execute on function private.puzzle_media_copy_allowed(text,text),public.puzzle_media_copy_inventory() to authenticated;
alter function private.puzzle_media_copy_allowed(text,text) owner to postgres;
alter function public.puzzle_media_copy_inventory() owner to postgres;
create policy puzzle_admin_media_copy on storage.objects for select to authenticated using(
 (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))
 and private.puzzle_media_copy_allowed(bucket_id,name));
alter policy puzzle_read_boundary on storage.objects using(
 bucket_id not in ('puzzle-originals','puzzle-tiles') or
 ((storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info')) and
 (private.puzzle_asset_allowed(bucket_id,name) or private.puzzle_media_copy_allowed(bucket_id,name))) or
 ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
commit;
