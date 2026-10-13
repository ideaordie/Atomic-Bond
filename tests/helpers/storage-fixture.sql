-- Local test substitute for the Supabase-managed Storage schema. Never deploy.
create schema storage;
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create function storage.allow_only_operation(op text) returns boolean language sql stable
 as $$select current_setting('storage.operation',true)=op$$;
alter table storage.objects enable row level security;
