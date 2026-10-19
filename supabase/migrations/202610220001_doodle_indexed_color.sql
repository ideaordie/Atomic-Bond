-- Task 20.1 CANDIDATE ONLY. Apply locally; publication requires separate approval.
-- Both format readers must be deployed before enabling color_submissions.
begin;
-- Fail safely rather than waiting indefinitely behind live traffic.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table private.doodle_settings add column color_submissions boolean not null default false;
alter table private.doodles add column encoding_version smallint not null default 1 check(encoding_version in (1,2));
alter table private.doodles drop constraint doodles_bitmap_check;
alter table private.doodles drop constraint doodles_replay_check;
create function private.doodle_bitmap_valid(v smallint,b bytea) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if v=1 then return octet_length(b)=512; end if;
 if v<>2 or octet_length(b)<>2048 then return false; end if;
 for i in 0..2047 loop if (get_byte(b,i)&15)>8 or (get_byte(b,i)>>4)>8 then return false; end if; end loop;
 return true;
end $$;
alter table private.doodles add constraint doodles_bitmap_check check(private.doodle_bitmap_valid(encoding_version,bitmap));
alter table private.doodles add constraint doodles_replay_check check(octet_length(replay)<=case when encoding_version=1 then 16896 else 17152 end);
create function private.doodle_fingerprint(v smallint,b bytea,r bytea) returns text language sql immutable set search_path='' as $$
 select encode(sha256(case when v=1 then ''::bytea else decode('02','hex') end||b||coalesce(r,''::bytea)),'hex')
$$;


create function private.doodle_pack_color(p jsonb) returns bytea language plpgsql immutable set search_path='' as $$
declare bits bytea:=decode(repeat('00',2048),'hex'); final bytea; result bytea:=''; s jsonb; q jsonb; n integer; total integer:=0; point integer; color integer; shift integer;
begin
 if p->'version' is distinct from '2'::jsonb or jsonb_typeof(p->'bitmap') is distinct from 'string' or length(p->>'bitmap')<>2732 then raise exception 'Invalid drawing'; end if;
 final:=decode(p->>'bitmap','base64');
 if not private.doodle_bitmap_valid(2::smallint,final) or final=bits or replace(encode(final,'base64'),E'\n','')<>p->>'bitmap' then raise exception 'Empty or invalid bitmap'; end if;
 if p->'strokes'='null'::jsonb then return null; end if;
 if jsonb_typeof(p->'strokes') is distinct from 'array' then raise exception 'Invalid replay'; end if;
 if jsonb_array_length(p->'strokes')>256 then raise exception 'Replay limit'; end if;
 for s in select value from jsonb_array_elements(p->'strokes') loop
  if jsonb_typeof(s->'color') is distinct from 'number' or (s->>'color') !~ '^[0-8]$' or jsonb_typeof(s->'draw') is distinct from 'boolean' or jsonb_typeof(s->'points') is distinct from 'array' then raise exception 'Invalid stroke'; end if;
  color:=(s->>'color')::integer;
  if (s->>'draw')::boolean<>(color>0) then raise exception 'Invalid stroke'; end if;
  n:=jsonb_array_length(s->'points'); total:=total+n;
  if n<1 or total>8192 then raise exception 'Replay limit'; end if;
  result:=result||decode(lpad(to_hex(n),4,'0')||lpad(to_hex(color),2,'0'),'hex');
  for q in select value from jsonb_array_elements(s->'points') loop
   if jsonb_typeof(q)<>'number' or q::text !~ '^[0-9]{1,4}$' then raise exception 'Invalid point'; end if;
   point:=(q::text)::integer;
   if point>4095 then raise exception 'Invalid point'; end if;
   shift:=(point%2)*4;
   bits:=set_byte(bits,point/2,(get_byte(bits,point/2)& ~(15<<shift))|(color<<shift));
   result:=result||decode(lpad(to_hex(point),4,'0'),'hex');
  end loop;
 end loop;
 if bits<>final then raise exception 'Replay and final bitmap differ'; end if;
 return result;
end $$;


create or replace function private.doodle_pack(p jsonb) returns bytea language plpgsql immutable set search_path='' as $$
declare s jsonb; q jsonb; n integer; total integer:=0; point integer; header integer; result bytea:=''::bytea; bits bytea:=decode(repeat('00',512),'hex'); final bytea;
begin
 if p->'version'='2'::jsonb then return private.doodle_pack_color(p); end if;
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

create function private.doodle_unpack_version(v smallint,p bytea) returns jsonb language plpgsql immutable set search_path='' as $$
declare i integer:=0; n integer; color integer; points jsonb; result jsonb:='[]';
begin
 if v=1 then return private.doodle_unpack(p); end if;
 if v<>2 then raise exception 'Invalid version'; end if;
 if p is null then return 'null'::jsonb; end if;
 while i<octet_length(p) loop
  n:=get_byte(p,i)*256+get_byte(p,i+1); color:=get_byte(p,i+2); i:=i+3; points:='[]';
  for j in 1..n loop points:=points||to_jsonb(get_byte(p,i)*256+get_byte(p,i+1)); i:=i+2; end loop;
  result:=result||jsonb_build_object('draw',color>0,'color',color,'points',points);
 end loop;
 return result;
end $$;


create or replace function private.doodle_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.encoding_version<>old.encoding_version or new.bitmap<>old.bitmap or new.replay is distinct from old.replay or new.atom_id<>old.atom_id or new.request_id<>old.request_id then raise exception 'Immutable drawing'; end if;
 if old.final_score is not null and new.final_score is distinct from old.final_score then raise exception 'Final score is immutable'; end if;
 return new;
end $$;

create or replace function private.doodle_display(d private.doodles,p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',d.encoding_version,'id',d.id,'atomNumber',a.public_id::text,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),
 'publishedAt',d.published_at,'expiresAt',d.expires_at,'score',coalesce(d.final_score,(select count(*) from private.doodle_appreciations where doodle_id=d.id)),
 'appreciated',exists(select 1 from private.doodle_appreciations where doodle_id=d.id and voter_atom_id=p_owner),'own',d.atom_id=p_owner)
 from public.atoms a where a.id=d.atom_id and a.status='ACTIVE'
$$;

create or replace function public.submit_doodle(p_request uuid,p_drawing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz; packed bytea; existing private.doodles; result uuid; account private.doodle_accounts; fingerprint text;
begin
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 if p_request is null or octet_length(p_drawing::text)>65536 then raise exception 'Invalid submission'; end if;
 packed:=private.doodle_pack(p_drawing);
 fingerprint:=private.doodle_fingerprint((p_drawing->>'version')::smallint,decode(p_drawing->>'bitmap','base64'),packed);
 t:=private.doodle_now();
 select * into account from private.doodle_accounts where atom_id=owner;
 if account.last_request=p_request then
  if account.last_hash<>fingerprint then raise exception 'Idempotency conflict'; end if;
  return account.last_result;
 end if;
 select * into existing from private.doodles where atom_id=owner and request_id=p_request;
 if found then
  if existing.encoding_version<>(p_drawing->>'version')::smallint or existing.bitmap<>decode(p_drawing->>'bitmap','base64') or existing.replay is distinct from packed then raise exception 'Idempotency conflict'; end if;
  return existing.id;
 end if;
 if p_drawing->'version'='2'::jsonb and not (select color_submissions from private.doodle_settings) then raise exception 'Color submissions disabled'; end if;
 insert into private.doodle_accounts(atom_id) values(owner) on conflict do nothing;
 if exists(select 1 from private.doodle_accounts where atom_id=owner and (restricted or last_submitted>t-interval '60 minutes')) then raise exception 'Submission unavailable: restriction or cooldown'; end if;
 if (select submissions_paused from private.doodle_settings) then raise exception 'Submissions paused'; end if;

 insert into private.doodles(encoding_version,atom_id,request_id,bitmap,replay,state,submitted_at,published_at,expires_at,purge_at,threshold)
 values((p_drawing->>'version')::smallint,owner,p_request,decode(p_drawing->>'bitmap','base64'),packed,'PUBLISHED',t,t,t+interval '168 hours',t+interval '168 hours',(select threshold from private.doodle_settings)) returning id into result;
 update private.doodle_accounts set last_submitted=t,last_request=p_request,last_result=result,last_hash=fingerprint where atom_id=owner;
 return result;
end $$;

create or replace function public.doodle_admin_queue(p_after timestamptz default null,p_id uuid default null,p_view text default 'ALL') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.doodle_lock(); perform private.require_signal_admin(); perform private.doodle_finalize();
 if p_view is null or p_view not in ('ALL','ACTIVE','REPORTED','CANDIDATE','HALL') then raise exception 'Invalid moderation view'; end if;
 return jsonb_build_object('threshold',(select threshold from private.doodle_settings),'submissionsPaused',(select submissions_paused from private.doodle_settings),'items',coalesce((select jsonb_agg(
 private.doodle_display(d,null)||jsonb_build_object('state',d.state,'fingerprint',private.doodle_fingerprint(d.encoding_version,d.bitmap,d.replay),'reportCount',(select count(*) from private.doodle_reports where doodle_id=d.id),
 'reportCategories',(select coalesce(jsonb_agg(distinct category),'[]'::jsonb) from private.doodle_reports where doodle_id=d.id),'reviewUntil',d.purge_at,'submittedAt',d.submitted_at)
 order by d.submitted_at,d.id) from (select x.* from private.doodles x join public.atoms a on a.id=x.atom_id where a.status='ACTIVE' and ((x.state='PUBLISHED' and x.expires_at>private.doodle_now()) or (x.state='CANDIDATE' and x.purge_at>private.doodle_now()) or x.state='HALL')
 and (p_view='ALL' or (p_view='ACTIVE' and x.state='PUBLISHED') or (p_view='REPORTED' and exists(select 1 from private.doodle_reports where doodle_id=x.id)) or x.state=p_view)
 and (p_after is null or (x.submitted_at,x.id)>(p_after,coalesce(p_id,'00000000-0000-0000-0000-000000000000'::uuid)))
 order by x.submitted_at,x.id limit 25) d),'[]'::jsonb));
end $$;

create or replace function public.doodle_admin_replay(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.doodles;
begin
 perform private.require_signal_admin();
 select * into d from private.doodles where id=p_id and state in ('PUBLISHED','CANDIDATE','HALL') and (state='HALL' or purge_at>private.doodle_now());
 if d.id is null then raise exception 'Drawing unavailable'; end if;
 return jsonb_build_object('version',d.encoding_version,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),'strokes',private.doodle_unpack_version(d.encoding_version,d.replay));
end $$;

create or replace function public.moderate_doodle(p_id uuid,p_action text,p_fingerprint text) returns text language plpgsql security definer set search_path='' as $$
declare d private.doodles; t timestamptz; target integer; loser uuid; low_score integer;
begin
 perform private.doodle_lock(); perform private.require_signal_admin(); perform private.doodle_finalize(); t:=private.doodle_now();
 select * into d from private.doodles where id=p_id for update;
 if d.id is null or p_fingerprint is distinct from private.doodle_fingerprint(d.encoding_version,d.bitmap,d.replay) then raise exception 'Reviewed payload required'; end if;
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

create or replace function public.doodle_replay(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); d private.doodles;
begin
 select x.* into d from private.doodles x join public.atoms a on a.id=x.atom_id where x.id=p_id and a.status='ACTIVE'
 and ((x.state='PUBLISHED' and x.expires_at>private.doodle_now()) or (x.state='HALL' and exists(select 1 from private.doodle_hall where doodle_id=x.id)));
 if d.id is null then raise exception 'Drawing unavailable'; end if;
 return jsonb_build_object('version',d.encoding_version,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),'strokes',null);
end $$;

revoke all on function private.doodle_bitmap_valid(smallint,bytea),private.doodle_fingerprint(smallint,bytea,bytea),private.doodle_pack_color(jsonb),private.doodle_unpack_version(smallint,bytea) from public,anon,authenticated,service_role,atomic_bond_growth;
alter function private.doodle_bitmap_valid(smallint,bytea) owner to postgres;
alter function private.doodle_fingerprint(smallint,bytea,bytea) owner to postgres;
alter function private.doodle_pack_color(jsonb) owner to postgres;
alter function private.doodle_unpack_version(smallint,bytea) owner to postgres;
commit;
