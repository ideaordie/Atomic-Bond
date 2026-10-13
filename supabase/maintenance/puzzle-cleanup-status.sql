-- Operator-only monitoring. No participant identity or raw error message.
begin read only;
select h.last_attempt,h.last_success,h.last_failure,h.last_error_code,h.last_ok,h.counts,h.successful_runs,h.failed_runs,
 case when h.last_success is null then 'NEVER_SUCCEEDED' when not h.last_ok then 'FAILED' when h.last_success<clock_timestamp()-interval '15 minutes' then 'STALE' else 'HEALTHY' end health,
 (select count(*) from private.puzzle_cleanup_queue) legacy_storage_batches_waiting
from private.puzzle_cleanup_health h;
select j.jobname,j.schedule,j.active,r.status,r.start_time,r.end_time
from cron.job j left join lateral(select status,start_time,end_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1) r on true
where j.jobname in ('atomic-bond-puzzle-cleanup','atomic-bond-doodle-cleanup');
commit;
