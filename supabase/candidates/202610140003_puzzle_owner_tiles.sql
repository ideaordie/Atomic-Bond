-- LOCAL ROLLOUT CANDIDATE: apply after 001, NEVER after obsolete media-role 002.
-- No role, credential, signing authority or schedule is created.
begin;
-- Retain gameplay verbatim while removing superseded ticket/cropping operations.
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) set schema private;
alter function private.puzzle_request(text,uuid,uuid,bigint,uuid,integer) rename to puzzle_game_request;
revoke all on function private.puzzle_game_request(text,uuid,uuid,bigint,uuid,integer) from public,anon,authenticated,service_role,atomic_bond_growth;
create function public.puzzle_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_operation not in ('read','reveal','cancel','place','move') or p_operation is null then raise exception 'Invalid operation' using errcode='42501';end if;
 return private.puzzle_game_request(p_operation,p_puzzle,p_request,p_revision,p_piece,p_to);
end $$;
revoke all on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) to authenticated;
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) owner to postgres;
create table private.puzzle_batches (
 id uuid primary key default gen_random_uuid(), created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default clock_timestamp(), ready boolean not null default false, retiring boolean not null default false
);
create table private.puzzle_assets (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references private.puzzle_batches,
 kind text not null check(kind in ('source','full','tile')), solution smallint,
 check((kind='tile' and solution is not null and solution between 0 and 24) or (kind<>'tile' and solution is null)),
 unique nulls not distinct(batch_id,kind,solution)
);
alter table private.puzzle_batches enable row level security;
alter table private.puzzle_assets enable row level security;
revoke all on private.puzzle_batches,private.puzzle_assets from public,anon,authenticated,service_role,atomic_bond_growth;

create function public.puzzle_prepare(p_batch uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 if p_batch is null then
  if (select count(*) from private.puzzle_batches where created_by=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=3 then raise exception 'Preparation limit';end if;
  insert into private.puzzle_batches(created_by) values(auth.uid()) returning id into b;
  insert into private.puzzle_assets(batch_id,kind,solution) select b,'tile',n from generate_series(0,24) n;
  insert into private.puzzle_assets(batch_id,kind) values(b,'source'),(b,'full');
 else
  b:=p_batch;
  if not exists(select 1 from private.puzzle_batches where id=b and created_by=auth.uid() and not ready and created_at>clock_timestamp()-interval '1 hour') then raise exception 'Batch unavailable';end if;
  if (select count(*) from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end where a.batch_id=b and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint between 1 and 2000000)<>27 then raise exception 'Incomplete upload';end if;
  update private.puzzle_batches set ready=true where id=b;
 end if;
 return jsonb_build_object('batch',b,'assets',(select jsonb_agg(jsonb_build_object('name',id::text||'.png','kind',kind,'solution',solution)) from private.puzzle_assets where batch_id=b));
end $$;

create function private.puzzle_upload_allowed(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return exists(select 1 from private.puzzle_assets a join private.puzzle_batches q on q.id=a.batch_id where a.id::text||'.png'=n and b=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end and q.created_by=auth.uid() and not q.ready and q.created_at>clock_timestamp()-interval '1 hour');
exception when insufficient_privilege then return false;end $$;

create function private.puzzle_asset_allowed(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;t timestamptz;begin
 owner_id:=private.puzzle_owner();t:=private.puzzle_now();
 return b='puzzle-tiles' and exists(
 select 1 from private.puzzle_assets a join private.puzzle_batches batch on batch.id=a.batch_id and batch.ready and not batch.retiring
 join private.puzzles q on q.source_key=batch.id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where a.id::text||'.png'=n and q.starts_at<=t and q.ends_at+interval '30 days'>t and
 ((a.kind='full' and (q.completed_at is not null or q.ends_at<=t)) or
 (a.kind='tile' and (p.position is not null or exists(select 1 from private.puzzle_reservations r where r.piece_id=p.id and r.atom_id=owner_id and r.expires_at>t)))));
exception when insufficient_privilege then return false;end $$;

create function public.puzzle_asset(p_puzzle uuid,p_piece uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare asset text;begin
 perform private.puzzle_lock();perform private.puzzle_owner();
 -- Reuse authoritative request throttling without issuing a bearer capability.
 if public.puzzle_request('read',p_puzzle)->>'error'='RATE_LIMITED' then return jsonb_build_object('error','RATE_LIMITED');end if;
 select a.id::text||'.png' into asset from private.puzzle_assets a join private.puzzles q on q.source_key=a.batch_id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where q.id=p_puzzle and ((p_piece is null and a.kind='full') or (p_piece=p.id and a.kind='tile'));
 if asset is null or not private.puzzle_asset_allowed('puzzle-tiles',asset) then return jsonb_build_object('error','TILE_DENIED');end if;
 return jsonb_build_object('name',asset);
end $$;

create or replace function public.puzzle_schedule(p_source uuid,p_start timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;t timestamptz;begin
 perform private.puzzle_lock();perform private.require_signal_admin();t:=private.puzzle_now();
 if p_start is null or not isfinite(p_start) or p_start<t or not exists(select 1 from private.puzzle_batches where id=p_source and ready and not retiring) then raise exception 'Ready batch required';end if;
 if exists(select 1 from private.puzzles where starts_at<p_start+interval '168 hours' and ends_at>p_start) then raise exception 'Overlapping schedule';end if;
 insert into private.puzzles(source_key,starts_at,ends_at) values(p_source,p_start,p_start+interval '168 hours') returning id into result;
 insert into private.puzzle_pieces(puzzle_id,solution) select result,n from generate_series(0,24)n;
 return result;
end $$;

-- Private, immutable assets. Bucket creation remains inside this unapplied candidate.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('puzzle-originals','puzzle-originals',false,2000000,array['image/png']),('puzzle-tiles','puzzle-tiles',false,2000000,array['image/png']);
grant usage on schema storage,private to authenticated;
grant select,insert on storage.objects to authenticated;
create policy puzzle_owner_download on storage.objects for select to authenticated
 using(storage.allow_only_operation('object.get_authenticated') and private.puzzle_asset_allowed(bucket_id,name));
create policy puzzle_admin_upload on storage.objects for insert to authenticated
 with check(storage.allow_only_operation('object.upload') and private.puzzle_upload_allowed(bucket_id,name));
-- No list/info/sign/transform/update/delete policy. No source SELECT, even for admin.
revoke all on function public.puzzle_prepare(uuid),public.puzzle_asset(uuid,uuid),private.puzzle_upload_allowed(text,text),private.puzzle_asset_allowed(text,text) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_prepare(uuid),public.puzzle_asset(uuid,uuid),private.puzzle_upload_allowed(text,text),private.puzzle_asset_allowed(text,text) to authenticated;
alter function public.puzzle_prepare(uuid) owner to postgres;
alter function public.puzzle_asset(uuid,uuid) owner to postgres;
alter function private.puzzle_upload_allowed(text,text) owner to postgres;
alter function private.puzzle_asset_allowed(text,text) owner to postgres;

-- Bounded operator cleanup through Storage API, using the existing admin session.
create function private.puzzle_asset_retired(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return exists(select 1 from private.puzzle_assets a join private.puzzle_batches x on x.id=a.batch_id left join private.puzzles q on q.source_key=x.id
 where a.id::text||'.png'=n and b=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end
 and ((q.id is not null and q.ends_at+interval '30 days'<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())));
exception when insufficient_privilege then return false;end $$;
create function public.puzzle_cleanup_batch(p_ack uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();perform private.puzzle_cleanup(1);
 select x.id into batch from private.puzzle_batches x left join private.puzzles q on q.source_key=x.id
 where (p_ack is null or x.id=p_ack) and ((q.id is not null and q.ends_at+interval '30 days'<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())) order by x.created_at limit 1 for update of x;
 if batch is null then return jsonb_build_object('assets','[]'::jsonb);end if;
 if p_ack is not null then
  if exists(select 1 from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end where a.batch_id=batch) then raise exception 'Storage deletion incomplete';end if;
  delete from private.puzzle_assets where batch_id=batch;
  delete from private.puzzle_batches where id=batch;
  delete from private.puzzle_cleanup_queue where source_key=batch;
  return jsonb_build_object('removed',true);
 end if;
 update private.puzzle_batches set retiring=true where id=batch;
 return jsonb_build_object('batch',batch,'assets',(select jsonb_agg(jsonb_build_object('bucket',case when kind='source' then 'puzzle-originals' else 'puzzle-tiles' end,'name',id::text||'.png')) from private.puzzle_assets where batch_id=batch));
end $$;
grant delete on storage.objects to authenticated;
create policy puzzle_admin_cleanup_read on storage.objects for select to authenticated using((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name));
create policy puzzle_admin_cleanup on storage.objects for delete to authenticated using((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name));
revoke all on function private.puzzle_asset_retired(text,text),public.puzzle_cleanup_batch(uuid) from public,anon,service_role,atomic_bond_growth;
grant execute on function private.puzzle_asset_retired(text,text),public.puzzle_cleanup_batch(uuid) to authenticated;
alter function private.puzzle_asset_retired(text,text) owner to postgres;
alter function public.puzzle_cleanup_batch(uuid) owner to postgres;
-- Keep unrelated future permissive policies from widening these two buckets.
create policy puzzle_read_boundary on storage.objects as restrictive for select to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles') or
 (storage.allow_only_operation('object.get_authenticated') and private.puzzle_asset_allowed(bucket_id,name)) or
 ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
create policy puzzle_insert_boundary on storage.objects as restrictive for insert to authenticated
 with check(bucket_id not in ('puzzle-originals','puzzle-tiles') or (storage.allow_only_operation('object.upload') and private.puzzle_upload_allowed(bucket_id,name)));
create policy puzzle_update_boundary on storage.objects as restrictive for update to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles')) with check(bucket_id not in ('puzzle-originals','puzzle-tiles'));
create policy puzzle_delete_boundary on storage.objects as restrictive for delete to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles') or ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
commit;
