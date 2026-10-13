-- ONE-TIME approved disposable-media retirement prerequisite (Task #13.3).
-- Physical Storage deletion MUST use the Storage API/dashboard, never SQL.
-- Preserve the separately captured 55-object manifest and SHA-256 audit.
begin;
select private.puzzle_lock();
do $$declare n integer;begin
 if exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled) then raise exception 'Close participation gates';end if;
 if (select count(*) from storage.objects where bucket_id in ('puzzle-originals','puzzle-tiles'))<>55 then raise exception 'Legacy inventory changed';end if;
 if exists(select 1 from storage.objects o where o.bucket_id in ('puzzle-originals','puzzle-tiles') and not exists(select 1 from private.puzzle_assets a where o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end)) then raise exception 'Unmapped object';end if;
 if exists(select 1 from storage.objects o join private.puzzle_assets a on o.name=a.id::text||'.png' where o.bucket_id='puzzle-tiles' and not exists(select 1 from private.puzzle_media m where m.asset_id=a.id)) then raise exception 'Tile replacement missing';end if;
 select count(*) into n from storage.objects o join private.puzzle_assets a on o.name=a.id::text||'.png' and a.kind='source'
 join private.puzzle_assets f on f.batch_id=a.batch_id and f.kind='full' join private.puzzle_media m on m.asset_id=f.id
 where o.bucket_id='puzzle-originals' and encode(sha256(m.content),'hex')='85940bdfba042938af616bc3dbf86cbe8370df67796a54689f1246fe1b09a66b';
 if n<>3 then raise exception 'Synthetic source provenance mismatch';end if;
 insert into private.puzzle_media(asset_id,content)
 select a.id,m.content from storage.objects o join private.puzzle_assets a on o.name=a.id::text||'.png' and a.kind='source'
 join private.puzzle_assets f on f.batch_id=a.batch_id and f.kind='full' join private.puzzle_media m on m.asset_id=f.id
 where o.bucket_id='puzzle-originals' on conflict do nothing;
 if exists(select 1 from storage.objects o join private.puzzle_assets a on o.name=a.id::text||'.png' and a.kind='source' join private.puzzle_media m on m.asset_id=a.id where o.bucket_id='puzzle-originals' and encode(sha256(m.content),'hex')<>'85940bdfba042938af616bc3dbf86cbe8370df67796a54689f1246fe1b09a66b') then raise exception 'Source copy mismatch';end if;
end $$;
commit;
