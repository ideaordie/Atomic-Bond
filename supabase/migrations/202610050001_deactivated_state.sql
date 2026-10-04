-- Commit the enum value before functions/constraints use it in the next migration.
-- No participant rows are changed.
alter type public.atom_status add value if not exists 'DEACTIVATED';
