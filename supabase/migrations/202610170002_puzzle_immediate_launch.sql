-- One-time, product-owner-approved immediate launch. No gameplay/data reset.
begin;
select private.puzzle_lock();
lock table private.puzzles in exclusive mode;
do $$
declare t timestamptz; official uuid:='f2870bd6-d907-4282-9008-20d02f95f3b0';
 old_a uuid:='1129c11d-cea4-4b90-bd0b-1ea0516fd0f3'; old_b uuid:='cd79a42e-28e3-4ce0-b55b-3b50bfbfd611';
 before_state jsonb; after_state jsonb;
begin
 if not exists(select 1 from private.puzzle_launch_settings where first_puzzle=official) then raise exception 'Unexpected launch anchor';end if;
 if not exists(select 1 from private.puzzles where id=official and source_key='7c36c311-2a91-465e-8923-10e7efccc903'
  and starts_at='2026-10-27 04:00Z' and ends_at='2026-11-03 04:00Z' and starts_at>clock_timestamp()
  and revision=0 and placements=0 and moves=0 and participants=0 and completed_at is null) then raise exception 'Official puzzle changed or started';end if;
 if (select count(*) from private.puzzle_pieces where puzzle_id=official and position is null and not locked)<>25 then raise exception 'Official board touched';end if;
 if exists(select 1 from private.puzzle_reservations) or exists(select 1 from private.puzzle_contributors where puzzle_id=official) then raise exception 'Unexpected participation';end if;
 if not exists(select 1 from private.puzzles where id=old_a and source_key='3ef7302f-81f9-4637-9b6c-1d9717c85fe5' and starts_at='2026-10-13 02:43:22.981Z' and ends_at='2026-10-20 02:43:22.981Z' and revision=16) or
 not exists(select 1 from private.puzzles where id=old_b and source_key='10444948-fd34-4d37-af55-b5ffcae5b381' and starts_at='2026-10-20 04:00Z' and ends_at='2026-10-27 04:00Z' and revision=0) then raise exception 'Disposable windows differ';end if;
 if exists(select 1 from private.puzzle_contributors c join public.atoms a on a.id=c.atom_id where c.puzzle_id in(old_a,old_b) and a.public_id not in(4,5)) then raise exception 'Non-test contributor';end if;
 if not exists(select 1 from private.puzzle_batches where id='7c36c311-2a91-465e-8923-10e7efccc903' and ready and not retiring) or
 (select count(*) from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id='7c36c311-2a91-465e-8923-10e7efccc903')<>27 then raise exception 'Official media unavailable';end if;
 if not exists(select 1 from private.puzzle_cleanup_health where singleton and last_ok and last_success>clock_timestamp()-interval '15 minutes') then raise exception 'Cleanup unhealthy';end if;
 select jsonb_build_object('pieces',(select jsonb_agg(to_jsonb(p) order by id) from private.puzzle_pieces p),'allowances',(select jsonb_agg(to_jsonb(a) order by atom_id) from private.puzzle_allowances a),'media',(select jsonb_agg(jsonb_build_array(asset_id,encode(sha256(content),'hex')) order by asset_id) from private.puzzle_media),'games',(select jsonb_agg(to_jsonb(q)-'starts_at'-'ends_at' order by id) from private.puzzles q)) into before_state;
 t:=clock_timestamp();
 if exists(select 1 from private.puzzles where id not in(official,old_a,old_b) and starts_at<t+interval '168 hours' and ends_at>t-interval '336 hours') then raise exception 'Unexpected conflicting window';end if;
 -- Retire disposable fixtures without deleting their progress or altering allowances.
 update private.puzzles set starts_at=t-interval '336 hours',ends_at=t-interval '168 hours' where id=old_a;
 update private.puzzles set starts_at=t-interval '168 hours',ends_at=t where id=old_b;
 update private.puzzles set starts_at=t,ends_at=t+interval '168 hours' where id=official;
 if exists(select 1 from private.puzzles a join private.puzzles b on a.id<b.id and a.starts_at<b.ends_at and b.starts_at<a.ends_at) then raise exception 'Overlapping windows';end if;
 select jsonb_build_object('pieces',(select jsonb_agg(to_jsonb(p) order by id) from private.puzzle_pieces p),'allowances',(select jsonb_agg(to_jsonb(a) order by atom_id) from private.puzzle_allowances a),'media',(select jsonb_agg(jsonb_build_array(asset_id,encode(sha256(content),'hex')) order by asset_id) from private.puzzle_media),'games',(select jsonb_agg(to_jsonb(q)-'starts_at'-'ends_at' order by id) from private.puzzles q)) into after_state;
 if before_state is distinct from after_state then raise exception 'Protected state changed';end if;
 update private.puzzle_access_settings set public_enabled=true,controlled_enabled=false where singleton;
end $$;
commit;
