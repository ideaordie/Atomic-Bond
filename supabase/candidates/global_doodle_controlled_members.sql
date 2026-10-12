-- Explicitly approved controlled cohort only. Run after migration and verification.
-- No membership in signal_administrators is created or changed.
begin;
select private.lifecycle_lock();
select pg_advisory_xact_lock(120001);
do $$
declare n integer;
begin
 if (select public_access from private.doodle_settings) or not (select submissions_paused from private.doodle_settings)
 then raise exception 'Closed, paused rollout required'; end if;
 if exists(select 1 from private.doodle_rollout_members) then raise exception 'Membership already provisioned; inspect before renewal'; end if;
 select count(*) into n from public.atoms a join private.atom_identities i on i.atom_id=a.id join auth.users u on u.id=i.auth_user_id
 where a.public_id in (1,4) and a.status='ACTIVE' and u.email_confirmed_at is not null;
 if n<>2 then raise exception 'Approved owners must be active and verified'; end if;
 if not exists(select 1 from public.atoms a join private.atom_identities i on i.atom_id=a.id join private.signal_administrators s on s.auth_user_id=i.auth_user_id where a.public_id=1)
 then raise exception 'Expected existing administrator missing'; end if;
 insert into private.doodle_rollout_members(atom_id,expires_at)
 select id,clock_timestamp()+interval '24 hours' from public.atoms where public_id in (1,4);
end $$;
select count(*) controlled_members, min(expires_at) expires_at from private.doodle_rollout_members;
commit;
