-- Bounded PostgreSQL cleanup and private source storage. No existing data rewrite.
begin;
create or replace function public.puzzle_media_put(p_asset uuid,p_content text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload bytea; a private.puzzle_assets; b private.puzzle_batches; old bytea;
begin
 perform private.puzzle_lock(); perform private.require_signal_admin();
 if p_content is null or length(p_content)>2666668 then raise exception 'Invalid media';end if;
 payload:=decode(p_content,'base64');
 select * into a from private.puzzle_assets where id=p_asset;
 select * into b from private.puzzle_batches where id=a.batch_id;
 if a.id is null or a.kind not in ('tile','full','source') or b.retiring or
  (not b.ready and (b.created_by is distinct from auth.uid() or b.created_at<=clock_timestamp()-interval '1 hour')) or
  (b.ready and exists(select 1 from private.puzzle_access_settings where public_enabled or controlled_enabled)) then
  raise exception 'Media unavailable' using errcode='42501';end if;
 select content into old from private.puzzle_media where asset_id=p_asset;
 if old is not null and old<>payload then raise exception 'Immutable media';end if;
 insert into private.puzzle_media(asset_id,content) values(p_asset,payload) on conflict do nothing;
 return jsonb_build_object('bytes',octet_length(payload),'sha256',encode(sha256(payload),'hex'));
end $$;

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
   (not exists(select 1 from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id=b and a.kind='source') and not exists(select 1 from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id='puzzle-originals'
    where a.batch_id=b and a.kind='source' and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint between 1 and 2000000)) then raise exception 'Incomplete upload';end if;
  update private.puzzle_batches set ready=true where id=b;
 end if;
 return jsonb_build_object('batch',b,'assets',(select jsonb_agg(jsonb_build_object('name',id::text||'.png','kind',kind,'solution',solution)) from private.puzzle_assets where batch_id=b));
end $$;

create index puzzle_reservation_expiry on private.puzzle_reservations(expires_at);
create index puzzle_batch_age on private.puzzle_batches(created_at);
create index puzzle_retention_end on private.puzzles(ends_at);
create table private.puzzle_cleanup_health (
 singleton boolean primary key default true check(singleton),
 last_attempt timestamptz, last_success timestamptz, last_failure timestamptz,
 last_error_code text, last_ok boolean, counts jsonb not null default '{}'::jsonb,
 successful_runs bigint not null default 0, failed_runs bigint not null default 0
);
insert into private.puzzle_cleanup_health(singleton) values(true);
alter table private.puzzle_cleanup_health enable row level security;
revoke all on private.puzzle_cleanup_health from public,anon,authenticated,service_role,atomic_bond_growth;

create function private.puzzle_cleanup_step(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz; b record; n integer; reservations integer:=0; receipts integer:=0;
 tickets integer:=0; media integer:=0; assets integer:=0; batches integer:=0;
 pieces integer:=0; contributors integer:=0; waiting integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Invalid cleanup bound';end if;
 perform private.puzzle_lock();t:=private.puzzle_now();
 -- Apply the same expiry cooldown as gameplay, in a bounded set, atomically.
 with expired as (select piece_id,atom_id,expires_at from private.puzzle_reservations where expires_at<=t order by expires_at,piece_id limit p_limit*20),
 updated as (update private.puzzle_allowances a set reveal_after=greatest(a.reveal_after,r.expires_at+interval '5 minutes') from expired r where a.atom_id=r.atom_id)
 delete from private.puzzle_reservations where piece_id in(select piece_id from expired);
 get diagnostics reservations=row_count;
 delete from private.puzzle_receipts where (atom_id,request_id) in(select atom_id,request_id from private.puzzle_receipts where expires_at<=t order by expires_at limit p_limit*20);
 get diagnostics receipts=row_count;
 delete from private.puzzle_tile_tickets where id in(select id from private.puzzle_tile_tickets where expires_at<=t order by expires_at limit p_limit*20);
 get diagnostics tickets=row_count;
 -- Never purge allowances: rolling gameplay eligibility is independent of media retention.
 for b in select x.id,q.id puzzle_id from private.puzzle_batches x left join private.puzzles q on q.source_key=x.id
 where ((q.id is null and x.created_at+interval '24 hours'<=t) or q.ends_at+interval '30 days'<=t)
 and (not x.retiring or exists(select 1 from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id=x.id)
 or not exists(select 1 from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end where a.batch_id=x.id))
 order by x.created_at,x.id limit p_limit for update of x loop
  update private.puzzle_batches set retiring=true where id=b.id;
  -- Only closed puzzles beyond retention lose detailed progress. Aggregate puzzle row remains.
  delete from private.puzzle_pieces where puzzle_id=b.puzzle_id;get diagnostics n=row_count;pieces:=pieces+n;
  delete from private.puzzle_contributors where puzzle_id=b.puzzle_id;get diagnostics n=row_count;contributors:=contributors+n;
  delete from private.puzzle_media where asset_id in(select id from private.puzzle_assets where batch_id=b.id);get diagnostics n=row_count;media:=media+n;
  if exists(select 1 from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end where a.batch_id=b.id) then
   insert into private.puzzle_cleanup_queue values(b.id,t,0) on conflict do nothing;
   waiting:=waiting+1; -- Storage API owns physical deletion; preserve its manifest.
  else
   delete from private.puzzle_assets where batch_id=b.id;get diagnostics n=row_count;assets:=assets+n;
   delete from private.puzzle_batches where id=b.id;batches:=batches+1;
   delete from private.puzzle_cleanup_queue where source_key=b.id;
  end if;
 end loop;
 return jsonb_build_object('reservations',reservations,'receipts',receipts,'tickets',tickets,'media',media,'assets',assets,'batches',batches,'pieces',pieces,'contributors',contributors,'legacyStorageBatchesQueued',waiting);
end $$;
-- Existing administrator cleanup planning now uses the same bounded implementation.
create or replace function private.puzzle_cleanup(p_limit integer default 25) returns integer
language plpgsql security definer set search_path='' as $$
declare v_counts jsonb;begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch';end if;
 v_counts:=private.puzzle_cleanup_step(least(p_limit,25));return (v_counts->>'batches')::integer;
end $$;
create function private.puzzle_run_cleanup() returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare v_counts jsonb;code text;begin
 begin
  v_counts:=private.puzzle_cleanup_step(25);
 exception when others then
  get stacked diagnostics code=returned_sqlstate;
  update private.puzzle_cleanup_health set last_attempt=clock_timestamp(),last_failure=clock_timestamp(),last_error_code=code,last_ok=false,failed_runs=failed_runs+1 where singleton;
  return jsonb_build_object('ok',false,'code',code);
 end;
 update private.puzzle_cleanup_health set last_attempt=clock_timestamp(),last_success=clock_timestamp(),last_ok=true,counts=v_counts,successful_runs=successful_runs+1 where singleton;
 return jsonb_build_object('ok',true,'removed',v_counts);
end $$;
revoke all on function private.puzzle_cleanup_step(integer),private.puzzle_run_cleanup() from public,anon,authenticated,service_role,atomic_bond_growth;
alter function private.puzzle_cleanup_step(integer) owner to postgres;
alter function private.puzzle_run_cleanup() owner to postgres;
-- Reuse installed pg_cron only. No extension installation, HTTP job, or credential.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if exists(select 1 from cron.job where jobname='atomic-bond-puzzle-cleanup') then raise exception 'Puzzle cleanup job already exists; inspect before migration';end if;
  perform cron.schedule('atomic-bond-puzzle-cleanup','*/5 * * * *','select private.puzzle_run_cleanup();');
 end if;
end $$;
commit;
