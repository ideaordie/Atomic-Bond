-- A prior successful cleanup may remove the batch before acknowledgment.
begin;
create or replace function public.puzzle_cleanup_batch(p_ack uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();perform private.puzzle_cleanup(1);
 select x.id into batch from private.puzzle_batches x left join private.puzzles q on q.source_key=x.id
 where (p_ack is null or x.id=p_ack) and ((q.id is not null and q.ends_at+interval '30 days'<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())) order by x.created_at limit 1 for update of x;
 if batch is null then
  if p_ack is not null and not exists(select 1 from private.puzzle_batches where id=p_ack) then return jsonb_build_object('removed',true);end if;
  return jsonb_build_object('assets','[]'::jsonb);
 end if;
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
commit;
