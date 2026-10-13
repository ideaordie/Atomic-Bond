-- Supabase's private download path performs an authenticated object-info check
-- before serving bytes. Apply exactly the same tile predicate to that operation.
-- No table grants, source access, listing, signing, ownership or game changes.
begin;
alter policy puzzle_owner_download on storage.objects using (
 (storage.allow_only_operation('object.get_authenticated') or
  storage.allow_only_operation('object.get_authenticated_info'))
 and private.puzzle_asset_allowed(bucket_id,name)
);
alter policy puzzle_read_boundary on storage.objects using (
 bucket_id not in ('puzzle-originals','puzzle-tiles') or
 ((storage.allow_only_operation('object.get_authenticated') or
   storage.allow_only_operation('object.get_authenticated_info'))
  and private.puzzle_asset_allowed(bucket_id,name)) or
 ((storage.allow_only_operation('object.delete_many') or
   storage.allow_only_operation('object.delete'))
  and private.puzzle_asset_retired(bucket_id,name))
);
commit;
