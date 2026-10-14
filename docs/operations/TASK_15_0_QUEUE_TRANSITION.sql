-- Task #15.0 approved one-time transition. Execute only after compatible deployment.
-- Preserves existing weekly records and every participant allowance.
begin;
set local lock_timeout='5s';
select private.puzzle_lock();
do $$
declare q private.puzzles; before_pieces text;before_allowances text;before_media text;before_history text;
begin
 select * into q from private.puzzles where id='f2870bd6-d907-4282-9008-20d02f95f3b0' for update;
 if q.source_key is distinct from '7c36c311-2a91-465e-8923-10e7efccc903'::uuid or q.revision<>72 or q.placements<>25 or q.moves<>19 or q.completed_at is distinct from '2026-10-14 11:41:13.596188+00'::timestamptz or q.queue_state is not null then raise exception 'Official puzzle changed';end if;
 if (select count(*) from private.puzzles)<>3 or exists(select 1 from private.puzzles where starts_at>clock_timestamp()) or exists(select 1 from private.puzzle_reservations) then raise exception 'Unexpected puzzle or reservation state';end if;
 if (select count(*) from private.puzzle_pieces where puzzle_id=q.id and locked)<>25 or not private.puzzle_queue_ready(q.source_key) then raise exception 'Official board/media changed';end if;
 if (select enabled from private.puzzle_queue_settings) then raise exception 'Already adopted';end if;
 select md5(string_agg(to_jsonb(x)::text,'' order by id)) into before_pieces from private.puzzle_pieces x;
 select md5(string_agg(to_jsonb(x)::text,'' order by atom_id)) into before_allowances from private.puzzle_allowances x;
 select md5(string_agg(md5(to_jsonb(x)::text),'' order by asset_id)) into before_media from private.puzzle_media x;
 select md5(string_agg(to_jsonb(x)::text,'' order by id)) into before_history from private.puzzles x where id<>q.id;
 perform private.puzzle_queue_adopt(q.id,array[]::uuid[]);
 if (select queue_state from private.puzzles where id=q.id)<>'ARCHIVED' or (select retained_until from private.puzzles where id=q.id) is distinct from '2026-11-19 17:16:50.300673+00'::timestamptz then raise exception 'Archive/retention invariant';end if;
 if before_pieces is distinct from (select md5(string_agg(to_jsonb(x)::text,'' order by id)) from private.puzzle_pieces x) or before_allowances is distinct from (select md5(string_agg(to_jsonb(x)::text,'' order by atom_id)) from private.puzzle_allowances x) or before_media is distinct from (select md5(string_agg(md5(to_jsonb(x)::text),'' order by asset_id)) from private.puzzle_media x) or before_history is distinct from (select md5(string_agg(to_jsonb(x)::text,'' order by id)) from private.puzzles x where id<>q.id) then raise exception 'Protected data changed';end if;
 update private.puzzle_queue_settings set paused=false,revision=revision+1 where singleton;
 insert into private.puzzle_queue_events(action,reason) values('RESUME','Task #15.0 explicitly approved empty-queue production publication');
 perform private.puzzle_queue_advance();
 if exists(select 1 from private.puzzles where queue_state in ('QUEUED','ACTIVE','CELEBRATING')) then raise exception 'Queue must start empty';end if;
end $$;
commit;
