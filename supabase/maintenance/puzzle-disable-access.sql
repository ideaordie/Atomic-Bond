-- Emergency/acceptance shutdown: no participant, reservation, asset or gameplay writes.
begin;
select private.puzzle_lock();
update private.puzzle_access_settings
set public_enabled=false, controlled_enabled=false;
select public_enabled,controlled_enabled from private.puzzle_access_settings;
commit;
