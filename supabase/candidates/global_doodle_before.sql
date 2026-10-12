-- Read-only comparison evidence, not a recovery backup. No identities serialized.
begin transaction read only;
select jsonb_build_object(
 'atoms',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.atoms t),
 'bonds',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.bonds t),
 'identities',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by atom_id)::text,'')) from private.atom_identities t),
 'preferences',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by atom_id)::text,'')) from private.notification_preferences t),
 'growthState',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by atom_id)::text,'')) from private.growth_state t),
 'deliveries',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from private.growth_deliveries t),
 'pulses',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.emotional_pulses t),
 'invitations',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.bond_invitations t),
 'admin',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by auth_user_id)::text,'')) from private.signal_administrators t),
 'signals',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from private.network_signals t),
 'ledger',(select md5(coalesce(jsonb_agg(number order by number)::text,'')) from private.atom_numbers),
 'sequence',(select jsonb_build_object('lastValue',last_value,'isCalled',is_called) from private.atom_number_seq),
 'atomCount',(select count(*) from public.atoms),
 'bondCount',(select count(*) from public.bonds),
 'controlledAtomActive',exists(select 1 from public.atoms a join private.atom_identities i on i.atom_id=a.id join auth.users u on u.id=i.auth_user_id where a.public_id=4 and a.status='ACTIVE' and u.email_confirmed_at is not null)
) snapshot;
commit;
