-- Administrator-only inventory and prepared-artwork preview. No gameplay changes.
begin;
-- PostgreSQL is now the only preparation path. Retire obsolete Storage uploads.
drop policy if exists puzzle_admin_upload on storage.objects;
alter policy puzzle_insert_boundary on storage.objects with check(bucket_id not in ('puzzle-originals','puzzle-tiles'));
revoke execute on function private.puzzle_upload_allowed(text,text) from authenticated;
create function public.puzzle_studio(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz; result jsonb;
begin
 perform private.require_signal_admin();
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid page';end if;
 t:=private.puzzle_now();
 select jsonb_build_object(
  'now',t,
  'gates',(select jsonb_build_object('public',public_enabled,'controlled',controlled_enabled) from private.puzzle_access_settings),
  'cleanup',(select jsonb_build_object('lastSuccess',last_success,'lastFailure',last_failure,'ok',last_ok,'counts',counts) from private.puzzle_cleanup_health where singleton),
  'total',(select count(*) from private.puzzle_batches where not retiring),
  'batches',coalesce((select jsonb_agg(row_data order by created_at desc,id) from (
   select b.id,b.created_at,jsonb_build_object('id',b.id,'createdAt',b.created_at,'ready',b.ready,
    'expiresAt',case when q.id is null then b.created_at+interval '24 hours' end,
    'mediaCount',(select count(*) from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id=b.id),
    'puzzle',case when q.id is null then null else jsonb_build_object('id',q.id,'start',q.starts_at,'end',q.ends_at,
      'state',case when t<q.starts_at then 'SCHEDULED' when t>=q.ends_at then 'CLOSED' when q.completed_at is not null then 'COMPLETED' else 'ACTIVE' end,
      'placed',(select count(*) from private.puzzle_pieces p where p.puzzle_id=q.id and p.position is not null),
      'locked',(select count(*) from private.puzzle_pieces p where p.puzzle_id=q.id and p.locked)) end) row_data
   from private.puzzle_batches b left join private.puzzles q on q.source_key=b.id where not b.retiring
   order by b.created_at desc,b.id limit 20 offset p_offset
  )s),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.puzzle_studio_preview(p_batch uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload bytea;
begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 select m.content into payload from private.puzzle_batches b join private.puzzle_assets a on a.batch_id=b.id and a.kind='full'
 join private.puzzle_media m on m.asset_id=a.id where b.id=p_batch and b.ready and not b.retiring;
 if payload is null then raise exception 'Preview unavailable' using errcode='42501';end if;
 return jsonb_build_object('content',encode(payload,'base64'),'bytes',octet_length(payload));
end $$;
revoke all on function public.puzzle_studio(integer),public.puzzle_studio_preview(uuid) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_studio(integer),public.puzzle_studio_preview(uuid) to authenticated;
alter function public.puzzle_studio(integer) owner to postgres;
alter function public.puzzle_studio_preview(uuid) owner to postgres;
commit;
