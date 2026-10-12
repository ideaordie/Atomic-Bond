-- Task 12.3 Approved release. No data writes, new grants, policies or credentials.
begin;
create function private.doodle_network_feed(p_before timestamptz,p_id uuid,p_visible jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=private.doodle_owner(); t timestamptz:=private.doodle_now(); members uuid[]; page jsonb; last_item jsonb; more boolean;
begin
 if jsonb_typeof(p_visible)<>'array' or jsonb_array_length(p_visible)>100 then raise exception 'Invalid visible window'; end if;
 if (p_before is null)<>(p_id is null) then raise exception 'Complete cursor required'; end if;
 -- Exactly one traversal per feed request, rooted only in the verified session.
 -- Retained inactive nodes may connect the topology; authors must still be ACTIVE.
 -- Same structural semantics as private.reachable, with separate indexed edge
 -- directions to avoid an OR-join scan at each recursive step. UNION deduplicates
 -- cycles. Match the application's 5,000-node beta retrieval ceiling; fail closed
 -- rather than return a misleading partial component.
 with recursive reach(id) as (
  select a.id from public.atoms a where a.id=owner and a.public_id is not null and a.status='ACTIVE'
  union
  select a.id from reach r cross join lateral (
   select b.atom_b_id as id from public.bonds b where b.atom_a_id=r.id and b.status='CONFIRMED'
   union all
   select b.atom_a_id as id from public.bonds b where b.atom_b_id=r.id and b.status='CONFIRMED'
  ) edge join public.atoms a on a.id=edge.id
  where a.public_id is not null and a.status in ('ACTIVE','DORMANT','DEACTIVATED','DELETED')
 ) select array_agg(id) into members from (select id from reach limit 5001) bounded;
 if cardinality(members)>5000 then raise exception 'Network exceeds initial retrieval limit'; end if;
 with eligible as materialized (
 select d.* from private.doodles d join public.atoms a on a.id=d.atom_id
 where d.atom_id=any(members) and a.status='ACTIVE' and d.state='PUBLISHED' and d.expires_at>t
 and (p_before is null or (d.published_at,d.id)<(p_before,p_id))
 order by d.published_at desc,d.id desc limit 21),
 displayed as (select * from eligible order by published_at desc,id desc limit 20)
 select coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.published_at desc,d.id desc) from displayed d),'[]'::jsonb),
 (select count(*)>20 from eligible) into page,more;
 last_item:=page->-1;
 return jsonb_build_object('serverTime',t,'submissionsPaused',(select submissions_paused from private.doodle_settings),
 'nextEligibleAt',(select last_submitted+interval '60 minutes' from private.doodle_accounts where atom_id=owner),
 'items',page,'nextCursor',case when more then jsonb_build_array(last_item->>'publishedAt',last_item->>'id') else null end,
 'refreshed',coalesce((select jsonb_agg(private.doodle_display(d,owner)) from private.doodles d join public.atoms a on a.id=d.atom_id
 where d.id in(select value::uuid from jsonb_array_elements_text(p_visible)) and d.atom_id=any(members)
 and a.status='ACTIVE' and d.state='PUBLISHED' and d.expires_at>t),'[]'::jsonb),
 'hall',coalesce((select jsonb_agg(private.doodle_display(d,owner) order by d.final_score desc,d.promoted_at,d.id)
 from private.doodle_hall h join private.doodles d on d.id=h.doodle_id join public.atoms a on a.id=d.atom_id where d.state='HALL' and a.status='ACTIVE'),'[]'::jsonb));
end $$;
alter function private.doodle_network_feed(timestamptz,uuid,jsonb) owner to postgres;
revoke all on function private.doodle_network_feed(timestamptz,uuid,jsonb) from public,anon,authenticated,service_role,atomic_bond_growth;
create or replace function public.doodle_request(p_operation text,p_args jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz; is_write boolean; rate private.doodle_requests; result jsonb;
begin
 -- Always use the lifecycle lock first, including reads: no reverse lock order.
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 is_write:=p_operation is null or p_operation not in ('read_doodles','read_network_doodles','doodle_replay','doodle_admin_queue','doodle_admin_replay','doodle_admin_history');
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
   when 'read_network_doodles' then result:=private.doodle_network_feed((p_args->>0)::timestamptz,(p_args->>1)::uuid,coalesce(p_args->2,'[]'::jsonb));
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
commit;
