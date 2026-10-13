-- APPLY ONLY after replacement hosted acceptance. Keep objects for recovery.
begin;
select private.puzzle_lock();
do $$ begin
 if exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled) then raise exception 'Close both gates first';end if;
 if exists(select 1 from private.puzzle_assets a join private.puzzle_batches b on b.id=a.batch_id
 left join private.puzzle_media m on m.asset_id=a.id where b.ready and not b.retiring and a.kind in ('tile','full') and m.asset_id is null) then raise exception 'Incomplete media copy';end if;
end $$;
drop policy puzzle_owner_download on storage.objects;
drop policy puzzle_admin_media_copy on storage.objects;
alter policy puzzle_read_boundary on storage.objects using(
 bucket_id not in ('puzzle-originals','puzzle-tiles') or
 ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
alter policy puzzle_insert_boundary on storage.objects with check(
 bucket_id not in ('puzzle-originals','puzzle-tiles') or
 (bucket_id='puzzle-originals' and storage.allow_only_operation('object.upload') and private.puzzle_upload_allowed(bucket_id,name)));
revoke execute on function public.puzzle_asset(uuid,uuid),private.puzzle_asset_allowed(text,text) from authenticated;
drop function public.puzzle_media_copy_inventory();
drop function private.puzzle_media_copy_allowed(text,text);
commit;
