-- One-time operator activation explicitly approved 2026-10-12.
-- Product owner chose public activation before remaining controlled live checks.
-- No credentials, ownership, grants, account state or artwork are changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select private.doodle_lock();
do $$
begin
 if (select count(*) from private.doodle_settings)<>1
 or not exists(select 1 from private.doodle_settings where not public_access and submissions_paused and threshold=5)
 then raise exception 'Expected closed paused starting state required'; end if;
 if not exists(select 1 from cron.job j join cron.job_run_details r on r.jobid=j.jobid
 where j.jobname='atomic-bond-doodle-cleanup' and j.active and j.schedule='*/5 * * * *'
 and r.status='succeeded' and r.end_time>clock_timestamp()-interval '15 minutes')
 then raise exception 'Recent successful cleanup required'; end if;
 if not exists(select 1 from private.signal_administrators s join private.atom_identities i on i.auth_user_id=s.auth_user_id
 join public.atoms a on a.id=i.atom_id join auth.users u on u.id=i.auth_user_id
 where a.public_id=1 and a.status='ACTIVE' and u.email_confirmed_at is not null)
 then raise exception 'Existing verified active administrator required'; end if;
 update private.doodle_settings set public_access=true,submissions_paused=false;
end $$;
select public_access,submissions_paused,threshold from private.doodle_settings;
commit;
