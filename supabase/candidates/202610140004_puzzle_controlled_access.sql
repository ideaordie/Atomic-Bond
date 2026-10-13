-- Controlled rollout boundary. No membership is provisioned by this migration.
begin;
create table private.puzzle_access_settings (
 singleton boolean primary key default true check(singleton),
 public_enabled boolean not null default false,
 controlled_enabled boolean not null default false
);
insert into private.puzzle_access_settings default values;
create table private.puzzle_test_members (
 atom_id uuid primary key references public.atoms(id) on delete cascade,
 expires_at timestamptz not null check(isfinite(expires_at))
);
alter table private.puzzle_access_settings enable row level security;
alter table private.puzzle_test_members enable row level security;
revoke all on private.puzzle_access_settings,private.puzzle_test_members
 from public,anon,authenticated,service_role,atomic_bond_growth;
-- Every gameplay operation and authenticated Storage read reaches this helper.
-- Membership grants neither ownership nor administrator authority.
create or replace function private.puzzle_owner() returns uuid
 language plpgsql volatile security definer set search_path='' as $$
declare a uuid;
begin
 a:=private.account_owner();
 if not exists(select 1 from public.atoms where id=a and status='ACTIVE') then
  raise exception 'Active owner required' using errcode='42501';
 end if;
 if not exists(select 1 from private.puzzle_access_settings s where
  s.public_enabled or (s.controlled_enabled and exists(
   select 1 from private.puzzle_test_members m
   where m.atom_id=a and m.expires_at>private.puzzle_now()))) then
  raise exception 'Puzzle unavailable' using errcode='42501';
 end if;
 return a;
end $$;
alter function private.puzzle_owner() owner to postgres;
revoke all on function private.puzzle_owner() from public,anon,authenticated,service_role,atomic_bond_growth;
commit;
