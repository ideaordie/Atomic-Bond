-- REVIEW ONLY: do not apply until hosted rollout is explicitly approved.
-- Prerequisite: 202610120001_global_doodle.sql applied by the approved migration owner.
-- Supabase pg_cron is available but NOT installed (read-only audit 2026-10-11).
begin;
create extension if not exists pg_cron;
select cron.schedule('atomic-bond-doodle-cleanup','*/5 * * * *', $job$
  set statement_timeout='30s';
  set lock_timeout='2s';
  select private.cleanup_doodles(500);
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details
    where jobid=(select jobid from cron.job where jobname='atomic-bond-doodle-cleanup')
      and end_time < now()-interval '7 days'
    order by runid limit 1000
  );
$job$);
commit;
