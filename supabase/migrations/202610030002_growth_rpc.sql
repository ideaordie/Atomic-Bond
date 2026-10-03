-- Approved pilot transport: seven fixed wrappers; underlying schema stays private.
-- service_role is broadly privileged. These grants do not narrow its credential.
begin;
create function public.growth_scan(p_after bigint,p_limit integer) returns table(public_id text,eligibility text)
language sql security definer set search_path='' as $$ select * from growth_jobs.scan(p_after,p_limit); $$;
alter function public.growth_scan(bigint,integer) owner to postgres;
revoke all on function public.growth_scan(bigint,integer) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_scan(bigint,integer) to service_role;

create function public.growth_evaluate(p_number bigint,p_persist boolean) returns jsonb
language sql security definer set search_path='' as $$ select growth_jobs.evaluate(p_number,p_persist); $$;
alter function public.growth_evaluate(bigint,boolean) owner to postgres;
revoke all on function public.growth_evaluate(bigint,boolean) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_evaluate(bigint,boolean) to service_role;

create function public.growth_reserve(p_number bigint) returns uuid
language sql security definer set search_path='' as $$ select growth_jobs.reserve(p_number); $$;
alter function public.growth_reserve(bigint) owner to postgres;
revoke all on function public.growth_reserve(bigint) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_reserve(bigint) to service_role;

create function public.growth_claim(p_job uuid) returns jsonb
language sql security definer set search_path='' as $$ select growth_jobs.claim(p_job); $$;
alter function public.growth_claim(uuid) owner to postgres;
revoke all on function public.growth_claim(uuid) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_claim(uuid) to service_role;

create function public.growth_authorize_send(p_job uuid,p_attempt uuid,p_hash text) returns boolean
language sql security definer set search_path='' as $$ select growth_jobs.authorize_send(p_job,p_attempt,p_hash); $$;
alter function public.growth_authorize_send(uuid,uuid,text) owner to postgres;
revoke all on function public.growth_authorize_send(uuid,uuid,text) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_authorize_send(uuid,uuid,text) to service_role;

create function public.growth_finish(p_job uuid,p_attempt uuid,p_accepted boolean) returns boolean
language sql security definer set search_path='' as $$ select growth_jobs.finish(p_job,p_attempt,p_accepted); $$;
alter function public.growth_finish(uuid,uuid,boolean) owner to postgres;
revoke all on function public.growth_finish(uuid,uuid,boolean) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_finish(uuid,uuid,boolean) to service_role;

create function public.growth_unsubscribe(p_token text) returns boolean
language sql security definer set search_path='' as $$ select growth_jobs.unsubscribe(p_token); $$;
alter function public.growth_unsubscribe(text) owner to postgres;
revoke all on function public.growth_unsubscribe(text) from public,anon,authenticated,atomic_bond_growth;
grant execute on function public.growth_unsubscribe(text) to service_role;
commit;
