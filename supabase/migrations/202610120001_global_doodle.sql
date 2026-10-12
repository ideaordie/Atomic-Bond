-- Task 12.1 staged migration. DO NOT APPLY HOSTED until rollout approval.
-- No seed users, hosted cron registration, credentials, or existing data rewrite.
begin;
create table private.doodle_settings (
 singleton boolean primary key default true check(singleton),
 threshold integer not null default 5 check(threshold between 5 and 1000000),
 submissions_paused boolean not null default true,
 public_access boolean not null default false
);
insert into private.doodle_settings values(true,5,true,false);
-- Operator-only, expiring rollout membership. Never grants administration or
-- bypasses the independent emergency pause. No enrollment RPC or client grants.
create table private.doodle_rollout_members (
 atom_id uuid primary key references public.atoms(id),
 expires_at timestamptz not null
);
alter table private.doodle_rollout_members enable row level security;
revoke all on private.doodle_rollout_members from public,anon,authenticated,service_role,atomic_bond_growth;
create table private.doodle_accounts (
 atom_id uuid primary key references public.atoms(id),
 last_submitted timestamptz, last_request uuid, last_result uuid, last_hash text, restricted boolean not null default false,
 report_window timestamptz, reports_in_window integer not null default 0
);
create table private.doodles (
 id uuid primary key default gen_random_uuid(),
 atom_id uuid not null references public.atoms(id),
 request_id uuid not null,
 bitmap bytea not null check(octet_length(bitmap)=512),
 replay bytea check(octet_length(replay)<=16896),
 state text not null check(state in ('PUBLISHED','EXPIRED','CANDIDATE','HALL','REJECTED','REMOVED')),
 submitted_at timestamptz not null, published_at timestamptz, expires_at timestamptz,
 threshold integer, final_score integer check(final_score>=0),
 purge_at timestamptz not null, promoted_at timestamptz,
 unique(atom_id,request_id)
);
create index doodles_feed on private.doodles(published_at desc,id desc) where state='PUBLISHED';
create index doodles_purge on private.doodles(purge_at) where state<>'HALL';
create index doodles_owner on private.doodles(atom_id);
create table private.doodle_appreciations (
 doodle_id uuid not null references private.doodles(id) on delete cascade,
 voter_atom_id uuid not null references public.atoms(id),
 created_at timestamptz not null,
 primary key(doodle_id,voter_atom_id)
);
create table private.doodle_hall (
 slot integer primary key check(slot between 1 and 10),
 doodle_id uuid unique not null references private.doodles(id) on delete cascade
);
create table private.doodle_reports (
 doodle_id uuid not null references private.doodles(id) on delete cascade,
 reporter_atom_id uuid not null references public.atoms(id),
 category text not null check(category in ('ABUSE','PERSONAL_INFORMATION','SEXUAL','OTHER')),
 created_at timestamptz not null,
 primary key(doodle_id,reporter_atom_id)
);

alter table private.doodle_settings enable row level security;
alter table private.doodle_accounts enable row level security;
alter table private.doodles enable row level security;
alter table private.doodle_appreciations enable row level security;
alter table private.doodle_hall enable row level security;
alter table private.doodle_reports enable row level security;
revoke all on private.doodle_settings,private.doodle_accounts,private.doodles,private.doodle_appreciations,private.doodle_hall,private.doodle_reports from public,anon,authenticated,service_role,atomic_bond_growth;

create function private.doodle_now() returns timestamptz language sql volatile set search_path='' as $$ select clock_timestamp() $$;
create function private.doodle_owner() returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid;
begin
 a:=private.account_owner();
 if not exists(select 1 from public.atoms where id=a and status='ACTIVE') then raise exception 'Active verified owner required' using errcode='42501'; end if;
 if not (select public_access from private.doodle_settings)
 and not exists(select 1 from private.doodle_rollout_members where atom_id=a and expires_at>private.doodle_now())
 then raise exception 'Doodle unavailable' using errcode='42501'; end if;
 return a;
end $$;
-- A short shared lock follows the existing lifecycle lock in every mutating RPC.
create function private.doodle_lock() returns void language plpgsql set search_path='' as $$
begin perform private.lifecycle_lock(); perform pg_advisory_xact_lock(120001); end $$;

create function private.doodle_pack(p jsonb) returns bytea language plpgsql immutable set search_path='' as $$
declare s jsonb; q jsonb; n integer; total integer:=0; point integer; header integer; result bytea:=''::bytea; bits bytea:=decode(repeat('00',512),'hex'); final bytea;
begin
 if p->'version' is distinct from '1'::jsonb or jsonb_typeof(p->'bitmap') is distinct from 'string' or length(p->>'bitmap')<>684 then raise exception 'Invalid drawing'; end if;
 final:=decode(p->>'bitmap','base64');
 if octet_length(final)<>512 or final=bits then raise exception 'Empty or invalid bitmap'; end if;
 if p->'strokes'='null'::jsonb then return null; end if;
 if jsonb_typeof(p->'strokes') is distinct from 'array' then raise exception 'Invalid replay'; end if;
 if jsonb_array_length(p->'strokes')>256 then raise exception 'Replay limit'; end if;
 for s in select value from jsonb_array_elements(p->'strokes') loop
  if jsonb_typeof(s->'draw') is distinct from 'boolean' or jsonb_typeof(s->'points') is distinct from 'array' then raise exception 'Invalid stroke'; end if;
  n:=jsonb_array_length(s->'points'); total:=total+n;
  if n<1 or total>8192 then raise exception 'Replay limit'; end if;
  header:=n+case when (s->>'draw')::boolean then 32768 else 0 end;
  result:=result||decode(lpad(to_hex(header),4,'0'),'hex');
  for q in select value from jsonb_array_elements(s->'points') loop
   if jsonb_typeof(q)<>'number' or q::text !~ '^[0-9]{1,4}$' then raise exception 'Invalid point'; end if;
   point:=(q::text)::integer;
   if point>4095 then raise exception 'Invalid point'; end if;
   bits:=set_byte(bits,point/8,case when (s->>'draw')::boolean then get_byte(bits,point/8)|(1<<(point%8)) else get_byte(bits,point/8)& ~(1<<(point%8)) end);
   result:=result||decode(lpad(to_hex(point),4,'0'),'hex');
  end loop;
 end loop;
 if bits<>final then raise exception 'Replay and final bitmap differ'; end if;
 return result;
end $$;

create function private.doodle_unpack(p bytea) returns jsonb language plpgsql immutable set search_path='' as $$
declare i integer:=0; h integer; n integer; points jsonb; result jsonb:='[]';
begin
 if p is null then return 'null'::jsonb; end if;
 while i<octet_length(p) loop
  h:=get_byte(p,i)*256+get_byte(p,i+1); i:=i+2; n:=h&32767; points:='[]';
  for j in 1..n loop points:=points||to_jsonb(get_byte(p,i)*256+get_byte(p,i+1)); i:=i+2; end loop;
  result:=result||jsonb_build_object('draw',h>=32768,'points',points);
 end loop;
 return result;
end $$;

create function private.doodle_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.bitmap<>old.bitmap or new.replay is distinct from old.replay or new.atom_id<>old.atom_id or new.request_id<>old.request_id then raise exception 'Immutable drawing'; end if;
 if old.final_score is not null and new.final_score is distinct from old.final_score then raise exception 'Final score is immutable'; end if;
 return new;
end $$;
create trigger doodle_immutable before update on private.doodles for each row execute function private.doodle_immutable();

create function private.doodle_finalize(p_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz:=private.doodle_now(); d private.doodles; score integer;
begin
 -- Caller holds the lifecycle/Doodle locks; no votes can cross finalization.
 for d in select * from private.doodles where state='PUBLISHED' and expires_at<=t and (p_id is null or id=p_id) order by expires_at,id limit 1000 for update loop
  select count(*)::integer into score from private.doodle_appreciations where doodle_id=d.id;
  update private.doodles set final_score=score,
   state=case when score>=threshold and exists(select 1 from public.atoms where id=d.atom_id and status='ACTIVE') then 'CANDIDATE' else 'EXPIRED' end,
   purge_at=case when score>=threshold then expires_at+interval '7 days' else expires_at end where id=d.id;
 end loop;
 update private.doodles set state='EXPIRED' where id in
  (select id from private.doodles where state in ('CANDIDATE') and purge_at<=t order by purge_at,id limit 1000);
end $$;

create function public.submit_doodle(p_request uuid,p_drawing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz; packed bytea; existing private.doodles; result uuid; account private.doodle_accounts; fingerprint text;
begin
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 if p_request is null or octet_length(p_drawing::text)>65536 then raise exception 'Invalid submission'; end if;
 packed:=private.doodle_pack(p_drawing);
 fingerprint:=encode(sha256(decode(p_drawing->>'bitmap','base64')||coalesce(packed,''::bytea)),'hex');
 t:=private.doodle_now();
 select * into account from private.doodle_accounts where atom_id=owner;
 if account.last_request=p_request then
  if account.last_hash<>fingerprint then raise exception 'Idempotency conflict'; end if;
  return account.last_result;
 end if;
 select * into existing from private.doodles where atom_id=owner and request_id=p_request;
 if found then
  if existing.bitmap<>decode(p_drawing->>'bitmap','base64') or existing.replay is distinct from packed then raise exception 'Idempotency conflict'; end if;
  return existing.id;
 end if;
 insert into private.doodle_accounts(atom_id) values(owner) on conflict do nothing;
 if exists(select 1 from private.doodle_accounts where atom_id=owner and (restricted or last_submitted>t-interval '60 minutes')) then raise exception 'Submission unavailable: restriction or cooldown'; end if;
 if (select submissions_paused from private.doodle_settings) then raise exception 'Submissions paused'; end if;
 if exists(select 1 from private.doodles where atom_id=owner and state='PUBLISHED' and expires_at>t) then raise exception 'One active drawing only'; end if;
 insert into private.doodles(atom_id,request_id,bitmap,replay,state,submitted_at,published_at,expires_at,purge_at,threshold)
 values(owner,p_request,decode(p_drawing->>'bitmap','base64'),packed,'PUBLISHED',t,t,t+interval '1 hour',t+interval '1 hour',(select threshold from private.doodle_settings)) returning id into result;
 update private.doodle_accounts set last_submitted=t,last_request=p_request,last_result=result,last_hash=fingerprint where atom_id=owner;
 return result;
end $$;

create function private.doodle_display(d private.doodles,p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',d.id,'atomNumber',a.public_id::text,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),
 'publishedAt',d.published_at,'expiresAt',d.expires_at,'score',coalesce(d.final_score,(select count(*) from private.doodle_appreciations where doodle_id=d.id)),
 'appreciated',exists(select 1 from private.doodle_appreciations where doodle_id=d.id and voter_atom_id=p_owner),'own',d.atom_id=p_owner)
 from public.atoms a where a.id=d.atom_id and a.status='ACTIVE'
$$;

create function public.read_doodles(p_before timestamptz default null,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); t timestamptz:=private.doodle_now();
begin
 return jsonb_build_object('serverTime',t,'submissionsPaused',(select submissions_paused from private.doodle_settings),'items',coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.published_at desc,d.id desc)
 from (select d.* from private.doodles d join public.atoms a on a.id=d.atom_id where d.state='PUBLISHED' and d.expires_at>t and a.status='ACTIVE'
 and (p_before is null or (d.published_at,d.id)<(p_before,coalesce(p_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) order by d.published_at desc,d.id desc limit 20) d),'[]'::jsonb),
 'hall',coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.final_score desc,d.promoted_at,d.id) from private.doodle_hall h join private.doodles d on d.id=h.doodle_id join public.atoms a on a.id=d.atom_id where d.state='HALL' and a.status='ACTIVE'),'[]'::jsonb),
 'mine',coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',case when state='PUBLISHED' and expires_at<=t then 'EXPIRED' else state end,'expiresAt',expires_at)) from (select * from private.doodles where atom_id=owner order by submitted_at desc limit 5) m),'[]'::jsonb));
end $$;

create function public.doodle_replay(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); d private.doodles;
begin
 select x.* into d from private.doodles x join public.atoms a on a.id=x.atom_id where x.id=p_id and a.status='ACTIVE'
 and ((x.state='PUBLISHED' and x.expires_at>private.doodle_now()) or (x.state='HALL' and exists(select 1 from private.doodle_hall where doodle_id=x.id)));
 if d.id is null then raise exception 'Drawing unavailable'; end if;
 return jsonb_build_object('version',1,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),'strokes',private.doodle_unpack(d.replay));
end $$;

create function public.appreciate_doodle(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid; d private.doodles;
begin
 perform private.doodle_lock(); owner:=private.doodle_owner();
 select x.* into d from private.doodles x join public.atoms a on a.id=x.atom_id where x.id=p_id and a.status='ACTIVE' and x.state='PUBLISHED' and x.expires_at>private.doodle_now();
 if d.id is null or d.atom_id=owner then raise exception 'Appreciation unavailable'; end if;
 insert into private.doodle_appreciations values(p_id,owner,private.doodle_now()) on conflict do nothing;
 return found;
end $$;

create function public.report_doodle(p_id uuid,p_category text) returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz;
begin
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 perform public.doodle_replay(p_id);
 if exists(select 1 from private.doodle_reports where doodle_id=p_id and reporter_atom_id=owner) then return false; end if;
 insert into private.doodle_accounts(atom_id) values(owner) on conflict do nothing;
 update private.doodle_accounts set report_window=t,reports_in_window=0 where atom_id=owner and (report_window is null or report_window<=t-interval '1 hour');
 if exists(select 1 from private.doodle_accounts where atom_id=owner and reports_in_window>=10) then raise exception 'Report limit'; end if;
 insert into private.doodle_reports values(p_id,owner,p_category,t);
 update private.doodle_accounts set reports_in_window=reports_in_window+1 where atom_id=owner;
 return true;
end $$;

create index doodle_review_queue on private.doodles(submitted_at,id)
 where state in ('PUBLISHED','CANDIDATE','HALL');
create function public.doodle_admin_queue(p_after timestamptz default null,p_id uuid default null,p_view text default 'ALL') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.doodle_lock(); perform private.require_signal_admin(); perform private.doodle_finalize();
 if p_view is null or p_view not in ('ALL','ACTIVE','REPORTED','CANDIDATE','HALL') then raise exception 'Invalid moderation view'; end if;
 return jsonb_build_object('threshold',(select threshold from private.doodle_settings),'submissionsPaused',(select submissions_paused from private.doodle_settings),'items',coalesce((select jsonb_agg(
 private.doodle_display(d,null)||jsonb_build_object('state',d.state,'fingerprint',encode(sha256(d.bitmap||coalesce(d.replay,''::bytea)),'hex'),'reportCount',(select count(*) from private.doodle_reports where doodle_id=d.id),
 'reportCategories',(select coalesce(jsonb_agg(distinct category),'[]'::jsonb) from private.doodle_reports where doodle_id=d.id),'reviewUntil',d.purge_at,'submittedAt',d.submitted_at)
 order by d.submitted_at,d.id) from (select x.* from private.doodles x join public.atoms a on a.id=x.atom_id where a.status='ACTIVE' and ((x.state='PUBLISHED' and x.expires_at>private.doodle_now()) or (x.state='CANDIDATE' and x.purge_at>private.doodle_now()) or x.state='HALL')
 and (p_view='ALL' or (p_view='ACTIVE' and x.state='PUBLISHED') or (p_view='REPORTED' and exists(select 1 from private.doodle_reports where doodle_id=x.id)) or x.state=p_view)
 and (p_after is null or (x.submitted_at,x.id)>(p_after,coalesce(p_id,'00000000-0000-0000-0000-000000000000'::uuid)))
 order by x.submitted_at,x.id limit 25) d),'[]'::jsonb));
end $$;

create function public.doodle_admin_replay(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.doodles;
begin
 perform private.require_signal_admin();
 select * into d from private.doodles where id=p_id and state in ('PUBLISHED','CANDIDATE','HALL') and (state='HALL' or purge_at>private.doodle_now());
 if d.id is null then raise exception 'Drawing unavailable'; end if;
 return jsonb_build_object('version',1,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),'strokes',private.doodle_unpack(d.replay));
end $$;

create table private.doodle_moderation (
 id bigint generated always as identity primary key,
 drawing_id uuid references private.doodles(id) on delete set null,
 subject_number bigint,
 administrator uuid references auth.users(id) on delete set null,
 action text not null check(action in ('REMOVED','REJECTED','PROMOTED','DISPLACED','RESTRICTED','UNRESTRICTED','PAUSED','RESUMED','THRESHOLD_CHANGED')),
 created_at timestamptz not null
);
create index doodle_moderation_expiry on private.doodle_moderation(created_at,id);
alter table private.doodle_moderation enable row level security;
revoke all on private.doodle_moderation from public,anon,authenticated,service_role,atomic_bond_growth;
create function private.doodle_record(p_action text,p_drawing uuid,p_number bigint default null) returns void language sql security definer set search_path='' as $$
 insert into private.doodle_moderation(drawing_id,subject_number,administrator,action,created_at)
 values(p_drawing,coalesce(p_number,(select a.public_id from private.doodles d join public.atoms a on a.id=d.atom_id where d.id=p_drawing)),auth.uid(),p_action,private.doodle_now())
$$;
create function public.doodle_admin_history(p_before bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_signal_admin();
 return coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'drawingId',drawing_id,'atomNumber',subject_number::text,'action',action,'createdAt',created_at) order by id desc)
 from (select * from private.doodle_moderation where created_at>private.doodle_now()-interval '30 days' and (p_before is null or id<p_before) order by id desc limit 25) h),'[]'::jsonb);
end $$;

-- Allows an authorized moderator to lift a restriction even after artwork cleanup.
-- A public number chooses the subject; it never grants the caller authority.
create function public.doodle_admin_restrict_atom(p_number bigint,p_restricted boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform private.doodle_lock(); perform private.require_signal_admin();
 select id into target from public.atoms where public_id=p_number and status<>'DELETED';
 if target is null or p_restricted is null then raise exception 'Account unavailable'; end if;
 insert into private.doodle_accounts(atom_id,restricted) values(target,p_restricted)
 on conflict(atom_id) do update set restricted=excluded.restricted;
 perform private.doodle_record(case when p_restricted then 'RESTRICTED' else 'UNRESTRICTED' end,null,p_number);
end $$;
create function public.doodle_admin_pause(p_paused boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.doodle_lock(); perform private.require_signal_admin();
 if p_paused is null then raise exception 'Pause choice required'; end if;
 update private.doodle_settings set submissions_paused=p_paused where submissions_paused<>p_paused;
 if found then perform private.doodle_record(case when p_paused then 'PAUSED' else 'RESUMED' end,null); end if;
end $$;

create function public.moderate_doodle(p_id uuid,p_action text,p_fingerprint text) returns text language plpgsql security definer set search_path='' as $$
declare d private.doodles; t timestamptz; target integer; loser uuid; low_score integer;
begin
 perform private.doodle_lock(); perform private.require_signal_admin(); perform private.doodle_finalize(); t:=private.doodle_now();
 select * into d from private.doodles where id=p_id for update;
 if d.id is null or p_fingerprint is distinct from encode(sha256(d.bitmap||coalesce(d.replay,''::bytea)),'hex') then raise exception 'Reviewed payload required'; end if;
 if p_action='REMOVE' then
  if d.state='REMOVED' then return 'REMOVED'; end if;
  perform private.doodle_record('REMOVED',p_id);
  delete from private.doodle_hall where doodle_id=p_id;
  update private.doodles set state='REMOVED',purge_at=t where id=p_id; return 'REMOVED';
 elsif p_action='REJECT' and d.state in ('CANDIDATE') then
  perform private.doodle_record('REJECTED',p_id);
  update private.doodles set state='REJECTED',purge_at=t where id=p_id; return 'REJECTED';
 end if;
 if not exists(select 1 from public.atoms where id=d.atom_id and status='ACTIVE') or exists(select 1 from private.doodle_accounts where atom_id=d.atom_id and restricted) then raise exception 'Author unavailable'; end if;
 if p_action='PROMOTE' and d.state='CANDIDATE' and d.purge_at>t and d.final_score>=d.threshold then
  select s into target from generate_series(1,10) s where not exists(select 1 from private.doodle_hall where slot=s) order by s limit 1;
  if target is null then
   select h.slot,x.id,x.final_score into target,loser,low_score from private.doodle_hall h join private.doodles x on x.id=h.doodle_id order by x.final_score,x.promoted_at desc,x.id desc limit 1;
   if d.final_score<=low_score then return 'NOT_HIGHER_THAN_INCUMBENT'; end if;
   perform private.doodle_record('DISPLACED',loser);
   delete from private.doodle_hall where slot=target;
   update private.doodles set state='EXPIRED',purge_at=t where id=loser;
  end if;
  perform private.doodle_record('PROMOTED',p_id);
  insert into private.doodle_hall values(target,p_id);
  update private.doodles set state='HALL',promoted_at=t where id=p_id; return 'HALL';
 end if;
 raise exception 'Invalid moderation transition';
end $$;

create function public.doodle_admin_settings(p_threshold integer) returns void language plpgsql security definer set search_path='' as $$
begin perform private.doodle_lock(); perform private.require_signal_admin(); update private.doodle_settings set threshold=p_threshold; perform private.doodle_record('THRESHOLD_CHANGED',null); end $$;
create function public.restrict_doodle_author(p_id uuid,p_restricted boolean) returns void language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 perform private.doodle_lock(); perform private.require_signal_admin();
 select atom_id into a from private.doodles where id=p_id;
 if a is null or p_restricted is null then raise exception 'Drawing required'; end if;
 perform private.doodle_record(case when p_restricted then 'RESTRICTED' else 'UNRESTRICTED' end,p_id);
 insert into private.doodle_accounts(atom_id,restricted) values(a,p_restricted) on conflict(atom_id) do update set restricted=excluded.restricted;
end $$;

create function private.cleanup_doodles(p_limit integer default 500) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_limit is null or p_limit<1 or p_limit>1000 then raise exception 'Invalid batch size'; end if;
 perform private.doodle_lock(); perform private.doodle_finalize();
 -- Never purge an unfinalized ended publication: a backlog must not erase a qualifier.
 delete from private.doodles where id in (select id from private.doodles where state not in ('HALL','PUBLISHED') and purge_at<=private.doodle_now() order by purge_at,id limit p_limit);
 get diagnostics n=row_count;
 delete from private.doodle_requests where atom_id in
  (select atom_id from private.doodle_requests where window_at<private.doodle_now()-interval '24 hours' order by window_at,atom_id limit p_limit);
 delete from private.doodle_moderation where id in (select id from private.doodle_moderation where created_at<private.doodle_now()-interval '29 days' order by created_at,id limit p_limit);
 delete from private.doodle_rollout_members where atom_id in (select atom_id from private.doodle_rollout_members where expires_at<=private.doodle_now() order by expires_at,atom_id limit p_limit);
 return n;
end $$;

create function private.doodle_lifecycle_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if new.status<>old.status and new.status in ('DEACTIVATED','DELETED') then
  -- The enclosing lifecycle RPC already holds lifecycle_lock; preserve lock order.
  perform pg_advisory_xact_lock(120001);
  perform private.doodle_finalize();
  -- Freeze any affected closed windows beyond the ordinary cleanup batch before
  -- severing voter links. Account deletion must not rewrite an ended score.
  for target in select d.id from private.doodles d join private.doodle_appreciations v on v.doodle_id=d.id
   where v.voter_atom_id=new.id and d.state='PUBLISHED' and d.expires_at<=private.doodle_now()
  loop perform private.doodle_finalize(target); end loop;
  delete from private.doodles where atom_id=new.id;
  -- Final counts are snapshots, so removing private voter links cannot rewrite them.
  delete from private.doodle_appreciations where voter_atom_id=new.id and doodle_id in (select id from private.doodles where final_score is not null);
  if new.status='DELETED' then
   delete from private.doodle_rollout_members where atom_id=new.id;
   delete from private.doodle_requests where atom_id=new.id;
   delete from private.doodle_appreciations where voter_atom_id=new.id;
   delete from private.doodle_reports where reporter_atom_id=new.id;
   delete from private.doodle_accounts where atom_id=new.id;
  end if;
 end if; return new;
end $$;
create trigger doodle_lifecycle_cleanup after update of status on public.atoms for each row execute function private.doodle_lifecycle_cleanup();

-- All newly introduced executable functions are explicitly enumerated.
revoke all on function private.doodle_now(),private.doodle_owner(),private.doodle_lock(),private.doodle_pack(jsonb),private.doodle_unpack(bytea),private.doodle_immutable(),private.doodle_finalize(uuid),private.doodle_display(private.doodles,uuid),private.cleanup_doodles(integer),private.doodle_lifecycle_cleanup() from public,anon,authenticated,service_role,atomic_bond_growth;
revoke all on function public.submit_doodle(uuid,jsonb),public.read_doodles(timestamptz,uuid),public.doodle_replay(uuid),public.appreciate_doodle(uuid),public.report_doodle(uuid,text),public.doodle_admin_queue(timestamptz,uuid,text),public.doodle_admin_replay(uuid),public.moderate_doodle(uuid,text,text),public.doodle_admin_settings(integer),public.restrict_doodle_author(uuid,boolean) from public,anon,authenticated,service_role,atomic_bond_growth;
revoke all on function private.doodle_record(text,uuid,bigint),public.doodle_admin_pause(boolean),public.doodle_admin_history(bigint),public.doodle_admin_restrict_atom(bigint,boolean) from public,anon,authenticated,service_role,atomic_bond_growth;
-- Single authenticated entry point: callers cannot bypass request accounting by
-- invoking the underlying operation. Business failures are returned, not raised,
-- so PostgREST commits the attempt counter even when a payload is rejected.
create table private.doodle_requests (
 atom_id uuid primary key references public.atoms(id),
 window_at timestamptz not null, requests integer not null, writes integer not null
);
alter table private.doodle_requests enable row level security;
create index doodle_requests_expiry on private.doodle_requests(window_at,atom_id);
revoke all on private.doodle_requests from public,anon,authenticated,service_role,atomic_bond_growth;

create function public.doodle_request(p_operation text,p_args jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz; is_write boolean; rate private.doodle_requests; result jsonb;
begin
 -- Always use the lifecycle lock first, including reads: no reverse lock order.
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 is_write:=p_operation is null or p_operation not in ('read_doodles','doodle_replay','doodle_admin_queue','doodle_admin_replay','doodle_admin_history');
 insert into private.doodle_requests values(owner,t,0,0) on conflict do nothing;
 update private.doodle_requests set window_at=t,requests=0,writes=0 where atom_id=owner and window_at<=t-interval '1 minute';
 select * into rate from private.doodle_requests where atom_id=owner for update;
 if rate.requests>=120 or (is_write and rate.writes>=30) then
  return jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',greatest(1,ceil(extract(epoch from rate.window_at+interval '1 minute'-t))));
 end if;
 update private.doodle_requests set requests=requests+1,writes=writes+is_write::integer where atom_id=owner;
 -- Only this nested block rolls back on invalid data; attempt accounting survives.
 begin
  if p_args is null or jsonb_typeof(p_args)<>'array' or jsonb_array_length(p_args)>3 or octet_length(p_args::text)>70000 then
   return jsonb_build_object('error','INVALID_REQUEST');
  end if;
  case p_operation
   when 'submit_doodle' then result:=to_jsonb(public.submit_doodle((p_args->>0)::uuid,p_args->1));
   when 'read_doodles' then result:=public.read_doodles((p_args->>0)::timestamptz,(p_args->>1)::uuid);
   when 'doodle_replay' then result:=public.doodle_replay((p_args->>0)::uuid);
   when 'appreciate_doodle' then result:=to_jsonb(public.appreciate_doodle((p_args->>0)::uuid));
   when 'report_doodle' then result:=to_jsonb(public.report_doodle((p_args->>0)::uuid,p_args->>1));
   when 'doodle_admin_queue' then result:=public.doodle_admin_queue((p_args->>0)::timestamptz,(p_args->>1)::uuid,coalesce(p_args->>2,'ALL'));
   when 'doodle_admin_pause' then perform public.doodle_admin_pause((p_args->>0)::boolean); result:='true'::jsonb;
   when 'doodle_admin_restrict_atom' then perform public.doodle_admin_restrict_atom((p_args->>0)::bigint,(p_args->>1)::boolean); result:='true'::jsonb;
   when 'doodle_admin_history' then result:=public.doodle_admin_history((p_args->>0)::bigint);
   when 'doodle_admin_replay' then result:=public.doodle_admin_replay((p_args->>0)::uuid);
   when 'moderate_doodle' then result:=to_jsonb(public.moderate_doodle((p_args->>0)::uuid,p_args->>1,p_args->>2));
   when 'doodle_admin_settings' then perform public.doodle_admin_settings((p_args->>0)::integer); result:='true'::jsonb;
   when 'restrict_doodle_author' then perform public.restrict_doodle_author((p_args->>0)::uuid,(p_args->>1)::boolean); result:='true'::jsonb;
   else return jsonb_build_object('error','INVALID_REQUEST');
  end case;
  return jsonb_build_object('data',result);
 exception when others then
  -- Never serialize SQL details, arguments, content, identity or internal metadata.
  return jsonb_build_object('error',case when sqlerrm='Submissions paused' then 'SUBMISSIONS_PAUSED' else 'OPERATION_REJECTED' end);
 end;
end $$;
revoke all on function public.doodle_request(text,jsonb) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.doodle_request(text,jsonb) to authenticated;
-- Explicit trusted migration ownership; no additional client grants.
alter function public.doodle_request(text,jsonb) owner to postgres;
alter function private.doodle_now() owner to postgres;
alter function private.doodle_owner() owner to postgres;
alter function private.doodle_lock() owner to postgres;
alter function private.doodle_pack(jsonb) owner to postgres;
alter function private.doodle_unpack(bytea) owner to postgres;
alter function private.doodle_immutable() owner to postgres;
alter function private.doodle_finalize(uuid) owner to postgres;
alter function public.submit_doodle(uuid,jsonb) owner to postgres;
alter function private.doodle_display(private.doodles,uuid) owner to postgres;
alter function public.read_doodles(timestamptz,uuid) owner to postgres;
alter function public.doodle_replay(uuid) owner to postgres;
alter function public.appreciate_doodle(uuid) owner to postgres;
alter function public.report_doodle(uuid,text) owner to postgres;
alter function public.doodle_admin_queue(timestamptz,uuid,text) owner to postgres;
alter function public.doodle_admin_replay(uuid) owner to postgres;
alter function private.doodle_record(text,uuid,bigint) owner to postgres;
alter function public.doodle_admin_history(bigint) owner to postgres;
alter function public.doodle_admin_restrict_atom(bigint,boolean) owner to postgres;
alter function public.doodle_admin_pause(boolean) owner to postgres;
alter function public.moderate_doodle(uuid,text,text) owner to postgres;
alter function public.doodle_admin_settings(integer) owner to postgres;
alter function public.restrict_doodle_author(uuid,boolean) owner to postgres;
alter function private.cleanup_doodles(integer) owner to postgres;
alter function private.doodle_lifecycle_cleanup() owner to postgres;
revoke all on sequence private.doodle_moderation_id_seq from public,anon,authenticated,service_role,atomic_bond_growth;
commit;
