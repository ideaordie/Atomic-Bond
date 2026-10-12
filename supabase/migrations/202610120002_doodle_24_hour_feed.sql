-- Task 12.2 approved 24-hour feed migration. Existing deadlines remain unchanged.
-- No existing row, expiry, score, permission or Cron changes.
begin;
create or replace function public.submit_doodle(p_request uuid,p_drawing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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

 insert into private.doodles(atom_id,request_id,bitmap,replay,state,submitted_at,published_at,expires_at,purge_at,threshold)
 values(owner,p_request,decode(p_drawing->>'bitmap','base64'),packed,'PUBLISHED',t,t,t+interval '24 hours',t+interval '24 hours',(select threshold from private.doodle_settings)) returning id into result;
 update private.doodle_accounts set last_submitted=t,last_request=p_request,last_result=result,last_hash=fingerprint where atom_id=owner;
 return result;
end $$;
create or replace function public.doodle_request(p_operation text,p_args jsonb default '[]'::jsonb)
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
   when 'publish_doodle' then
    result:=to_jsonb(public.submit_doodle((p_args->>0)::uuid,p_args->1));
    select jsonb_build_object('id',d.id,'publishedAt',d.published_at,'expiresAt',d.expires_at,'nextEligibleAt',a.last_submitted+interval '60 minutes','serverTime',private.doodle_now()) into result
    from private.doodles d join private.doodle_accounts a on a.atom_id=d.atom_id where d.id=(result#>>'{}')::uuid and d.atom_id=owner;
    if result is null then raise exception 'Publication unavailable'; end if;
   when 'submit_doodle' then result:=to_jsonb(public.submit_doodle((p_args->>0)::uuid,p_args->1));
   when 'read_doodles' then result:=private.doodle_feed((p_args->>0)::timestamptz,(p_args->>1)::uuid,coalesce(p_args->2,'[]'::jsonb));
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
create function private.doodle_feed(p_before timestamptz,p_id uuid,p_visible jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); t timestamptz:=private.doodle_now(); result jsonb; last_item jsonb;
begin
 if jsonb_typeof(p_visible)<>'array' or jsonb_array_length(p_visible)>100 then raise exception 'Invalid visible window'; end if;
 if (p_before is null)<>(p_id is null) then raise exception 'Complete cursor required'; end if;
 result:=public.read_doodles(p_before,p_id);
 last_item:=result->'items'->-1;
 return result||jsonb_build_object(
 'nextEligibleAt',(select last_submitted+interval '60 minutes' from private.doodle_accounts where atom_id=owner),
 'nextCursor',case when exists(select 1 from private.doodles d join public.atoms a on a.id=d.atom_id
 where d.state='PUBLISHED' and d.expires_at>t and a.status='ACTIVE'
 and (d.published_at,d.id)<((last_item->>'publishedAt')::timestamptz,(last_item->>'id')::uuid))
 then jsonb_build_array(last_item->>'publishedAt',last_item->>'id') else null end,
 'refreshed',coalesce((select jsonb_agg(private.doodle_display(d,owner)) from private.doodles d
 join public.atoms a on a.id=d.atom_id where d.id in(select value::uuid from jsonb_array_elements_text(p_visible))
 and d.state='PUBLISHED' and d.expires_at>t and a.status='ACTIVE'),'[]'::jsonb));
end $$;
alter function private.doodle_feed(timestamptz,uuid,jsonb) owner to postgres;
revoke all on function private.doodle_feed(timestamptz,uuid,jsonb) from public,anon,authenticated,service_role,atomic_bond_growth;
-- Ordinary callers no longer download replay. Reporting retains the existing
-- content-availability check; administrators use their independently authorized RPC.
create or replace function public.doodle_replay(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); d private.doodles;
begin
 select x.* into d from private.doodles x join public.atoms a on a.id=x.atom_id where x.id=p_id and a.status='ACTIVE'
 and ((x.state='PUBLISHED' and x.expires_at>private.doodle_now()) or (x.state='HALL' and exists(select 1 from private.doodle_hall where doodle_id=x.id)));
 if d.id is null then raise exception 'Drawing unavailable'; end if;
 return jsonb_build_object('version',1,'bitmap',replace(encode(d.bitmap,'base64'),E'\n',''),'strokes',null);
end $$;
commit;
