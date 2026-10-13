-- Task 12.4 approved seven-day publication lifetime.
-- Replaces only new-submission lifetime. Existing rows, grants and schedules unchanged.
begin;
create or replace function public.submit_doodle(p_request uuid,p_drawing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; t timestamptz; packed bytea; existing private.doodles; result uuid; account private.doodle_accounts; fingerprint text;
begin
 perform private.doodle_lock(); owner:=private.doodle_owner(); t:=private.doodle_now();
 if p_request is null or octet_length(p_drawing::text)>65536 then raise exception 'Invalid submission'; end if;
 packed:=private.doodle_pack(p_drawing);
 fingerprint:=encode(sha256(decode(p_drawing->>'bitmap','base64')||coalesce(packed,''::bytea)),'hex');
 t:=private.doodle_now();
 select * into account from private.doodle_accounts where atom_id=owner;
 if account.last_request=p_request then
  if account.last_hash<>fingerprint then raise exception 'Idempotency conflict'; end if;
  return account.last_result;
 end if;
 select * into existing from private.doodles where atom_id=owner and request_id=p_request;
 if found then
  if existing.bitmap<>decode(p_drawing->>'bitmap','base64') or existing.replay is distinct from packed then raise exception 'Idempotency conflict'; end if;
  return existing.id;
 end if;
 insert into private.doodle_accounts(atom_id) values(owner) on conflict do nothing;
 if exists(select 1 from private.doodle_accounts where atom_id=owner and (restricted or last_submitted>t-interval '60 minutes')) then raise exception 'Submission unavailable: restriction or cooldown'; end if;
 if (select submissions_paused from private.doodle_settings) then raise exception 'Submissions paused'; end if;

 insert into private.doodles(atom_id,request_id,bitmap,replay,state,submitted_at,published_at,expires_at,purge_at,threshold)
 values(owner,p_request,decode(p_drawing->>'bitmap','base64'),packed,'PUBLISHED',t,t,t+interval '168 hours',t+interval '168 hours',(select threshold from private.doodle_settings)) returning id into result;
 update private.doodle_accounts set last_submitted=t,last_request=p_request,last_result=result,last_hash=fingerprint where atom_id=owner;
 return result;
end $$;
commit;
