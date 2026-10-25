-- Task 21.2 approved Direct Bond Requests foundation. No external invitation functions are changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table private.direct_bond_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into private.direct_bond_settings values(true,false);
alter table private.direct_bond_settings enable row level security;
revoke all on private.direct_bond_settings from public,anon,authenticated,service_role,atomic_bond_growth;
create table private.direct_bond_requests (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.atoms(id), recipient uuid not null references public.atoms(id),
 created_at timestamptz not null, expires_at timestamptz not null,
 state text not null default 'PENDING' check(state in ('PENDING','ACCEPTED','DECLINED','CANCELLED','EXPIRED','UNAVAILABLE','SUPERSEDED')),
 seen_at timestamptz, closed_at timestamptz, bond_id uuid references public.bonds(id),
 check(sender<>recipient), check(expires_at=created_at+interval '168 hours'),
 check((state='PENDING')=(closed_at is null))
);
create unique index direct_request_pending_pair on private.direct_bond_requests(sender,recipient) where state='PENDING';
create index direct_request_inbox on private.direct_bond_requests(recipient,created_at,id) where state='PENDING';
create index direct_request_sender on private.direct_bond_requests(sender,created_at);
create index direct_request_cleanup on private.direct_bond_requests(closed_at,expires_at);
create table private.direct_bond_preferences(atom_id uuid primary key references public.atoms(id),receiving boolean not null default true);
create table private.direct_bond_sends(id uuid primary key default gen_random_uuid(),sender uuid not null references public.atoms(id),created_at timestamptz not null);
create index direct_bond_sends_owner on private.direct_bond_sends(sender,created_at);
alter table private.direct_bond_sends enable row level security;
revoke all on private.direct_bond_sends from public,anon,authenticated,service_role,atomic_bond_growth;
alter table private.direct_bond_requests enable row level security;
alter table private.direct_bond_preferences enable row level security;
revoke all on private.direct_bond_requests,private.direct_bond_preferences from public,anon,authenticated,service_role,atomic_bond_growth;
create function private.direct_bond_now() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
create function private.direct_bond_eligible(s uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select s<>r and (select count(*)=2 from public.atoms where id in(s,r) and status='ACTIVE')
 and coalesce((select receiving from private.direct_bond_preferences where atom_id=r),true)
 and not exists(select 1 from public.bonds where atom_a_id=least(s,r) and atom_b_id=greatest(s,r))
 and exists(select 1 from private.reachable(s) where id=r)
$$;
create function private.direct_bond_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='DELETED' then
  delete from private.direct_bond_requests where sender=new.id or recipient=new.id;
  delete from private.direct_bond_preferences where atom_id=new.id;
  delete from private.direct_bond_sends where sender=new.id;
 elsif new.status<>'ACTIVE' and old.status is distinct from new.status then
  update private.direct_bond_requests set state='UNAVAILABLE',closed_at=private.direct_bond_now() where state='PENDING' and (sender=new.id or recipient=new.id);
 end if;
 return new;
end $$;
create trigger direct_bond_lifecycle after update of status on public.atoms for each row execute function private.direct_bond_lifecycle();
create table private.direct_bond_cleanup_status(singleton boolean primary key default true check(singleton),last_success timestamptz,last_failure timestamptz,error_code text,removed integer,expired integer);
alter table private.direct_bond_cleanup_status enable row level security;
revoke all on private.direct_bond_cleanup_status from public,anon,authenticated,service_role,atomic_bond_growth;
create function private.direct_bond_cleanup(p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; m integer; t timestamptz;
begin
 perform private.lifecycle_lock(); t:=private.direct_bond_now();
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'Invalid batch'; end if;
 with expired as(select id from private.direct_bond_requests where state='PENDING' and expires_at<=t order by expires_at,id limit p_limit for update)
 update private.direct_bond_requests r set state='EXPIRED',closed_at=r.expires_at from expired e where r.id=e.id;
 get diagnostics n=row_count;
 with old as(select id from private.direct_bond_requests where closed_at<=t-interval '30 days' order by closed_at,id limit p_limit for update)
 delete from private.direct_bond_requests r using old o where r.id=o.id;
 get diagnostics m=row_count;
 with old as(select id from private.direct_bond_sends where created_at<=t-interval '24 hours' order by created_at,id limit p_limit) delete from private.direct_bond_sends s using old o where s.id=o.id;
 insert into private.direct_bond_cleanup_status(singleton,last_success,removed,expired,error_code) values(true,t,m,n,null) on conflict(singleton) do update set last_success=excluded.last_success,removed=excluded.removed,expired=excluded.expired,error_code=null;
 return jsonb_build_object('ok',true,'expired',n,'purged',m,'at',t);
exception when others then
 insert into private.direct_bond_cleanup_status(singleton,last_failure,error_code) values(true,clock_timestamp(),SQLSTATE) on conflict(singleton) do update set last_failure=excluded.last_failure,error_code=excluded.error_code;
 return jsonb_build_object('ok',false,'error','Cleanup failed');
end $$;
create function public.direct_bond_request(p_operation text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; target uuid; t timestamptz; r private.direct_bond_requests; result uuid; notice uuid; receiving boolean;
begin
 perform private.lifecycle_lock();
 owner:=private.account_owner();
 if not exists(select 1 from public.atoms where id=owner and status='ACTIVE') then raise exception 'Active owner required' using errcode='42501'; end if;
 if not coalesce((select enabled from private.direct_bond_settings where singleton),false) then raise exception 'Requests unavailable' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1024 then raise exception 'Invalid request'; end if;
 t:=private.direct_bond_now();
 update private.direct_bond_requests set state='EXPIRED',closed_at=expires_at where state='PENDING' and expires_at<=t and sender=owner;
 if p_operation in ('eligibility','create') then
  if coalesce(p_payload->>'target','') !~ '^[1-9][0-9]{0,17}$' then raise exception 'Request unavailable'; end if;
  select id into target from public.atoms where public_id::text=p_payload->>'target' and status='ACTIVE';
  if target is null or not private.direct_bond_eligible(owner,target) then
   if p_operation='eligibility' then return jsonb_build_object('eligible',false); end if;
   raise exception 'Request unavailable';
  end if;
  select * into r from private.direct_bond_requests where sender=owner and recipient=target and state='PENDING';
  if p_operation='eligibility' then return jsonb_build_object('eligible',true,'pending',r.id is not null,'id',r.id); end if;
  if r.id is not null then return jsonb_build_object('id',r.id,'state',r.state); end if;
  if exists(select 1 from private.direct_bond_requests where sender=owner and recipient=target and state='DECLINED' and closed_at>t-interval '30 days') then raise exception 'Request unavailable'; end if;
  if (select count(*) from private.direct_bond_sends where sender=owner and created_at>t-interval '24 hours')>=5 then raise exception 'Daily request limit reached'; end if;
  if (select count(*) from private.direct_bond_requests where sender=owner and state='PENDING')>=10 then raise exception 'Outstanding request limit reached'; end if;
  insert into private.direct_bond_requests(sender,recipient,created_at,expires_at) values(owner,target,t,t+interval '168 hours') returning id into result;
  insert into private.direct_bond_sends(sender,created_at) values(owner,t);
  return jsonb_build_object('id',result,'state','PENDING');
 elsif p_operation in ('preferences','set_preference') then
  if p_operation='set_preference' then
   if jsonb_typeof(p_payload->'receiving') is distinct from 'boolean' then raise exception 'Invalid preference'; end if;
   insert into private.direct_bond_preferences values(owner,(p_payload->>'receiving')::boolean) on conflict(atom_id) do update set receiving=excluded.receiving;
   if not (p_payload->>'receiving')::boolean then update private.direct_bond_requests set state='CANCELLED',closed_at=t where recipient=owner and state='PENDING'; end if;
  end if;
  return jsonb_build_object('receiving',coalesce((select p.receiving from private.direct_bond_preferences p where atom_id=owner),true));
 elsif p_operation in ('list','notice') then
  if p_operation='notice' then
   select q.id into notice from private.direct_bond_requests q where recipient=owner and state='PENDING' and expires_at>t and seen_at is null and private.direct_bond_eligible(sender,recipient) order by created_at,id limit 1 for update;
   update private.direct_bond_requests set seen_at=t where id=notice;
  end if;
  return jsonb_build_object('notice',notice,'noticeItem',(select jsonb_build_object('id',q.id,'number',a.public_id::text,'incoming',true,'expiresAt',q.expires_at,'createdAt',q.created_at) from private.direct_bond_requests q join public.atoms a on a.id=q.sender where q.id=notice),'items',coalesce((select jsonb_agg(x.item order by x.created_at,x.id) from (
   select q.created_at,q.id,jsonb_build_object('id',q.id,'number',a.public_id::text,'incoming',q.recipient=owner,'expiresAt',q.expires_at,'createdAt',q.created_at) item
   from private.direct_bond_requests q join public.atoms a on a.id=case when q.sender=owner then q.recipient else q.sender end
   where q.state='PENDING' and q.expires_at>t and (q.sender=owner or q.recipient=owner) and private.direct_bond_eligible(q.sender,q.recipient)
   and (not(p_payload ? 'after') or (q.created_at,q.id)>((p_payload->'after'->>'createdAt')::timestamptz,(p_payload->'after'->>'id')::uuid))
   order by q.created_at,q.id limit 50) x),'[]'::jsonb));
 elsif p_operation in ('accept','dismiss','decline','cancel') then
  select * into r from private.direct_bond_requests where id=(p_payload->>'id')::uuid for update;
  if r.id is null or (case when p_operation='cancel' then r.sender else r.recipient end)<>owner then raise exception 'Request unavailable' using errcode='42501'; end if;
  if p_operation='accept' and r.state='ACCEPTED' then return jsonb_build_object('state','ACCEPTED','replayed',true); end if;
  if r.state<>'PENDING' or r.expires_at<=t then raise exception 'Request unavailable'; end if;
  if p_operation='dismiss' then update private.direct_bond_requests set seen_at=t where id=r.id; return jsonb_build_object('state','PENDING'); end if;
  if p_operation='accept' then
   if not private.direct_bond_eligible(r.sender,r.recipient) then raise exception 'Request unavailable'; end if;
   insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least(r.sender,r.recipient),greatest(r.sender,r.recipient),'CONFIRMED',t) returning id into result;
   update private.direct_bond_requests set state='ACCEPTED',closed_at=t,bond_id=result where id=r.id;
   update private.direct_bond_requests set state='SUPERSEDED',closed_at=t where sender=r.recipient and recipient=r.sender and state='PENDING';
   return jsonb_build_object('state','ACCEPTED','replayed',false);
  end if;
  update private.direct_bond_requests set state=case when p_operation='decline' then 'DECLINED' else 'CANCELLED' end,closed_at=t where id=r.id;
  return jsonb_build_object('state',case when p_operation='decline' then 'DECLINED' else 'CANCELLED' end);
 end if;
 raise exception 'Unknown operation';
end $$;
revoke all on function private.direct_bond_now(),private.direct_bond_eligible(uuid,uuid),private.direct_bond_lifecycle(),private.direct_bond_cleanup(integer) from public,anon,authenticated,service_role,atomic_bond_growth;
revoke all on function public.direct_bond_request(text,jsonb) from public,anon,authenticated;
grant execute on function public.direct_bond_request(text,jsonb) to authenticated;
commit;
