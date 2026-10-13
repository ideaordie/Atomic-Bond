-- Task #13.2: reopen ONLY previously approved unexpired #4/#5 test membership.
-- No extension of membership, account mutation, gameplay or cooldown adjustment.
begin;
select private.puzzle_lock();
do $$ begin
 if exists(select 1 from private.puzzle_access_settings where public_enabled) then raise exception 'Public gate must be OFF';end if;
 if exists(select 1 from private.puzzle_assets a join private.puzzle_batches b on b.id=a.batch_id
  left join private.puzzle_media m on m.asset_id=a.id
  where b.ready and not b.retiring and a.kind in ('tile','full') and m.asset_id is null) then raise exception 'Incomplete media copy';end if;
 if (select count(*) from private.puzzle_test_members m join public.atoms a on a.id=m.atom_id
  where a.public_id in (4,5) and a.status='ACTIVE' and m.expires_at>clock_timestamp())<>2 then raise exception 'Approved memberships unavailable';end if;
 if exists(select 1 from private.puzzle_test_members m join public.atoms a on a.id=m.atom_id where a.public_id not in (4,5)) then raise exception 'Unexpected membership';end if;
end $$;
update private.puzzle_access_settings set controlled_enabled=true;
commit;
