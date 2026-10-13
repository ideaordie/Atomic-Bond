-- Approved Task #13.6: fail-closed launch boundary; no existing puzzle mutation.
begin;
create table private.puzzle_launch_settings (
 singleton boolean primary key default true check(singleton),
 first_puzzle uuid references private.puzzles(id)
);
insert into private.puzzle_launch_settings(singleton) values(true);
alter table private.puzzle_launch_settings enable row level security;
revoke all on private.puzzle_launch_settings from public,anon,authenticated,service_role,atomic_bond_growth;

create or replace function public.puzzle_request(p_operation text,p_puzzle uuid default null,p_request uuid default null,p_revision bigint default null,p_piece uuid default null,p_to integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; t timestamptz; launch_at timestamptz; selected uuid; next_start timestamptz; account private.puzzle_allowances;
begin
 perform private.puzzle_lock(); actor:=private.puzzle_owner(); t:=private.puzzle_now();
 if p_operation is null or p_operation not in ('read','reveal','cancel','place','move') then raise exception 'Invalid operation' using errcode='42501';end if;
 select q.starts_at into launch_at from private.puzzle_launch_settings s join private.puzzles q on q.id=s.first_puzzle where s.singleton;
 if p_puzzle is null then
  select id into selected from private.puzzles where starts_at>=launch_at and starts_at<=t and ends_at>t order by starts_at desc limit 1;
 else
  select id into selected from private.puzzles where id=p_puzzle and starts_at>=launch_at and starts_at<=t and ends_at+interval '30 days'>t;
 end if;
 if selected is not null then
  return private.puzzle_game_request(p_operation,selected,p_request,p_revision,p_piece,p_to);
 end if;
 -- Waiting and rejected requests retain the existing per-owner request ceiling.
 insert into private.puzzle_allowances(atom_id) values(actor) on conflict do nothing;
 select * into account from private.puzzle_allowances where atom_id=actor for update;
 if account.window_start+interval '1 minute'<=t then
  update private.puzzle_allowances set window_start=t,requests=1 where atom_id=actor;
 elsif account.requests>=120 then return jsonb_build_object('error','RATE_LIMITED');
 else update private.puzzle_allowances set requests=requests+1 where atom_id=actor;end if;
 if p_operation<>'read' or p_puzzle is not null then return jsonb_build_object('error','PUZZLE_UNAVAILABLE');end if;
 select min(starts_at) into next_start from private.puzzles where starts_at>=launch_at and starts_at>t;
 return jsonb_build_object('status','WAITING','serverTime',t,'nextStart',next_start,'firstCommunity',t<launch_at);
end $$;

-- Preserve the verified media implementation, adding an independent launch filter.
alter function public.puzzle_media_get(uuid,uuid) set schema private;
alter function private.puzzle_media_get(uuid,uuid) rename to puzzle_launch_media_get;
revoke all on function private.puzzle_launch_media_get(uuid,uuid) from public,anon,authenticated,service_role,atomic_bond_growth;
create function public.puzzle_media_get(p_puzzle uuid,p_piece uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowed boolean;begin
 perform private.puzzle_lock();perform private.puzzle_owner();
 select exists(select 1 from private.puzzle_launch_settings s join private.puzzles first on first.id=s.first_puzzle
  join private.puzzles q on q.id=p_puzzle and q.starts_at>=first.starts_at and q.starts_at<=private.puzzle_now()) into allowed;
 -- Passing NULL on denial still applies the existing media request throttle.
 return private.puzzle_launch_media_get(case when allowed then p_puzzle else null end,p_piece);
end $$;
revoke all on function public.puzzle_media_get(uuid,uuid) from public,anon,authenticated,service_role,atomic_bond_growth;
grant execute on function public.puzzle_media_get(uuid,uuid) to authenticated;
alter function public.puzzle_media_get(uuid,uuid) owner to postgres;
commit;
