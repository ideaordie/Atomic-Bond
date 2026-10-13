-- LOCAL CANDIDATE ONLY. Not in migration discovery; no hosted execution approved.
begin;
create table private.puzzles (
 id uuid primary key default gen_random_uuid(), source_key uuid not null unique,
 starts_at timestamptz not null, ends_at timestamptz not null,
 completed_at timestamptz, revision bigint not null default 0,
 placements integer not null default 0, moves integer not null default 0,
 participants integer not null default 0,
 check(ends_at=starts_at+interval '168 hours')
);
create table private.puzzle_pieces (
 id uuid primary key default gen_random_uuid(), puzzle_id uuid not null references private.puzzles on delete cascade,
 solution smallint not null check(solution between 0 and 24), position smallint check(position between 0 and 24),
 locked boolean not null default false,
 unique(puzzle_id,solution), unique(puzzle_id,position) deferrable initially deferred,
 check(not locked or position=solution)
);
create table private.puzzle_allowances (
 atom_id uuid primary key references public.atoms(id), place_after timestamptz not null default '-infinity',
 move_after timestamptz not null default '-infinity', reveal_after timestamptz not null default '-infinity',
 window_start timestamptz not null default '-infinity', requests integer not null default 0
);
create table private.puzzle_reservations (
 piece_id uuid primary key references private.puzzle_pieces on delete cascade,
 atom_id uuid not null unique references public.atoms(id), expires_at timestamptz not null
);
create table private.puzzle_receipts (
 atom_id uuid not null references public.atoms(id), request_id uuid not null,
 fingerprint text not null, result jsonb not null, expires_at timestamptz not null,
 primary key(atom_id,request_id)
);
create table private.puzzle_contributors (
 puzzle_id uuid not null references private.puzzles on delete cascade, atom_id uuid not null references public.atoms(id),
 primary key(puzzle_id,atom_id)
);
create table private.puzzle_tile_tickets (
 id uuid primary key default gen_random_uuid(), atom_id uuid not null references public.atoms(id),
 user_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null references auth.sessions(id) on delete cascade,
 puzzle_id uuid not null references private.puzzles on delete cascade,
 piece_id uuid references private.puzzle_pieces on delete cascade, expires_at timestamptz not null
);
create index puzzle_ticket_expiry on private.puzzle_tile_tickets(expires_at);
create index puzzle_receipt_expiry on private.puzzle_receipts(expires_at);
create table private.puzzle_cleanup_queue (
 source_key uuid primary key, queued_at timestamptz not null, attempts integer not null default 0
);
create function private.puzzle_now() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
create function private.puzzle_lock() returns void language plpgsql set search_path='' as $$
begin perform private.lifecycle_lock(); perform pg_advisory_xact_lock(130001); end $$;
create function private.puzzle_owner() returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid;
begin a:=private.account_owner();
 if not exists(select 1 from public.atoms where id=a and status='ACTIVE') then raise exception 'Active owner required' using errcode='42501'; end if;
 return a;
end $$;
create function private.puzzle_expire(t timestamptz) returns void language plpgsql set search_path='' as $$
begin
 update private.puzzle_allowances a set reveal_after=greatest(a.reveal_after,r.expires_at+interval '5 minutes')
 from private.puzzle_reservations r where r.atom_id=a.atom_id and r.expires_at<=t;
 delete from private.puzzle_reservations where expires_at<=t;
end $$;
create function private.puzzle_snapshot(p uuid,a uuid,t timestamptz) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('id',q.id,'revision',q.revision,'startsAt',q.starts_at,'endsAt',q.ends_at,
 'completedAt',q.completed_at,'placements',q.placements,'moves',q.moves,'participants',q.participants,
 'status',case when q.completed_at is not null then 'COMPLETE' when q.ends_at<=t then 'CLOSED' else 'ACTIVE' end,
 'board',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'position',x.position,'locked',x.locked) order by x.position)
 from private.puzzle_pieces x where x.puzzle_id=q.id and x.position is not null),'[]'::jsonb),
 'reservation',(select jsonb_build_object('piece',r.piece_id,'expiresAt',r.expires_at) from private.puzzle_reservations r join private.puzzle_pieces x on x.id=r.piece_id where r.atom_id=a and x.puzzle_id=q.id and r.expires_at>t))
from private.puzzles q where q.id=p and q.starts_at<=t and q.ends_at+interval '30 days'>t
$$;
create function public.puzzle_schedule(p_source uuid,p_start timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; t timestamptz;
begin
 perform private.puzzle_lock(); perform private.require_signal_admin(); t:=private.puzzle_now();
 if p_source is null or p_start is null or not isfinite(p_start) or p_start<t then raise exception 'Invalid schedule'; end if;
 if exists(select 1 from private.puzzles where starts_at<p_start+interval '168 hours' and ends_at>p_start) then raise exception 'Overlapping schedule'; end if;
 insert into private.puzzles(source_key,starts_at,ends_at) values(p_source,p_start,p_start+interval '168 hours') returning id into result;
 insert into private.puzzle_pieces(puzzle_id,solution) select result,n from generate_series(0,24) n;
 return result;
end $$;
create function public.puzzle_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null)
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
 if p_puzzle is null then select * into q from private.puzzles where starts_at<=t and ends_at>t order by starts_at desc limit 1;
 else select * into q from private.puzzles where id=p_puzzle and starts_at<=t and ends_at+interval '30 days'>t; end if;
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
 if q.ends_at<=t or q.completed_at is not null then return jsonb_build_object('error','PUZZLE_ENDED'); end if;
 if p_revision is distinct from q.revision then return jsonb_build_object('error','STALE_BOARD'); end if;
 select * into r from private.puzzle_reservations where atom_id=a;
 if p_operation='reveal' then
  if r.piece_id is not null then return jsonb_build_object('error','ALREADY_RESERVED'); end if;
  if account.place_after>t or account.reveal_after>t then return jsonb_build_object('error','COOLDOWN'); end if;
  select * into piece from private.puzzle_pieces x where x.puzzle_id=q.id and position is null and not exists(select 1 from private.puzzle_reservations z where z.piece_id=x.id) order by random() limit 1;
  if piece.id is null then return jsonb_build_object('error','NO_AVAILABLE_PIECE'); end if;
  insert into private.puzzle_reservations values(piece.id,a,least(t+interval '5 minutes',q.ends_at));
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
 insert into private.puzzle_receipts values(a,p_request,fingerprint,result,q.ends_at+interval '30 days') on conflict(atom_id,request_id) do update set fingerprint=excluded.fingerprint,result=excluded.result,expires_at=excluded.expires_at;
 return result;
end $$;

create function private.puzzle_lifecycle_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>old.status and new.status in ('DEACTIVATED','DELETED') then
  perform pg_advisory_xact_lock(130001);
  update private.puzzle_allowances set reveal_after=greatest(reveal_after,private.puzzle_now()+interval '5 minutes') where atom_id=new.id and exists(select 1 from private.puzzle_reservations where atom_id=new.id);
  delete from private.puzzle_reservations where atom_id=new.id;
  delete from private.puzzle_tile_tickets where atom_id=new.id;
  if new.status='DELETED' then
   delete from private.puzzle_receipts where atom_id=new.id;
   delete from private.puzzle_contributors where atom_id=new.id;
   delete from private.puzzle_allowances where atom_id=new.id;
  end if;
 end if; return new;
end $$;
create trigger puzzle_lifecycle_cleanup after update of status on public.atoms for each row execute function private.puzzle_lifecycle_cleanup();

-- Metadata cleanup only; actual Storage deletion must use Storage API, never SQL.
create function private.puzzle_cleanup(p_limit integer default 25) returns integer language plpgsql security definer set search_path='' as $$
declare q private.puzzles; n integer:=0; t timestamptz;
begin
 if p_limit not between 1 and 100 or p_limit is null then raise exception 'Invalid batch'; end if;
 perform private.puzzle_lock(); t:=private.puzzle_now(); perform private.puzzle_expire(t);
 delete from private.puzzle_tile_tickets where id in(select id from private.puzzle_tile_tickets where expires_at<=t limit p_limit*32);
 delete from private.puzzle_receipts where (atom_id,request_id) in(select atom_id,request_id from private.puzzle_receipts where expires_at<=t limit p_limit*120);
 delete from private.puzzle_allowances where atom_id in(select a.atom_id from private.puzzle_allowances a where greatest(place_after,move_after,reveal_after,window_start)<t-interval '30 days' and not exists(select 1 from private.puzzle_reservations r where r.atom_id=a.atom_id) limit p_limit*120);
 for q in select * from private.puzzles where ends_at+interval '30 days'<=t and exists(select 1 from private.puzzle_pieces where puzzle_id=puzzles.id) order by ends_at limit p_limit for update loop
  insert into private.puzzle_cleanup_queue values(q.source_key,t,0) on conflict do nothing;
  delete from private.puzzle_pieces where puzzle_id=q.id;
  delete from private.puzzle_contributors where puzzle_id=q.id;
  n:=n+1;
 end loop;
 return n;
end $$;

do $$ declare item text; begin
 foreach item in array array['puzzles','puzzle_pieces','puzzle_allowances','puzzle_reservations','puzzle_receipts','puzzle_contributors','puzzle_tile_tickets','puzzle_cleanup_queue'] loop
 execute format('alter table private.%I enable row level security',item);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role,atomic_bond_growth',item);
 end loop;
end $$;
revoke all on function private.puzzle_now(),private.puzzle_lock(),private.puzzle_owner(),private.puzzle_expire(timestamptz),private.puzzle_snapshot(uuid,uuid,timestamptz),private.puzzle_lifecycle_cleanup(),private.puzzle_cleanup(integer) from public,anon,authenticated,service_role,atomic_bond_growth;
revoke all on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer),public.puzzle_schedule(uuid,timestamptz) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer),public.puzzle_schedule(uuid,timestamptz) to authenticated;
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) owner to postgres;
alter function public.puzzle_schedule(uuid,timestamptz) owner to postgres;
alter function private.puzzle_owner() owner to postgres;
alter function private.puzzle_lifecycle_cleanup() owner to postgres;
alter function private.puzzle_cleanup(integer) owner to postgres;
commit;
