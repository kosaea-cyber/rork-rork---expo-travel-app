-- PHASE S4 — Storage hardening policies for bucket: app-media

-- Assumptions:
-- - Bucket name is "app-media"
-- - Admin role is set on JWT claim: (auth.jwt() ->> 'role') = 'admin'
-- - Public should be able to read objects from app-media

alter table storage.objects enable row level security;

-- Clean up prior policies (safe if they don't exist)
drop policy if exists "app_media_public_read" on storage.objects;
drop policy if exists "app_media_admin_insert" on storage.objects;
drop policy if exists "app_media_admin_update" on storage.objects;
drop policy if exists "app_media_admin_delete" on storage.objects;

-- Public read access (anyone can select objects in app-media)
create policy "app_media_public_read"
  on storage.objects
  for select
  using (bucket_id = 'app-media');

-- Admin-only write access
create policy "app_media_admin_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'app-media'
    and (auth.jwt() ->> 'role') = 'admin'
  );

create policy "app_media_admin_update"
  on storage.objects
  for update
  using (
    bucket_id = 'app-media'
    and (auth.jwt() ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'app-media'
    and (auth.jwt() ->> 'role') = 'admin'
  );

create policy "app_media_admin_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'app-media'
    and (auth.jwt() ->> 'role') = 'admin'
  );
