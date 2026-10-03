-- Preserve historical values; provenance cannot reconstruct historical consent.
begin;
alter table private.notification_preferences
 add column growth_preference_source text not null default 'legacy_unknown'
 check (growth_preference_source in ('legacy_unknown','unset','activation_default','owner_choice','unsubscribe'));
-- Only rows created after this migration start unset.
alter table private.notification_preferences alter column growth_preference_source set default 'unset';

create function private.initialize_growth_preference() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.public_id is null and new.public_id is not null and new.status='ACTIVE' then
  update private.notification_preferences
  set growth_digest='weekly',growth_preference_source='activation_default',updated_at=now()
  where atom_id=new.id and growth_preference_source='unset';
 end if;
 return new;
end $$;
revoke all on function private.initialize_growth_preference() from public,anon,authenticated;
create trigger initialize_growth_preference after update on public.atoms
 for each row execute function private.initialize_growth_preference();

-- This owner-only RPC is an explicit preference operation, never a profile save.
create or replace function public.update_notification_preferences(p_growth_digest text,p_pulse_notifications boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom();
begin
 update private.notification_preferences set growth_digest=p_growth_digest,
 growth_preference_source='owner_choice',pulse_notifications=p_pulse_notifications,updated_at=now()
 where atom_id=owner;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner;
end $$;

-- Internal primitive only. A future purpose-scoped token validator must resolve
-- the target before calling this; no public UUID-based unsubscribe capability.
create function private.unsubscribe_growth(p_atom_id uuid) returns void
language sql security definer set search_path = '' as $$
 update private.notification_preferences set growth_digest='disabled',
 growth_preference_source='unsubscribe',updated_at=now() where atom_id=p_atom_id;
$$;
revoke all on function private.unsubscribe_growth(uuid) from public,anon,authenticated;
commit;
