-- Task #13.1: additive owner-session puzzle infrastructure; access defaults OFF.
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
-- No role, credential, signing authority or schedule is created.
-- Retain gameplay verbatim while removing superseded ticket/cropping operations.
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) set schema private;
alter function private.puzzle_request(text,uuid,uuid,bigint,uuid,integer) rename to puzzle_game_request;
revoke all on function private.puzzle_game_request(text,uuid,uuid,bigint,uuid,integer) from public,anon,authenticated,service_role,atomic_bond_growth;
create function public.puzzle_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_operation not in ('read','reveal','cancel','place','move') or p_operation is null then raise exception 'Invalid operation' using errcode='42501';end if;
 return private.puzzle_game_request(p_operation,p_puzzle,p_request,p_revision,p_piece,p_to);
end $$;
revoke all on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) to authenticated;
alter function public.puzzle_request(text,uuid,uuid,bigint,uuid,integer) owner to postgres;
create table private.puzzle_batches (
 id uuid primary key default gen_random_uuid(), created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default clock_timestamp(), ready boolean not null default false, retiring boolean not null default false
);
create table private.puzzle_assets (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references private.puzzle_batches,
 kind text not null check(kind in ('source','full','tile')), solution smallint,
 check((kind='tile' and solution is not null and solution between 0 and 24) or (kind<>'tile' and solution is null)),
 unique nulls not distinct(batch_id,kind,solution)
);
alter table private.puzzle_batches enable row level security;
alter table private.puzzle_assets enable row level security;
revoke all on private.puzzle_batches,private.puzzle_assets from public,anon,authenticated,service_role,atomic_bond_growth;

create function public.puzzle_prepare(p_batch uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();
 if p_batch is null then
  if (select count(*) from private.puzzle_batches where created_by=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=3 then raise exception 'Preparation limit';end if;
  insert into private.puzzle_batches(created_by) values(auth.uid()) returning id into b;
  insert into private.puzzle_assets(batch_id,kind,solution) select b,'tile',n from generate_series(0,24) n;
  insert into private.puzzle_assets(batch_id,kind) values(b,'source'),(b,'full');
 else
  b:=p_batch;
  if not exists(select 1 from private.puzzle_batches where id=b and created_by=auth.uid() and not ready and created_at>clock_timestamp()-interval '1 hour') then raise exception 'Batch unavailable';end if;
  if (select count(*) from private.puzzle_assets a join storage.objects o on o.name=a.id::text||'.png' and o.bucket_id=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end where a.batch_id=b and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint between 1 and 2000000)<>27 then raise exception 'Incomplete upload';end if;
  update private.puzzle_batches set ready=true where id=b;
 end if;
 return jsonb_build_object('batch',b,'assets',(select jsonb_agg(jsonb_build_object('name',id::text||'.png','kind',kind,'solution',solution)) from private.puzzle_assets where batch_id=b));
end $$;

create function private.puzzle_upload_allowed(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return exists(select 1 from private.puzzle_assets a join private.puzzle_batches q on q.id=a.batch_id where a.id::text||'.png'=n and b=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end and q.created_by=auth.uid() and not q.ready and q.created_at>clock_timestamp()-interval '1 hour');
exception when insufficient_privilege then return false;end $$;

create function private.puzzle_asset_allowed(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;t timestamptz;begin
 owner_id:=private.puzzle_owner();t:=private.puzzle_now();
 return b='puzzle-tiles' and exists(
 select 1 from private.puzzle_assets a join private.puzzle_batches batch on batch.id=a.batch_id and batch.ready and not batch.retiring
 join private.puzzles q on q.source_key=batch.id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where a.id::text||'.png'=n and q.starts_at<=t and q.ends_at+interval '30 days'>t and
 ((a.kind='full' and (q.completed_at is not null or q.ends_at<=t)) or
 (a.kind='tile' and (p.position is not null or exists(select 1 from private.puzzle_reservations r where r.piece_id=p.id and r.atom_id=owner_id and r.expires_at>t)))));
exception when insufficient_privilege then return false;end $$;

create function public.puzzle_asset(p_puzzle uuid,p_piece uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare asset text;begin
 perform private.puzzle_lock();perform private.puzzle_owner();
 -- Reuse authoritative request throttling without issuing a bearer capability.
 if public.puzzle_request('read',p_puzzle)->>'error'='RATE_LIMITED' then return jsonb_build_object('error','RATE_LIMITED');end if;
 select a.id::text||'.png' into asset from private.puzzle_assets a join private.puzzles q on q.source_key=a.batch_id
 left join private.puzzle_pieces p on p.puzzle_id=q.id and p.solution=a.solution
 where q.id=p_puzzle and ((p_piece is null and a.kind='full') or (p_piece=p.id and a.kind='tile'));
 if asset is null or not private.puzzle_asset_allowed('puzzle-tiles',asset) then return jsonb_build_object('error','TILE_DENIED');end if;
 return jsonb_build_object('name',asset);
end $$;

create or replace function public.puzzle_schedule(p_source uuid,p_start timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;t timestamptz;begin
 perform private.puzzle_lock();perform private.require_signal_admin();t:=private.puzzle_now();
 if p_start is null or not isfinite(p_start) or p_start<t or not exists(select 1 from private.puzzle_batches where id=p_source and ready and not retiring) then raise exception 'Ready batch required';end if;
 if exists(select 1 from private.puzzles where starts_at<p_start+interval '168 hours' and ends_at>p_start) then raise exception 'Overlapping schedule';end if;
 insert into private.puzzles(source_key,starts_at,ends_at) values(p_source,p_start,p_start+interval '168 hours') returning id into result;
 insert into private.puzzle_pieces(puzzle_id,solution) select result,n from generate_series(0,24)n;
 return result;
end $$;

-- Private, immutable assets. Bucket creation remains inside this unapplied candidate.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('puzzle-originals','puzzle-originals',false,2000000,array['image/png']),('puzzle-tiles','puzzle-tiles',false,2000000,array['image/png']);
grant usage on schema storage,private to authenticated;
grant select,insert on storage.objects to authenticated;
create policy puzzle_owner_download on storage.objects for select to authenticated
 using(storage.allow_only_operation('object.get_authenticated') and private.puzzle_asset_allowed(bucket_id,name));
create policy puzzle_admin_upload on storage.objects for insert to authenticated
 with check(storage.allow_only_operation('object.upload') and private.puzzle_upload_allowed(bucket_id,name));
-- No list/info/sign/transform/update/delete policy. No source SELECT, even for admin.
revoke all on function public.puzzle_prepare(uuid),public.puzzle_asset(uuid,uuid),private.puzzle_upload_allowed(text,text),private.puzzle_asset_allowed(text,text) from public,anon,service_role,atomic_bond_growth;
grant execute on function public.puzzle_prepare(uuid),public.puzzle_asset(uuid,uuid),private.puzzle_upload_allowed(text,text),private.puzzle_asset_allowed(text,text) to authenticated;
alter function public.puzzle_prepare(uuid) owner to postgres;
alter function public.puzzle_asset(uuid,uuid) owner to postgres;
alter function private.puzzle_upload_allowed(text,text) owner to postgres;
alter function private.puzzle_asset_allowed(text,text) owner to postgres;

-- Bounded operator cleanup through Storage API, using the existing admin session.
create function private.puzzle_asset_retired(b text,n text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return exists(select 1 from private.puzzle_assets a join private.puzzle_batches x on x.id=a.batch_id left join private.puzzles q on q.source_key=x.id
 where a.id::text||'.png'=n and b=case when a.kind='source' then 'puzzle-originals' else 'puzzle-tiles' end
 and ((q.id is not null and q.ends_at+interval '30 days'<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())));
exception when insufficient_privilege then return false;end $$;
create function public.puzzle_cleanup_batch(p_ack uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch uuid;begin
 perform private.puzzle_lock();perform private.require_signal_admin();perform private.puzzle_cleanup(1);
 select x.id into batch from private.puzzle_batches x left join private.puzzles q on q.source_key=x.id
 where (p_ack is null or x.id=p_ack) and ((q.id is not null and q.ends_at+interval '30 days'<=private.puzzle_now()) or (q.id is null and x.created_at+interval '24 hours'<=private.puzzle_now())) order by x.created_at limit 1 for update of x;
 if batch is null then return jsonb_build_object('assets','[]'::jsonb);end if;
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
grant delete on storage.objects to authenticated;
create policy puzzle_admin_cleanup_read on storage.objects for select to authenticated using((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name));
create policy puzzle_admin_cleanup on storage.objects for delete to authenticated using((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name));
revoke all on function private.puzzle_asset_retired(text,text),public.puzzle_cleanup_batch(uuid) from public,anon,service_role,atomic_bond_growth;
grant execute on function private.puzzle_asset_retired(text,text),public.puzzle_cleanup_batch(uuid) to authenticated;
alter function private.puzzle_asset_retired(text,text) owner to postgres;
alter function public.puzzle_cleanup_batch(uuid) owner to postgres;
-- Keep unrelated future permissive policies from widening these two buckets.
create policy puzzle_read_boundary on storage.objects as restrictive for select to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles') or
 (storage.allow_only_operation('object.get_authenticated') and private.puzzle_asset_allowed(bucket_id,name)) or
 ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
create policy puzzle_insert_boundary on storage.objects as restrictive for insert to authenticated
 with check(bucket_id not in ('puzzle-originals','puzzle-tiles') or (storage.allow_only_operation('object.upload') and private.puzzle_upload_allowed(bucket_id,name)));
create policy puzzle_update_boundary on storage.objects as restrictive for update to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles')) with check(bucket_id not in ('puzzle-originals','puzzle-tiles'));
create policy puzzle_delete_boundary on storage.objects as restrictive for delete to authenticated
 using(bucket_id not in ('puzzle-originals','puzzle-tiles') or ((storage.allow_only_operation('object.delete_many') or storage.allow_only_operation('object.delete')) and private.puzzle_asset_retired(bucket_id,name)));
-- Controlled rollout boundary. No membership is provisioned by this migration.
create table private.puzzle_access_settings (
 singleton boolean primary key default true check(singleton),
 public_enabled boolean not null default false,
 controlled_enabled boolean not null default false
);
insert into private.puzzle_access_settings default values;
create table private.puzzle_test_members (
 atom_id uuid primary key references public.atoms(id) on delete cascade,
 expires_at timestamptz not null check(isfinite(expires_at))
);
alter table private.puzzle_access_settings enable row level security;
alter table private.puzzle_test_members enable row level security;
revoke all on private.puzzle_access_settings,private.puzzle_test_members
 from public,anon,authenticated,service_role,atomic_bond_growth;
-- Every gameplay operation and authenticated Storage read reaches this helper.
-- Membership grants neither ownership nor administrator authority.
create or replace function private.puzzle_owner() returns uuid
 language plpgsql volatile security definer set search_path='' as $$
declare a uuid;
begin
 a:=private.account_owner();
 if not exists(select 1 from public.atoms where id=a and status='ACTIVE') then
  raise exception 'Active owner required' using errcode='42501';
 end if;
 if not exists(select 1 from private.puzzle_access_settings s where
  s.public_enabled or (s.controlled_enabled and exists(
   select 1 from private.puzzle_test_members m
   where m.atom_id=a and m.expires_at>private.puzzle_now()))) then
  raise exception 'Puzzle unavailable' using errcode='42501';
 end if;
 return a;
end $$;
alter function private.puzzle_owner() owner to postgres;
revoke all on function private.puzzle_owner() from public,anon,authenticated,service_role,atomic_bond_growth;
commit;
