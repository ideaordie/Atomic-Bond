-- Compatibility stage: no row rewrites, existing sends only.
begin;
create or replace function private.before_deletion_send_emotional_pulse(p_emotion public.emotion) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); p public.emotional_pulses; number text;
begin
 if p_emotion is null or p_emotion::text not in ('JOY','CALM','EXCITED','CURIOUS','SAD','ANXIOUS','ANGRY','AFRAID') then raise exception 'Select an approved Pulse state' using errcode='22023'; end if;
 insert into public.emotional_pulses(atom_id,emotion) values(owner,p_emotion)
 on conflict(atom_id) do update set id=gen_random_uuid(),emotion=excluded.emotion,created_at=excluded.created_at,expires_at=excluded.expires_at returning * into p;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner returning public_id::text into number;
 return jsonb_build_object('id',p.id,'atomId',number,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000);
end $$;
alter type public.emotion add value if not exists 'CONTENT';
alter type public.emotion add value if not exists 'FRUSTRATED';
alter type public.emotion add value if not exists 'ENERGIZED';
alter type public.emotion add value if not exists 'FOCUSED';
alter type public.emotion add value if not exists 'MOTIVATED';
alter type public.emotion add value if not exists 'WIRED';
alter type public.emotion add value if not exists 'TIRED';
alter type public.emotion add value if not exists 'DRAINED';
alter type public.emotion add value if not exists 'RESTLESS';
alter type public.emotion add value if not exists 'LAZY';
alter type public.emotion add value if not exists 'CHILLING';
alter type public.emotion add value if not exists 'HUNGRY';
alter type public.emotion add value if not exists 'CAFFEINATED';
alter type public.emotion add value if not exists 'TIPSY';
alter type public.emotion add value if not exists 'POOPED';
alter type public.emotion add value if not exists 'COZY';
alter type public.emotion add value if not exists 'HUNGOVER';
alter type public.emotion add value if not exists 'UNDER_THE_WEATHER';
commit;
