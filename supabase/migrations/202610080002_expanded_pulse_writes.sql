-- Enable only after compatible application deployment. Preserve lifecycle wrapper/grants.
begin;
create or replace function private.before_deletion_send_emotional_pulse(p_emotion public.emotion) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); p public.emotional_pulses; number text;
begin
 if p_emotion is null or p_emotion::text not in ('JOY','EXCITED','CURIOUS','CALM','CONTENT','SAD','ANXIOUS','FRUSTRATED','ENERGIZED','FOCUSED','MOTIVATED','WIRED','TIRED','DRAINED','RESTLESS','LAZY','CHILLING','HUNGRY','CAFFEINATED','TIPSY','POOPED','COZY','HUNGOVER','UNDER_THE_WEATHER') then raise exception 'Select an approved Pulse state' using errcode='22023'; end if;
 insert into public.emotional_pulses(atom_id,emotion) values(owner,p_emotion)
 on conflict(atom_id) do update set id=gen_random_uuid(),emotion=excluded.emotion,created_at=excluded.created_at,expires_at=excluded.expires_at returning * into p;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner returning public_id::text into number;
 return jsonb_build_object('id',p.id,'atomId',number,'emotion',lower(p.emotion::text),'createdAt',extract(epoch from p.created_at)*1000,'expiresAt',extract(epoch from p.expires_at)*1000);
end $$;

commit;
