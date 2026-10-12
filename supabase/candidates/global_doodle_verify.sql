begin transaction read only;
do $$
declare n integer;
begin
 select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='private' and c.relkind='r' and c.relname like 'doodle%';
 if n<>9 then raise exception 'Unexpected Doodle table inventory'; end if;
 if exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='private' and c.relkind='r' and c.relname like 'doodle%' and
 (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('atomic_bond_growth',c.oid,'SELECT,INSERT,UPDATE,DELETE')))
 then raise exception 'Doodle table security mismatch'; end if;
 if exists(select 1 from pg_policies where schemaname='private' and tablename like 'doodle%') then raise exception 'Unexpected client policies'; end if;
 if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in ('private','public') and p.proname like '%doodle%' and
 (pg_get_userbyid(p.proowner)<>'postgres' or p.proconfig is null or not ('search_path=""'=any(p.proconfig))
 or has_function_privilege('anon',p.oid,'EXECUTE')
 or has_function_privilege('service_role',p.oid,'EXECUTE')
 or has_function_privilege('atomic_bond_growth',p.oid,'EXECUTE')
 or has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (s.nspname='public' and p.proname='doodle_request')))
 then raise exception 'Doodle function security mismatch'; end if;
 if not (select submissions_paused and not public_access from private.doodle_settings) then raise exception 'Rollout must be closed and paused'; end if;
end $$;
select 'passed' as security_assertions,
 (select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in ('private','public') and p.proname like '%doodle%') functions,
 (select count(*) from pg_trigger where tgname in ('doodle_lifecycle_cleanup','doodle_immutable') and tgenabled='O') enabled_triggers,
 (select count(*) from private.doodles) drawings,
 (select count(*) from private.doodle_rollout_members) controlled_members;
commit;
