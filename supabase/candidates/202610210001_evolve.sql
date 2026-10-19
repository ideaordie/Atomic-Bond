-- Task 19.1: LOCAL CANDIDATE ONLY. No hosted application or scheduling authorized.
begin;
create table private.evolve_settings (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into private.evolve_settings default values;
create table private.evolve_accounts (
 atom_id uuid primary key references public.atoms(id) on delete cascade,
 last_submitted_at timestamptz, revision bigint not null default 0 check(revision>=0),
 window_at timestamptz not null, requests integer not null default 0
);
create table private.evolve_ideas (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references public.atoms(id) on delete set null,
 body text, attribution boolean not null default false,
 status text not null default 'PROPOSED' check(status in ('PROPOSED','UNDER REVIEW','PLANNED','LIVE','DEFERRED','DECLINED')),
 moderation text not null default 'PENDING' check(moderation in ('PENDING','VISIBLE','HIDDEN','REMOVED')),
 created_at timestamptz not null, updated_at timestamptz not null,
 explanation text not null default '' check(char_length(explanation)<=500),
 revision bigint not null default 0 check(revision>=0), purge_at timestamptz,
 first_published_at timestamptz, declined_at timestamptz, withdrawn_at timestamptz, privacy_deadline timestamptz,
 check(withdrawn_at is null or (moderation in ('HIDDEN','REMOVED') and not attribution)),
 check ((moderation='REMOVED' and body is null and owner_id is null and not attribution)
   or (moderation<>'REMOVED' and owner_id is not null and body is not null and char_length(btrim(body)) between 1 and 250))
);
create index evolve_ideas_page on private.evolve_ideas(created_at desc,id desc);
create index evolve_ideas_owner on private.evolve_ideas(owner_id);
create index evolve_ideas_cleanup on private.evolve_ideas(purge_at) where purge_at is not null;
create table private.evolve_support (
 idea_id uuid not null references private.evolve_ideas(id) on delete cascade,
 atom_id uuid not null references public.atoms(id) on delete cascade,
 created_at timestamptz not null,
 primary key(idea_id,atom_id)
);
create index evolve_support_owner on private.evolve_support(atom_id);
create table private.evolve_history (
 id uuid primary key default gen_random_uuid(), idea_id uuid not null references private.evolve_ideas(id) on delete cascade,
 administrator_id uuid references auth.users(id) on delete set null,
 previous_status text not null, new_status text not null,
 previous_moderation text not null, new_moderation text not null,
 reason text not null check(reason in ('STATUS_REVIEW','HIDE','REMOVE','WITHDRAW','PUBLISH_HISTORY','REMOVE_HISTORY')), created_at timestamptz not null
);
alter table private.evolve_history alter column idea_id drop not null;
-- Independent, manually sanitized product facts. No suggestion, author or admin linkage.
create table private.evolve_development_history (
 id uuid primary key default gen_random_uuid(),
 improvement text not null check(char_length(btrim(improvement)) between 1 and 250),
 completed_on date not null,
 explanation text not null check(char_length(btrim(explanation)) between 1 and 500),
 created_at timestamptz not null
);
create index evolve_development_page on private.evolve_development_history(created_at desc,id desc);
create index evolve_history_page on private.evolve_history(idea_id,created_at,id);
create index evolve_history_cleanup on private.evolve_history(created_at,id);
alter table private.evolve_settings enable row level security;
alter table private.evolve_accounts enable row level security;
alter table private.evolve_ideas enable row level security;
alter table private.evolve_support enable row level security;
alter table private.evolve_history enable row level security;
alter table private.evolve_development_history enable row level security;
revoke all on private.evolve_development_history from public,anon,authenticated;
revoke all on private.evolve_settings,private.evolve_accounts,private.evolve_ideas,private.evolve_support,private.evolve_history from public,anon,authenticated;

create function private.evolve_now() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
create function private.evolve_lock() returns void language plpgsql set search_path='' as $$
begin perform private.lifecycle_lock(); perform pg_advisory_xact_lock(190001); end $$;

-- Remove content and all attribution immediately; retain only redacted decisions for 30 days.
create function private.evolve_remove(p_id uuid) returns void language plpgsql set search_path='' as $$
begin
 delete from private.evolve_support where idea_id=p_id;
 update private.evolve_history set administrator_id=null,idea_id=null where idea_id=p_id;
 update private.evolve_ideas set body=null,owner_id=null,attribution=false,explanation='',moderation='REMOVED',
   revision=revision+1,updated_at=private.evolve_now(),purge_at=private.evolve_now()+interval '30 days' where id=p_id;
end $$;

create function private.evolve_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if new.status=old.status then return new; end if;
 perform private.evolve_lock();
 if new.status::text in ('DORMANT','DEACTIVATED','DELETED') then
   delete from private.evolve_support where atom_id=new.id;
   -- Invalidate all outstanding client mutation revisions; cooldown remains for reactivation.
   update private.evolve_accounts set revision=revision+1 where atom_id=new.id;
   if new.status::text='DELETED' then
     for item in select id from private.evolve_ideas where owner_id=new.id loop perform private.evolve_remove(item.id); end loop;
     update private.evolve_history set administrator_id=null where administrator_id in
       (select auth_user_id from private.atom_identities where atom_id=new.id);
     delete from private.evolve_accounts where atom_id=new.id;
   else
     update private.evolve_ideas set moderation='HIDDEN',attribution=false,updated_at=private.evolve_now(),revision=revision+1,
       privacy_deadline=least(privacy_deadline,private.evolve_now()+interval '30 days'),
       purge_at=least(purge_at,private.evolve_now()+interval '30 days') where owner_id=new.id and moderation<>'REMOVED';
     delete from private.evolve_support where idea_id in(select id from private.evolve_ideas where owner_id=new.id);
   end if;
 end if;
 return new;
end $$;
create trigger evolve_atom_lifecycle after update of status on public.atoms for each row execute function private.evolve_lifecycle();

create function private.evolve_projection(i private.evolve_ideas, viewer uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',i.id,'body',i.body,'status',i.status,'moderation',i.moderation,
 'createdAt',i.created_at,'updatedAt',i.updated_at,'explanation',i.explanation,'revision',i.revision,
 'mine',i.owner_id=viewer,'supported',exists(select 1 from private.evolve_support s where s.idea_id=i.id and s.atom_id=viewer),
 'acknowledgmentEligible',i.moderation='VISIBLE' and i.status='LIVE' and (i.owner_id=viewer or exists(select 1 from private.evolve_support s where s.idea_id=i.id and s.atom_id=viewer)),
 'withdrawnAt',i.withdrawn_at,
 'supportCount',(select count(*) from private.evolve_support s join public.atoms a on a.id=s.atom_id and a.status='ACTIVE' where s.idea_id=i.id),
 'authorAlias',case when i.attribution and i.withdrawn_at is null then (select nullif(btrim(display_name),'') from public.atoms where id=i.owner_id and status='ACTIVE') else null end)
$$;

-- Single bounded authenticated entry point. Error envelopes preserve request throttling.
-- Expected account revision prevents stale/replayed writes, including support after withdrawal.
create function public.evolve_request(p_operation text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; a private.evolve_accounts; i private.evolve_ideas; result jsonb; stamp timestamptz;
  expected bigint; cutoff timestamptz; cursor_id uuid; new_status text; new_moderation text; reason text; content text;
begin
 perform private.evolve_lock();
 actor:=private.account_owner();
 if not exists(select 1 from public.atoms where id=actor and status='ACTIVE') then raise exception 'Active owner required' using errcode='42501'; end if;
 if not (select enabled from private.evolve_settings where singleton) then raise exception 'EVOLVE disabled' using errcode='42501'; end if;
 stamp:=private.evolve_now();
 insert into private.evolve_accounts(atom_id,window_at) values(actor,stamp) on conflict do nothing;
 select * into a from private.evolve_accounts where atom_id=actor for update;
 if stamp>=a.window_at+interval '1 minute' then a.window_at:=stamp; a.requests:=0; end if;
 if a.requests>=30 then return jsonb_build_object('error','RATE_LIMIT'); end if;
 update private.evolve_accounts set window_at=a.window_at,requests=a.requests+1 where atom_id=actor;
 begin
 if p_operation is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>4096 then raise exception 'Invalid request'; end if;
 if p_operation in ('submit','support','withdraw') then
   expected:=(p_payload->>'revision')::bigint;
   if expected is distinct from a.revision then return jsonb_build_object('error','STALE_REVISION'); end if;
 end if;
 if p_operation='session' then
   result:=jsonb_build_object('isAdmin',exists(select 1 from private.signal_administrators where auth_user_id=auth.uid()));
 elsif p_operation='submit' then
   if (p_payload - array['body','attribution','revision'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   content:=btrim(p_payload->>'body');
   if content is null or char_length(content) not between 1 and 250 or content ~ '[[:cntrl:]]' then raise exception 'Invalid content'; end if;
   if a.last_submitted_at is not null and stamp<a.last_submitted_at+interval '24 hours' then return jsonb_build_object('error','SUBMISSION_COOLDOWN'); end if;
   if exists(select 1 from private.evolve_ideas where owner_id=actor and lower(body)=lower(content)) then return jsonb_build_object('error','DUPLICATE_IDEA'); end if;
   insert into private.evolve_ideas(owner_id,body,attribution,created_at,updated_at,purge_at)
     values(actor,content,coalesce((p_payload->>'attribution')::boolean,false),stamp,stamp,stamp+interval '30 days') returning * into i;
   update private.evolve_accounts set last_submitted_at=stamp,revision=revision+1 where atom_id=actor returning * into a;
   result:=private.evolve_projection(i,actor)||jsonb_build_object('acknowledgment','IDEA RECEIVED — awaiting administrator review.');
 elsif p_operation='withdraw' then
   if (p_payload-array['id','revision'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   select * into i from private.evolve_ideas where id=(p_payload->>'id')::uuid and owner_id=actor and moderation<>'REMOVED'
     and (purge_at is null or purge_at>stamp) for update;
   if not found then return jsonb_build_object('error','NOT_AVAILABLE'); end if;
   if i.withdrawn_at is null then
     delete from private.evolve_support where idea_id=i.id;
     insert into private.evolve_history(idea_id,previous_status,new_status,previous_moderation,new_moderation,reason,created_at)
       values(i.id,i.status,i.status,i.moderation,'HIDDEN','WITHDRAW',stamp);
     update private.evolve_ideas set withdrawn_at=stamp,moderation='HIDDEN',attribution=false,revision=revision+1,updated_at=stamp,
       purge_at=least(privacy_deadline,stamp+interval '90 days') where id=i.id returning * into i;
   end if;
   update private.evolve_accounts set revision=revision+1 where atom_id=actor returning * into a;
   result:=private.evolve_projection(i,actor);
 elsif p_operation='support' then
   if (p_payload-array['id','supported','revision'])<>'{}'::jsonb or jsonb_typeof(p_payload->'supported') is distinct from 'boolean' then raise exception 'Invalid support'; end if;
   select * into i from private.evolve_ideas where id=(p_payload->>'id')::uuid and moderation='VISIBLE' and withdrawn_at is null and (purge_at is null or purge_at>stamp) and
     exists(select 1 from public.atoms where id=owner_id and status='ACTIVE') for update;
   if not found then return jsonb_build_object('error','NOT_AVAILABLE'); end if;
   if (p_payload->>'supported')::boolean then
     insert into private.evolve_support values(i.id,actor,stamp) on conflict do nothing;
   else delete from private.evolve_support where idea_id=i.id and atom_id=actor; end if;
   update private.evolve_accounts set revision=revision+1 where atom_id=actor returning * into a;
   result:=private.evolve_projection(i,actor);
 elsif p_operation in ('list','admin_list') then
   if (p_payload-array['before','beforeId'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   if p_operation='admin_list' then perform private.require_signal_admin(); end if;
   cutoff:=coalesce((p_payload->>'before')::timestamptz,'infinity'::timestamptz);
   cursor_id:=coalesce((p_payload->>'beforeId')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
   select coalesce(jsonb_agg(q.item order by q.created_at desc,q.id desc),'[]') into result from (
     select x.id,x.created_at,private.evolve_projection(x,actor) || case when p_operation='admin_list' then
       jsonb_build_object('supportCount',(select count(*) from private.evolve_support s join public.atoms v on v.id=s.atom_id and v.status='ACTIVE' where s.idea_id=x.id)) else '{}'::jsonb end as item
     from private.evolve_ideas x where (x.created_at,x.id)<(cutoff,cursor_id) and (x.purge_at is null or x.purge_at>stamp) and
       (p_operation='admin_list' or (x.moderation<>'REMOVED' and (x.owner_id=actor or (x.moderation='VISIBLE' and exists(select 1 from public.atoms where id=x.owner_id and status='ACTIVE')))))
     order by x.created_at desc,x.id desc limit 25) q;
 elsif p_operation='moderate' then
   perform private.require_signal_admin();
   if (p_payload-array['id','revision','status','moderation','explanation'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   select * into i from private.evolve_ideas where id=(p_payload->>'id')::uuid for update;
   if not found or i.moderation='REMOVED' then return jsonb_build_object('error','NOT_AVAILABLE'); end if;
   if (p_payload->>'revision')::bigint is distinct from i.revision then return jsonb_build_object('error','STALE_REVISION'); end if;
   new_status:=p_payload->>'status'; new_moderation:=p_payload->>'moderation'; reason:=btrim(p_payload->>'explanation');
   if reason is null or char_length(reason) not between 1 and 500 or new_status is null or new_moderation not in ('VISIBLE','HIDDEN','REMOVED') or new_moderation is null then raise exception 'Decision explanation required'; end if;
   if new_moderation='VISIBLE' and not exists(select 1 from public.atoms where id=i.owner_id and status='ACTIVE') then return jsonb_build_object('error','NOT_AVAILABLE'); end if;
   if new_moderation<>'REMOVED' and (i.withdrawn_at is not null or i.purge_at<=stamp) then return jsonb_build_object('error','NOT_AVAILABLE'); end if;
   insert into private.evolve_history(idea_id,administrator_id,previous_status,new_status,previous_moderation,new_moderation,reason,created_at)
     values(i.id,auth.uid(),i.status,new_status,i.moderation,new_moderation,case new_moderation when 'HIDDEN' then 'HIDE' when 'REMOVED' then 'REMOVE' else 'STATUS_REVIEW' end,stamp);
   update private.evolve_ideas set status=new_status,moderation=case when new_moderation='REMOVED' then moderation else new_moderation end,
     explanation=reason,revision=revision+1,updated_at=stamp,
     first_published_at=case when new_moderation='VISIBLE' then coalesce(first_published_at,stamp) else first_published_at end,
     declined_at=case when new_status='DECLINED' then coalesce(declined_at,stamp) else declined_at end,
     privacy_deadline=case when new_moderation='HIDDEN' then least(privacy_deadline,stamp+interval '30 days') else privacy_deadline end,
     purge_at=least(privacy_deadline,case when new_moderation='VISIBLE' and new_status='DECLINED' then coalesce(declined_at,stamp)+interval '90 days'
       when new_moderation='VISIBLE' then null else least(purge_at,stamp+interval '30 days') end) where id=i.id;
   if new_moderation='REMOVED' then perform private.evolve_remove(i.id);
   elsif new_moderation='HIDDEN' then delete from private.evolve_support where idea_id=i.id; end if;
   result:=jsonb_build_object('id',i.id);
 elsif p_operation in ('publish_history','remove_history') then
   perform private.require_signal_admin();
   if p_operation='publish_history' then
     if (p_payload-array['improvement','completedOn','explanation','sanitized'])<>'{}'::jsonb or p_payload->'sanitized' is distinct from 'true'::jsonb then raise exception 'Sanitized product facts required'; end if;
     if (p_payload->>'completedOn')::date>stamp::date then raise exception 'Completion date is in the future'; end if;
     insert into private.evolve_development_history(improvement,completed_on,explanation,created_at)
       values(btrim(p_payload->>'improvement'),(p_payload->>'completedOn')::date,btrim(p_payload->>'explanation'),stamp) returning jsonb_build_object('id',id) into result;
   else
     if (p_payload-array['id'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
     delete from private.evolve_development_history where id=(p_payload->>'id')::uuid;
     result:=jsonb_build_object('removed',true);
   end if;
   insert into private.evolve_history(administrator_id,previous_status,new_status,previous_moderation,new_moderation,reason,created_at)
     values(auth.uid(),'LIVE','LIVE','VISIBLE','VISIBLE',upper(p_operation),stamp);
 elsif p_operation='development_history' then
   if (p_payload-array['before','beforeId'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') into result from (
     select id,improvement,completed_on,explanation,created_at from private.evolve_development_history
     where (created_at,id)<(coalesce((p_payload->>'before')::timestamptz,'infinity'),coalesce((p_payload->>'beforeId')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'))
     order by created_at desc,id desc limit 25) q;
 elsif p_operation='history' then
   perform private.require_signal_admin();
   if (p_payload-array['id','before','beforeId'])<>'{}'::jsonb then raise exception 'Unknown fields'; end if;
   select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') into result from (
     select h.id,h.previous_status,h.new_status,h.previous_moderation,h.new_moderation,h.reason,h.created_at from private.evolve_history h
     where (p_payload->>'id' is null or h.idea_id=(p_payload->>'id')::uuid) and h.created_at>stamp-interval '30 days' and (h.created_at,h.id)<(coalesce((p_payload->>'before')::timestamptz,'infinity'),coalesce((p_payload->>'beforeId')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'))
     order by h.created_at desc,h.id desc limit 25) q;
 else raise exception 'Unknown operation'; end if;
 return jsonb_build_object('data',result,'revision',a.revision,'nextSubmissionAt',a.last_submitted_at+interval '24 hours','serverTime',stamp);
 exception when data_exception or check_violation or not_null_violation or raise_exception then
   return jsonb_build_object('error','INVALID_REQUEST');
 when insufficient_privilege then return jsonb_build_object('error','FORBIDDEN');
 end;
end $$;

-- Operator-only until separately approved scheduling/integration. Maximum 100 idea records per invocation.
create function private.evolve_cleanup(p_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare item record; removed integer:=0;
begin
 perform private.evolve_lock();
 delete from private.evolve_history where id in(select id from private.evolve_history where created_at<=private.evolve_now()-interval '30 days' order by created_at,id limit greatest(1,least(coalesce(p_limit,100),100)));
 for item in select id,moderation from private.evolve_ideas where purge_at<=private.evolve_now() order by purge_at,id limit greatest(1,least(coalesce(p_limit,100),100)) for update loop
   if item.moderation='REMOVED' then delete from private.evolve_ideas where id=item.id;
   else perform private.evolve_remove(item.id); end if;
   removed:=removed+1;
 end loop;
 return removed;
end $$;
revoke all on function private.evolve_now(),private.evolve_lock(),private.evolve_remove(uuid),private.evolve_lifecycle(),private.evolve_projection(private.evolve_ideas,uuid),private.evolve_cleanup(integer) from public,anon,authenticated;
revoke all on function public.evolve_request(text,jsonb) from public,anon,authenticated;
grant execute on function public.evolve_request(text,jsonb) to authenticated;
commit;
