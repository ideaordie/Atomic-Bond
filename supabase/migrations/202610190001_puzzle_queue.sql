-- Task #15.0 approved queue schema. Operator adoption remains separate.
-- Existing records/windows remain unchanged; operator adoption is separate.
begin;
alter table private.puzzles add column queue_state text check(queue_state in ('QUEUED','ACTIVE','COMPLETED','CELEBRATING','ARCHIVED'));
alter table private.puzzles add column queue_order bigint;
alter table private.puzzles add column celebration_ends_at timestamptz;
alter table private.puzzles add column archived_at timestamptz;
alter table private.puzzles add column retained_until timestamptz;
alter table private.puzzles alter column starts_at drop not null;
alter table private.puzzles alter column ends_at drop not null;
-- Original weekly check remains valid for legacy rows; queue rows have no weekly end.
alter table private.puzzles add constraint puzzle_queue_shape check (
 (queue_state is null and starts_at is not null and ends_at is not null) or
 (queue_state='QUEUED' and queue_order is not null and starts_at is null and ends_at is null) or
 (queue_state='ACTIVE' and starts_at is not null and completed_at is null) or
 (queue_state in ('COMPLETED','CELEBRATING') and completed_at is not null and celebration_ends_at=completed_at+interval '1 hour') or
 (queue_state='ARCHIVED' and archived_at is not null and retained_until is not null));
create unique index puzzle_one_running_queue on private.puzzles ((true)) where queue_state in ('ACTIVE','COMPLETED','CELEBRATING');
create unique index puzzle_queue_position on private.puzzles(queue_order) where queue_state='QUEUED';
create table private.puzzle_queue_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,paused boolean not null default true,revision bigint not null default 0);
insert into private.puzzle_queue_settings(singleton) values(true);
create table private.puzzle_queue_events(id bigint generated always as identity primary key,puzzle_id uuid references private.puzzles,action text not null,reason text,at timestamptz not null default clock_timestamp(),actor uuid references auth.users on delete set null);
alter table private.puzzle_queue_settings enable row level security;
alter table private.puzzle_queue_events enable row level security;
revoke all on private.puzzle_queue_settings,private.puzzle_queue_events from public,anon,authenticated,service_role,atomic_bond_growth;

create function private.puzzle_retention_deadline(q private.puzzles) returns timestamptz language sql immutable set search_path='' as $$
 select case when q.queue_state is null then q.ends_at+interval '30 days' when q.queue_state='ARCHIVED' then q.retained_until else null end
$$;
create function private.puzzle_retained(q private.puzzles,t timestamptz) returns boolean language sql immutable set search_path='' as $$
 select q.starts_at<=t and (case when q.queue_state is null then q.ends_at+interval '30 days'>t when q.queue_state='QUEUED' then false when q.queue_state='ARCHIVED' then q.retained_until>t else true end)
$$;
create function private.puzzle_playable(q private.puzzles,t timestamptz) returns boolean language sql immutable set search_path='' as $$
 select q.completed_at is null and q.starts_at<=t and (case when q.queue_state is null then q.ends_at>t else q.queue_state='ACTIVE' end)
$$;
create function private.puzzle_queue_ready(b uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.puzzle_batches where id=b and ready and not retiring)
 and (select count(*) from private.puzzle_assets a join private.puzzle_media m on m.asset_id=a.id where a.batch_id=b)=27
$$;
create function private.puzzle_queue_advance() returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz; q private.puzzles; s private.puzzle_queue_settings;
begin
 perform private.puzzle_lock();t:=private.puzzle_now();select * into s from private.puzzle_queue_settings where singleton for update;
 if not s.enabled then return;end if;
 update private.puzzles set queue_state='ARCHIVED',archived_at=celebration_ends_at,retained_until=greatest(retained_until,celebration_ends_at+interval '30 days') where queue_state in ('COMPLETED','CELEBRATING') and celebration_ends_at<=t returning * into q;
 if found then insert into private.puzzle_queue_events(puzzle_id,action,at) values(q.id,'ARCHIVED',t);update private.puzzle_queue_settings set revision=revision+1 where singleton;end if;
 if s.paused or exists(select 1 from private.puzzles where queue_state in ('ACTIVE','COMPLETED','CELEBRATING')) then return;end if;
 select * into q from private.puzzles where queue_state='QUEUED' order by queue_order,id limit 1 for update;
 -- Do not silently skip an invalid head or reorder the operator's queue.
 if q.id is null or not private.puzzle_queue_ready(q.source_key) then return;end if;
 update private.puzzles set queue_state='ACTIVE',starts_at=t,queue_order=null where id=q.id;
 update private.puzzle_queue_settings set revision=revision+1 where singleton;
 insert into private.puzzle_queue_events(puzzle_id,action,at) values(q.id,'ACTIVE',t);
end $$;
create function private.puzzle_queue_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.queue_state='ACTIVE' and old.completed_at is null and new.completed_at is not null then
  new.queue_state:='CELEBRATING';new.celebration_ends_at:=new.completed_at+interval '1 hour';
  insert into private.puzzle_queue_events(puzzle_id,action,at) values(new.id,'COMPLETED',new.completed_at),(new.id,'CELEBRATING',new.completed_at);
  update private.puzzle_queue_settings set revision=revision+1 where singleton;
 end if;return new;
end $$;
create trigger puzzle_queue_completion before update of completed_at on private.puzzles for each row execute function private.puzzle_queue_completion();

create or replace function private.puzzle_snapshot(p uuid,a uuid,t timestamptz) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('id',q.id,'revision',q.revision,'startsAt',q.starts_at,'endsAt',case when q.queue_state is null then q.ends_at end,'celebrationEndsAt',q.celebration_ends_at,
 'completedAt',q.completed_at,'placements',q.placements,'moves',q.moves,'participants',q.participants,
 'status',case when q.queue_state is not null then q.queue_state when q.completed_at is not null then 'COMPLETE' when q.ends_at<=t then 'CLOSED' else 'ACTIVE' end,
 'board',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'position',x.position,'locked',x.locked) order by x.position) from private.puzzle_pieces x where x.puzzle_id=q.id and x.position is not null),'[]'::jsonb),
 'reservation',(select jsonb_build_object('piece',r.piece_id,'expiresAt',r.expires_at) from private.puzzle_reservations r join private.puzzle_pieces x on x.id=r.piece_id where r.atom_id=a and x.puzzle_id=q.id and r.expires_at>t))
from private.puzzles q where q.id=p and private.puzzle_retained(q,t)
$$;

-- Preserve legacy public behavior until a separately approved operator transition.
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) rename to puzzle_legacy_request;
alter function public.puzzle_legacy_request(text,uuid,uuid,bigint,uuid,integer) set schema private;
revoke all on function private.puzzle_legacy_request(text,uuid,uuid,bigint,uuid,integer) from public,anon,authenticated,service_role,atomic_bond_growth;
create function public.puzzle_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; selected uuid; t timestamptz; a private.puzzle_allowances;
begin
 perform private.puzzle_lock();actor:=private.puzzle_owner();
 if not (select enabled from private.puzzle_queue_settings where singleton) then return private.puzzle_legacy_request(p_operation,p_puzzle,p_request,p_revision,p_piece,p_to);end if;
 if p_operation is null or p_operation not in ('read','reveal','cancel','place','move') then raise exception 'Invalid operation' using errcode='42501';end if;
 perform private.puzzle_queue_advance();t:=private.puzzle_now();
 if p_puzzle is null then select id into selected from private.puzzles where queue_state in ('ACTIVE','COMPLETED','CELEBRATING');
 else select id into selected from private.puzzles where id=p_puzzle and queue_state is not null and queue_state<>'QUEUED' and private.puzzle_retained(puzzles,t);end if;
 if selected is not null then return private.puzzle_game_request(p_operation,selected,p_request,p_revision,p_piece,p_to);end if;
 insert into private.puzzle_allowances(atom_id) values(actor) on conflict do nothing;
 select * into a from private.puzzle_allowances where atom_id=actor for update;
 if a.window_start+interval '1 minute'<=t then update private.puzzle_allowances set window_start=t,requests=1 where atom_id=actor;
 elsif a.requests>=120 then return jsonb_build_object('error','RATE_LIMITED');
 else update private.puzzle_allowances set requests=requests+1 where atom_id=actor;end if;
 if p_operation<>'read' or p_puzzle is not null then return jsonb_build_object('error','PUZZLE_UNAVAILABLE');end if;
 return jsonb_build_object('status','WAITING','serverTime',t);
end $$;
create or replace function public.puzzle_media_get(p_puzzle uuid,p_piece uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 perform private.puzzle_lock();perform private.puzzle_owner();
 if (select enabled from private.puzzle_queue_settings where singleton) then
  select exists(select 1 from private.puzzles q where q.id=p_puzzle and q.queue_state is not null and q.queue_state<>'QUEUED' and private.puzzle_retained(q,private.puzzle_now())) into allowed;
 else
  select exists(select 1 from private.puzzle_launch_settings s join private.puzzles first on first.id=s.first_puzzle join private.puzzles q on q.id=p_puzzle and q.starts_at>=first.starts_at and q.starts_at<=private.puzzle_now()) into allowed;
 end if;
 return private.puzzle_launch_media_get(case when allowed then p_puzzle else null end,p_piece);
end $$;

create function public.puzzle_queue_manage(p_action text,p_revision bigint,p_batch uuid default null,p_puzzle uuid default null,p_order uuid[] default null,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.puzzle_queue_settings;q private.puzzles;result uuid;t timestamptz; n bigint;
begin
 perform private.puzzle_lock();perform private.require_signal_admin();t:=private.puzzle_now();
 select * into s from private.puzzle_queue_settings where singleton for update;
 if not s.enabled then raise exception 'Operator transition required';end if;
 if p_revision is distinct from s.revision then raise exception 'Queue changed; refresh';end if;
 if p_action='add' then
  if not private.puzzle_queue_ready(p_batch) or exists(select 1 from private.puzzles where source_key=p_batch) or not exists(select 1 from private.puzzle_batches where id=p_batch and created_at+interval '24 hours'>t) then raise exception 'Unused current READY batch required';end if;
  select coalesce(max(queue_order),0)+1 into n from private.puzzles where queue_state='QUEUED';
  insert into private.puzzles(source_key,queue_state,queue_order) values(p_batch,'QUEUED',n) returning id into result;
  insert into private.puzzle_pieces(puzzle_id,solution) select result,x.piece_index from generate_series(0,24) x(piece_index);
 elsif p_action='reorder' then
  if p_order is null or cardinality(p_order)<>(select count(*) from private.puzzles where queue_state='QUEUED') or cardinality(p_order)<>(select count(distinct x) from unnest(p_order)x) or exists(select 1 from unnest(p_order)x where x is null or not exists(select 1 from private.puzzles where id=x and queue_state='QUEUED')) then raise exception 'Exact queued order required';end if;
  -- Two disjoint ranges keep the immediate unique index intact under one lock.
  update private.puzzles set queue_order=-queue_order where queue_state='QUEUED';
  update private.puzzles target set queue_order=x.n from unnest(p_order) with ordinality x(id,n) where target.id=x.id;
 elsif p_action in ('remove','retire') then
  select * into q from private.puzzles where id=p_puzzle for update;
  if q.id is null or (p_action='remove' and q.queue_state is distinct from 'QUEUED') or (p_action='retire' and q.queue_state is distinct from 'ACTIVE') or length(trim(coalesce(p_reason,''))) not between 8 and 240 then raise exception 'Eligible puzzle and auditable reason required';end if;
  if p_action='remove' and (q.placements<>0 or q.moves<>0 or exists(select 1 from private.puzzle_pieces where puzzle_id=q.id and position is not null)) then raise exception 'Used puzzle cannot be removed';end if;
  -- Preserve PLACE/MOVE deadlines; cancellation uses the existing reveal penalty.
  update private.puzzle_allowances a set reveal_after=greatest(a.reveal_after,t+interval '5 minutes') from private.puzzle_reservations r join private.puzzle_pieces p on p.id=r.piece_id where p.puzzle_id=q.id and a.atom_id=r.atom_id;
  delete from private.puzzle_reservations where piece_id in(select id from private.puzzle_pieces where puzzle_id=q.id);
  update private.puzzles set queue_state='ARCHIVED',queue_order=null,archived_at=t,retained_until=t+case when p_action='remove' then interval '24 hours' else interval '30 days' end where id=q.id;
  result:=q.id;
 elsif p_action in ('pause','resume') then update private.puzzle_queue_settings set paused=(p_action='pause') where singleton;
 else raise exception 'Invalid queue action';end if;
 insert into private.puzzle_queue_events(puzzle_id,action,reason,at,actor) values(result,upper(p_action),case when p_action in ('remove','retire') then trim(p_reason) end,t,auth.uid());
 update private.puzzle_queue_settings set revision=revision+1 where singleton;
 perform private.puzzle_queue_advance();
 return jsonb_build_object('ok',true,'puzzle',result);
end $$;

create or replace function private.puzzle_game_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; t timestamptz; q private.puzzles; account private.puzzle_allowances;
 r private.puzzle_reservations; piece private.puzzle_pieces; destination private.puzzle_pieces;
 receipt private.puzzle_receipts; fingerprint text; result jsonb; ticket uuid; added integer;
begin
 perform private.puzzle_lock(); a:=private.puzzle_owner(); t:=private.puzzle_now();
 insert into private.puzzle_allowances(atom_id) values(a) on conflict do nothing;
 select * into account from private.puzzle_allowances where atom_id=a for update;
 if account.window_start+interval '1 minute'<=t then
  update private.puzzle_allowances set window_start=t,requests=1 where atom_id=a;
 elsif account.requests>=120 then return jsonb_build_object('error','RATE_LIMITED');
 else update private.puzzle_allowances set requests=requests+1 where atom_id=a; end if;
 perform private.puzzle_expire(t);
 select * into account from private.puzzle_allowances where atom_id=a;
 if p_operation not in ('read','reveal','cancel','place','move','tile','image') or p_operation is null then return jsonb_build_object('error','INVALID_OPERATION'); end if;
 if p_puzzle is null then select * into q from private.puzzles where private.puzzle_playable(puzzles,t) order by starts_at desc limit 1;
 else select * into q from private.puzzles where id=p_puzzle and private.puzzle_retained(puzzles,t); end if;
 if q.id is null then return jsonb_build_object('status','WAITING'); end if;
 if p_operation='read' then return jsonb_build_object('puzzle',private.puzzle_snapshot(q.id,a,t),'placeAfter',case when isfinite(account.place_after) then account.place_after end,'moveAfter',case when isfinite(account.move_after) then account.move_after end,'revealAfter',case when isfinite(account.reveal_after) then account.reveal_after end,'serverTime',t); end if;
 if p_operation in ('tile','image') then
  if p_operation='image' and q.completed_at is null then return jsonb_build_object('error','HIDDEN_IMAGE'); end if;
  if p_operation='tile' and not exists(select 1 from private.puzzle_pieces x where x.id=p_piece and x.puzzle_id=q.id and
   (x.position is not null or exists(select 1 from private.puzzle_reservations z where z.piece_id=x.id and z.atom_id=a and z.expires_at>t))) then return jsonb_build_object('error','TILE_DENIED'); end if;
  delete from private.puzzle_tile_tickets where atom_id=a and expires_at<=t;
  if (select count(*) from private.puzzle_tile_tickets where atom_id=a)>=32 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  insert into private.puzzle_tile_tickets(atom_id,user_id,session_id,puzzle_id,piece_id,expires_at)
  values(a,auth.uid(),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid,q.id,case when p_operation='tile' then p_piece end,t+interval '10 seconds') returning id into ticket;
  return jsonb_build_object('ticket',ticket);
 end if;
 if p_request is null then return jsonb_build_object('error','REQUEST_ID_REQUIRED'); end if;
 fingerprint:=jsonb_build_array(p_operation,q.id,p_revision,p_piece,p_to)::text;
 select * into receipt from private.puzzle_receipts where atom_id=a and request_id=p_request and expires_at>t;
 if found then
  if receipt.fingerprint<>fingerprint then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
  return receipt.result;
 end if;
 if not private.puzzle_playable(q,t) then return jsonb_build_object('error','PUZZLE_ENDED'); end if;
 if p_revision is distinct from q.revision then return jsonb_build_object('error','STALE_BOARD'); end if;
 select * into r from private.puzzle_reservations where atom_id=a;
 if p_operation='reveal' then
  if r.piece_id is not null then return jsonb_build_object('error','ALREADY_RESERVED'); end if;
  if account.place_after>t or account.reveal_after>t then return jsonb_build_object('error','COOLDOWN'); end if;
  select * into piece from private.puzzle_pieces x where x.puzzle_id=q.id and position is null and not exists(select 1 from private.puzzle_reservations z where z.piece_id=x.id) order by random() limit 1;
  if piece.id is null then return jsonb_build_object('error','NO_AVAILABLE_PIECE'); end if;
  insert into private.puzzle_reservations values(piece.id,a,case when q.queue_state is null then least(t+interval '5 minutes',q.ends_at) else t+interval '5 minutes' end);
 elsif p_operation='cancel' then
  if r.piece_id is null or not exists(select 1 from private.puzzle_pieces where id=r.piece_id and puzzle_id=q.id) then return jsonb_build_object('error','NO_RESERVATION'); end if;
  delete from private.puzzle_reservations where atom_id=a;
  update private.puzzle_allowances set reveal_after=greatest(reveal_after,t+interval '5 minutes') where atom_id=a;
 elsif p_operation='place' then
  if account.place_after>t then return jsonb_build_object('error','COOLDOWN'); end if;
  if r.piece_id is null or r.piece_id is distinct from p_piece or r.expires_at<=t then return jsonb_build_object('error','NO_RESERVATION'); end if;
  select * into piece from private.puzzle_pieces where id=r.piece_id and puzzle_id=q.id;
  if piece.id is null or p_to is null or p_to not between 0 and 24 or exists(select 1 from private.puzzle_pieces where puzzle_id=q.id and position=p_to) then return jsonb_build_object('error','INVALID_DESTINATION'); end if;
  update private.puzzle_pieces set position=p_to,locked=(solution=p_to) where id=piece.id;
  delete from private.puzzle_reservations where atom_id=a;
  update private.puzzle_allowances set place_after=t+interval '60 minutes' where atom_id=a;
  update private.puzzles set placements=placements+1 where id=q.id;
 elsif p_operation='move' then
  if account.move_after>t then return jsonb_build_object('error','COOLDOWN'); end if;
  select * into piece from private.puzzle_pieces where id=p_piece and puzzle_id=q.id;
  if piece.id is null or piece.position is null or piece.locked or p_to is null or p_to not between 0 and 24 or p_to=piece.position then return jsonb_build_object('error','INVALID_MOVE'); end if;
  select * into destination from private.puzzle_pieces where puzzle_id=q.id and position=p_to;
  if destination.locked then return jsonb_build_object('error','LOCKED'); end if;
  update private.puzzle_pieces set position=case when id=piece.id then p_to else piece.position end,
   locked=(solution=case when id=piece.id then p_to else piece.position end)
   where id=piece.id or id=destination.id;
  update private.puzzle_allowances set move_after=t+interval '60 minutes' where atom_id=a;
  update private.puzzles set moves=moves+1 where id=q.id;
 end if;
 if p_operation in ('place','move') then
  insert into private.puzzle_contributors values(q.id,a) on conflict do nothing; get diagnostics added=row_count;
  update private.puzzles set participants=participants+added,completed_at=case when (select count(*) from private.puzzle_pieces where puzzle_id=q.id and locked)=25 then t else completed_at end where id=q.id;
 end if;
 update private.puzzles set revision=revision+1 where id=q.id;
 result:=jsonb_build_object('puzzle',private.puzzle_snapshot(q.id,a,t));
 insert into private.puzzle_receipts values(a,p_request,fingerprint,result,case when q.queue_state is null then q.ends_at+interval '30 days' else t+interval '30 days' end) on conflict(atom_id,request_id) do update set fingerprint=excluded.fingerprint,result=excluded.result,expires_at=excluded.expires_at;
 return result;
end $$;
create or replace function private.puzzle_launch_media_get(p_puzzle uuid,p_piece uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; t timestamptz; account private.puzzle_allowances; payload bytea;
begin
 perform private.puzzle_lock(); actor:=private.puzzle_owner(); t:=private.puzzle_now();
 insert into private.puzzle_allowances(atom_id) values(actor) on conflict do nothing;
 select * into account from private.puzzle_allowances where atom_id=actor for update;
 if account.window_start+interval '1 minute'<=t then
  update private.puzzle_allowances set window_start=t,requests=1 where atom_id=actor;
 elsif account.requests>=120 then return jsonb_build_object('error','RATE_LIMITED');
 else update private.puzzle_allowances set requests=requests+1 where atom_id=actor;end if;
 select m.content into payload from private.puzzle_media m
 join private.puzzle_assets a on a.id=m.asset_id
 join private.puzzle_batches b on b.id=a.batch_id and b.ready and not b.retiring
 join private.puzzles q on q.source_key=b.id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where q.id=p_puzzle and private.puzzle_retained(q,t) and
 ((p_piece is null and a.kind='full' and (q.completed_at is not null or (q.queue_state is null and q.ends_at<=t))) or
 (p_piece=p.id and a.kind='tile' and (p.position is not null or
  (private.puzzle_playable(q,t) and exists(select 1 from private.puzzle_reservations r
   where r.piece_id=p.id and r.atom_id=actor and r.expires_at>t)))));
 if payload is null then return jsonb_build_object('error','TILE_DENIED');end if;
 return jsonb_build_object('content',encode(payload,'base64'),'bytes',octet_length(payload));
end $$;
create or replace function private.puzzle_cleanup_step(p_limit integer default 25) returns jsonb
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
 where ((q.id is null and x.created_at+interval '24 hours'<=t) or private.puzzle_retention_deadline(q)<=t)
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

-- Reuse the existing five-minute job and health/error accounting without changing its schedule.
alter function private.puzzle_run_cleanup() rename to puzzle_run_cleanup_legacy;
create function private.puzzle_run_cleanup() returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare code text;
begin
 begin perform private.puzzle_queue_advance();
 exception when others then
  get stacked diagnostics code=returned_sqlstate;
  update private.puzzle_cleanup_health set last_attempt=clock_timestamp(),last_failure=clock_timestamp(),last_error_code=code,last_ok=false,failed_runs=failed_runs+1 where singleton;
  return jsonb_build_object('ok',false,'code',code);
 end;
 return private.puzzle_run_cleanup_legacy();
end $$;

-- Prevent the advanced legacy scheduler from adding hidden windows after adoption.
alter function public.puzzle_schedule(uuid,timestamptz) rename to puzzle_schedule_legacy;
alter function public.puzzle_schedule_legacy(uuid,timestamptz) set schema private;
revoke all on function private.puzzle_schedule_legacy(uuid,timestamptz) from public,anon,authenticated,service_role,atomic_bond_growth;
create function public.puzzle_schedule(p_source uuid,p_start timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 if (select enabled from private.puzzle_queue_settings where singleton) then raise exception 'Use the puzzle queue';end if;
 return private.puzzle_schedule_legacy(p_source,p_start);
end $$;

-- Operator-only, explicit adoption. Never executed by this migration or normal UI.
-- Re-audit immediately before use; the approved list must include every future window.
create function private.puzzle_queue_adopt(p_current uuid,p_future uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare q private.puzzles;t timestamptz; x uuid;n bigint:=0;
begin
 perform private.puzzle_lock();t:=private.puzzle_now();
 if (select enabled from private.puzzle_queue_settings where singleton) then raise exception 'Already adopted';end if;
 if p_future is null or cardinality(p_future)<>(select count(distinct id) from unnest(p_future)id) or p_current=any(p_future) then raise exception 'Invalid explicit plan';end if;
 select * into q from private.puzzles where id=p_current;
 if p_current is not null and (q.id is null or q.starts_at>t or q.ends_at<=t or not private.puzzle_queue_ready(q.source_key)) then raise exception 'Current puzzle changed';end if;
 if exists(select 1 from private.puzzles p join private.puzzle_launch_settings s on s.singleton join private.puzzles first on first.id=s.first_puzzle where p.starts_at>=first.starts_at and p.starts_at<=t and p.ends_at>t and p.id is distinct from p_current) then raise exception 'Unapproved current puzzle';end if;
 if exists(select 1 from private.puzzles where starts_at>t and not(id=any(p_future))) then raise exception 'Unapproved future window';end if;
 if p_current is not null then
  if q.completed_at is null then update private.puzzles set queue_state='ACTIVE' where id=q.id;
  elsif q.completed_at+interval '1 hour'>t then update private.puzzles set queue_state='CELEBRATING',celebration_ends_at=completed_at+interval '1 hour',retained_until=ends_at+interval '30 days' where id=q.id;
  else update private.puzzles set queue_state='ARCHIVED',celebration_ends_at=completed_at+interval '1 hour',archived_at=completed_at+interval '1 hour',retained_until=greatest(ends_at+interval '30 days',completed_at+interval '1 hour 30 days') where id=q.id;end if;
 end if;
 foreach x in array p_future loop
  select * into q from private.puzzles where id=x;
  if q.id is null or q.starts_at<=t or q.completed_at is not null or q.placements<>0 or q.moves<>0 or not private.puzzle_queue_ready(q.source_key) or exists(select 1 from private.puzzle_pieces where puzzle_id=x and position is not null) or exists(select 1 from private.puzzle_reservations r join private.puzzle_pieces p on p.id=r.piece_id where p.puzzle_id=x) then raise exception 'Future puzzle changed';end if;
  n:=n+1;
  insert into private.puzzle_queue_events(puzzle_id,action,reason,at) values(x,'ADOPT',jsonb_build_object('previousStart',q.starts_at,'previousEnd',q.ends_at)::text,t);
  update private.puzzles set queue_state='QUEUED',queue_order=n,starts_at=null,ends_at=null where id=x;
 end loop;
 update private.puzzle_queue_settings set enabled=true,paused=true,revision=revision+1 where singleton;
 insert into private.puzzle_queue_events(puzzle_id,action,at) values(p_current,'ADOPT_CURRENT',t);
 -- Remain paused: publication/activation is a separate reviewed action.
end $$;

create function public.puzzle_queue_studio(p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;t timestamptz;
begin
 perform private.puzzle_lock();perform private.require_signal_admin();t:=private.puzzle_now();
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid page';end if;
 select jsonb_build_object('now',t,'settings',(select jsonb_build_object('enabled',enabled,'paused',paused,'revision',revision) from private.puzzle_queue_settings),
 'gates',(select jsonb_build_object('public',public_enabled,'controlled',controlled_enabled) from private.puzzle_access_settings),
 'cleanup',(select jsonb_build_object('lastSuccess',last_success,'lastFailure',last_failure,'ok',last_ok,'counts',counts) from private.puzzle_cleanup_health),
 'current',(select jsonb_build_object('id',q.id,'batch',q.source_key,'state',q.queue_state,'completedAt',q.completed_at,'celebrationEndsAt',q.celebration_ends_at,'placed',(select count(*) from private.puzzle_pieces where puzzle_id=q.id and position is not null),'locked',(select count(*) from private.puzzle_pieces where puzzle_id=q.id and locked)) from private.puzzles q where queue_state in ('ACTIVE','COMPLETED','CELEBRATING')),
 'queue',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'batch',q.source_key,'ready',private.puzzle_queue_ready(q.source_key),'order',q.queue_order) order by q.queue_order) from private.puzzles q where queue_state='QUEUED'),'[]'::jsonb),
 'total',(select count(*) from private.puzzle_batches b where not retiring and not exists(select 1 from private.puzzles where source_key=b.id)),
 'batches',coalesce((select jsonb_agg(row_data order by created_at desc,id) from (select b.id,b.created_at,jsonb_build_object('id',b.id,'ready',private.puzzle_queue_ready(b.id),'expiresAt',b.created_at+interval '24 hours') row_data from private.puzzle_batches b where not retiring and not exists(select 1 from private.puzzles where source_key=b.id) order by created_at desc,id limit 20 offset p_offset)s),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(row_data order by at desc,id desc) from (select id,at,jsonb_build_object('puzzle',puzzle_id,'action',action,'reason',reason,'at',at) row_data from private.puzzle_queue_events order by at desc,id desc limit 20)s),'[]'::jsonb)) into result;
 return result;
end $$;

-- All helpers are private; every public entry independently verifies owner/admin authority.
do $$declare f record;begin
 for f in select p.oid::regprocedure name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'puzzle_queue_%' or p.proname in ('puzzle_retention_deadline','puzzle_retained','puzzle_playable','puzzle_run_cleanup','puzzle_run_cleanup_legacy')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,atomic_bond_growth',f.name);
 end loop;
end $$;
revoke all on function public.puzzle_queue_manage(text,bigint,uuid,uuid,uuid[],text),public.puzzle_queue_studio(integer),public.puzzle_request(text,uuid,uuid,bigint,uuid,integer),public.puzzle_schedule(uuid,timestamptz) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.puzzle_queue_manage(text,bigint,uuid,uuid,uuid[],text),public.puzzle_queue_studio(integer),public.puzzle_request(text,uuid,uuid,bigint,uuid,integer),public.puzzle_schedule(uuid,timestamptz) to authenticated;
create or replace function private.puzzle_asset_retired(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return exists(select 1 from private.puzzle_assets a join private.puzzle_batches x on x.id=a.batch_id left join private.puzzles q on q.source_key=x.id
 where a.id::text||'.png'=n and b=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end
 and ((q.id is not null and private.puzzle_retention_deadline(q)<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())));
exception when insufficient_privilege then return false;end $$;
create or replace function public.puzzle_cleanup_batch(p_ack uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();perform private.puzzle_cleanup(1);
 select x.id into batch from private.puzzle_batches x left join private.puzzles q on q.source_key=x.id
 where (p_ack is null or x.id=p_ack) and ((q.id is not null and private.puzzle_retention_deadline(q)<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())) order by x.created_at limit 1 for update of x;
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
