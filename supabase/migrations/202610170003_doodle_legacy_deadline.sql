-- Task #12.5: explicitly approved extension of ONE audited legacy drawing.
-- New submissions already use 168 hours. No finalized/removed content is reopened.
begin;
select private.doodle_lock();
do $$
declare target uuid:='f7b8cb40-17b3-4d23-8773-2d440901ce2c'; before_row jsonb; after_row jsonb; before_votes jsonb;
begin
 select to_jsonb(d) into before_row from private.doodles d join public.atoms a on a.id=d.atom_id
 left join private.doodle_accounts ac on ac.atom_id=a.id
 where d.id=target and d.state='PUBLISHED' and d.final_score is null and d.bitmap is not null
 and a.status='ACTIVE' and not coalesce(ac.restricted,false)
 and d.published_at='2026-10-12 23:47:12.649486Z' and d.expires_at=d.published_at+interval '24 hours'
 and d.published_at+interval '168 hours'>private.doodle_now();
 if before_row is null then raise exception 'Approved legacy drawing is no longer eligible';end if;
 select jsonb_agg(to_jsonb(v) order by voter_atom_id) into before_votes from private.doodle_appreciations v where doodle_id=target;
 update private.doodles set expires_at=published_at+interval '168 hours',purge_at=published_at+interval '168 hours' where id=target;
 select to_jsonb(d) into after_row from private.doodles d where id=target;
 if before_row-'expires_at'-'purge_at' is distinct from after_row-'expires_at'-'purge_at' or
 before_votes is distinct from (select jsonb_agg(to_jsonb(v) order by voter_atom_id) from private.doodle_appreciations v where doodle_id=target) then raise exception 'Protected drawing state changed';end if;
end $$;
commit;
