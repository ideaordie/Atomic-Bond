-- READ ONLY, trusted operator after the approved Doodle rollout.
-- Aggregate operational status only; never select artwork or private identities.
begin read only;
select
 (select submissions_paused from private.doodle_settings) as submissions_paused,
 count(*) filter(where state='PUBLISHED' and expires_at>clock_timestamp()) as live,
 count(*) filter(where state='PUBLISHED' and expires_at<=clock_timestamp()) as awaiting_finalization,
 count(*) filter(where state='CANDIDATE' and purge_at>clock_timestamp()) as private_candidates,
 count(*) filter(where state='HALL') as hall,
 count(*) filter(where state in ('REMOVED','REJECTED','EXPIRED') and purge_at<=clock_timestamp()) as cleanup_backlog,
 min(purge_at) filter(where state in ('REMOVED','REJECTED','EXPIRED') and purge_at<=clock_timestamp()) as oldest_cleanup_due,
 min(expires_at) filter(where state='PUBLISHED' and expires_at<=clock_timestamp()) as oldest_unfinalized,
 (select min(created_at) from private.doodle_moderation) as oldest_moderation_record,
 (select count(*) from private.doodle_hall h join private.doodles d on d.id=h.doodle_id where d.state<>'HALL') as invalid_hall_slots
from private.doodles;
select j.jobname,j.schedule,j.active,r.status,r.start_time,r.end_time
from cron.job j left join lateral
 (select status,start_time,end_time from cron.job_run_details where jobid=j.jobid order by runid desc limit 5) r on true
where j.jobname='atomic-bond-doodle-cleanup';
rollback;
