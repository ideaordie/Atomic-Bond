-- ONE-TIME PRE-BETA MAINTENANCE EXCEPTION. Not a schema migration or RPC.
-- Execute only after the documented external maintenance/recovery gates pass.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select private.lifecycle_lock();
lock table public.atoms in access exclusive mode;
lock table private.atom_numbers, private.atom_identities, private.notification_preferences,
 public.bonds, public.bond_invitations, public.emotional_pulses,
 private.growth_state, private.growth_deliveries, private.signal_administrators,
 private.network_signals, private.account_deletions, private.account_lifecycle,
 private.invitation_secrets, public.locations in share mode;
do $$
declare
 source_id constant uuid := '7475dc94-9eea-47d2-b875-69ee22b36840';
 old_id constant uuid := '6ae6eac9-b633-435f-8762-f27b4c3bc7fe';
 source_before jsonb; old_before jsonb; atoms_before jsonb;
 protected_before jsonb := '{}'::jsonb; protected_after jsonb := '{}'::jsonb;
 seq_before jsonb; topology_before jsonb; tbl text; value jsonb;
begin
 if not exists(select 1 from public.atoms where id=source_id and public_id=3 and status='ACTIVE')
 then raise exception 'Guard: source changed'; end if;
 if not exists(select 1 from public.atoms a join public.locations l on l.id=a.location_id
 where a.id=old_id and a.public_id=1 and a.status='DELETED' and a.display_name is null and a.x_handle is null
 and a.created_at='2026-09-27T03:33:43.808194Z' and l.display_name='Verification only' and l.canonical_key like 'verification-%')
 then raise exception 'Guard: destination changed'; end if;
 if (select count(*) from private.atom_identities i join auth.users u on u.id=i.auth_user_id
 join private.signal_administrators s on s.auth_user_id=u.id where i.atom_id=source_id
 and i.email_verified_at is not null and u.email_confirmed_at is not null
 and i.normalized_email=private.normalize_email(u.email))<>1
 then raise exception 'Guard: verified administrator changed'; end if;
 if (select count(*) from public.bonds where status='CONFIRMED' and source_id in(atom_a_id,atom_b_id))<>5
 or (select array_agg(z.public_id order by z.public_id) from public.bonds b join public.atoms z
 on z.id=case when b.atom_a_id=source_id then b.atom_b_id else b.atom_a_id end
 where source_id in(b.atom_a_id,b.atom_b_id) and b.status='CONFIRMED')<>array[4,6,8,9,13]::bigint[]
 then raise exception 'Guard: source Bonds changed'; end if;
 if exists(select 1 from private.atom_identities where atom_id=old_id)
 or exists(select 1 from private.notification_preferences where atom_id=old_id)
 or exists(select 1 from private.growth_state where atom_id=old_id)
 or exists(select 1 from private.growth_deliveries where atom_id=old_id)
 or exists(select 1 from public.bonds where old_id in(atom_a_id,atom_b_id))
 or exists(select 1 from public.bond_invitations where old_id in(creator_atom_id,accepted_by_atom_id))
 or exists(select 1 from public.emotional_pulses where atom_id=old_id)
 or exists(select 1 from private.account_deletions where atom_id=old_id)
 or exists(select 1 from private.account_lifecycle where atom_id=old_id)
 then raise exception 'Guard: destination dependencies'; end if;
 if exists(select 1 from private.growth_deliveries where status='attempted' and lease_until>clock_timestamp())
 or exists(select 1 from private.growth_deliveries where atom_id=source_id and status<>'accepted')
 then raise exception 'Guard: delivery requires reconciliation'; end if;
 if not exists(select 1 from private.notification_preferences where atom_id=source_id and growth_digest='weekly' and growth_preference_source='owner_choice')
 or not exists(select 1 from private.growth_state where atom_id=source_id and baseline='{"connectedAtoms":5,"directBonds":2,"regions":1,"countries":1}'::jsonb and sent_period='2026-09-28')
 then raise exception 'Guard: preference or baseline changed'; end if;
 if (select count(*) from private.atom_numbers where number in(1,2,3))<>3
 or not exists(select 1 from pg_trigger where tgrelid='public.atoms'::regclass and tgname='protect_atom' and tgenabled='O')
 then raise exception 'Guard: ledger or protection changed'; end if;
 select to_jsonb(a) into source_before from public.atoms a where id=source_id;
 select to_jsonb(a) into old_before from public.atoms a where id=old_id;
 select jsonb_agg(to_jsonb(a) order by id) into atoms_before from public.atoms a where id not in(source_id,old_id);
 select jsonb_build_object('last_value',last_value,'is_called',is_called) into seq_before from private.atom_number_seq;
 select jsonb_agg(id order by id) into topology_before from private.reachable(source_id);
 foreach tbl in array array['private.atom_numbers','private.atom_identities','private.notification_preferences','public.bonds','public.bond_invitations','public.emotional_pulses','private.growth_state','private.growth_deliveries','private.signal_administrators','private.network_signals','private.account_deletions','private.account_lifecycle','private.invitation_secrets','public.locations'] loop
   execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %s t',tbl) into value;
   protected_before := protected_before || jsonb_build_object(tbl,value);
 end loop;
 alter table public.atoms disable trigger protect_atom;
 update public.atoms set public_id=null,location_id=null where id=old_id;
 update public.atoms set public_id=1 where id=source_id;
 alter table public.atoms enable trigger protect_atom;
 if (select to_jsonb(a)-'public_id' from public.atoms a where id=source_id) is distinct from (source_before-'public_id')
 or (select public_id from public.atoms where id=source_id)<>1
 or (select to_jsonb(a)-'public_id'-'location_id' from public.atoms a where id=old_id) is distinct from (old_before-'public_id'-'location_id')
 or exists(select 1 from public.atoms where public_id=3)
 or (select jsonb_agg(to_jsonb(a) order by id) from public.atoms a where id not in(source_id,old_id)) is distinct from atoms_before
 or (select jsonb_build_object('last_value',last_value,'is_called',is_called) from private.atom_number_seq) is distinct from seq_before
 or (select jsonb_agg(id order by id) from private.reachable(source_id)) is distinct from topology_before
 or not exists(select 1 from pg_trigger where tgrelid='public.atoms'::regclass and tgname='protect_atom' and tgenabled='O')
 then raise exception 'Postcondition: Atom/topology/sequence/protection mismatch'; end if;
 foreach tbl in array array['private.atom_numbers','private.atom_identities','private.notification_preferences','public.bonds','public.bond_invitations','public.emotional_pulses','private.growth_state','private.growth_deliveries','private.signal_administrators','private.network_signals','private.account_deletions','private.account_lifecycle','private.invitation_secrets','public.locations'] loop
   execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %s t',tbl) into value;
   protected_after := protected_after || jsonb_build_object(tbl,value);
 end loop;
 if protected_before is distinct from protected_after then raise exception 'Postcondition: related state changed'; end if;
end $$;
commit;

