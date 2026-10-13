-- Task #13.1 only: approved disposable Atoms #4 and #5, 24-hour access.
-- No administrator membership or account state is changed.
begin;
select private.lifecycle_lock();
select pg_advisory_xact_lock(130001);
do $$ begin
 if (select public_enabled from private.puzzle_access_settings) then
  raise exception 'Public puzzle participation must remain disabled';
 end if;
 if (select count(*) from public.atoms a join private.atom_identities i on i.atom_id=a.id
  join auth.users u on u.id=i.auth_user_id
  where a.public_id in (4,5) and a.status='ACTIVE' and i.email_verified_at is not null
  and u.email_confirmed_at is not null)<>2 then raise exception 'Approved verified test owners unavailable'; end if;
 if exists(select 1 from private.puzzle_test_members m join public.atoms a on a.id=m.atom_id where a.public_id not in (4,5)) then
  raise exception 'Unexpected controlled membership';
 end if;
end $$;
insert into private.puzzle_test_members(atom_id,expires_at)
 select id,clock_timestamp()+interval '24 hours' from public.atoms where public_id in (4,5)
 on conflict(atom_id) do nothing;
update private.puzzle_access_settings set controlled_enabled=true where not public_enabled;
commit;
