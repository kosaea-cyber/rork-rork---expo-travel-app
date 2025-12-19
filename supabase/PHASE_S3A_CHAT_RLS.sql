-- PHASE S3A — Chat RLS (supports public_guest + public_auth + private_user + admin)
-- Goals:
-- 1) Guests (anon) can READ public chat.
-- 2) Guests (anon) can SEND to public chat, but ONLY with sender_id IS NULL.
-- 3) Auth users can SEND to public/private with sender_id = auth.uid().
-- 4) Private chat readable/sendable only by owner; admin can read/send anywhere.
-- 5) Avoid UUID errors by guarding auth.uid() usage.

alter table public.messages enable row level security;
alter table public.conversations enable row level security;

-- -------------------------
-- SELECT policies
-- -------------------------

drop policy if exists messages_select_public on public.messages;
create policy messages_select_public
on public.messages
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'public'
  )
);

drop policy if exists messages_select_private_owner_or_admin on public.messages;
create policy messages_select_private_owner_or_admin
on public.messages
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'private'
      and (
        (auth.uid() is not null and c.customer_id = auth.uid())
        or (auth.jwt() ->> 'role') = 'admin'
      )
  )
);

-- (Optional) allow admin to read everything (public+private) even without joining conversation table logic
-- Not needed if above already covers admin via jwt role.

-- -------------------------
-- INSERT policies
-- -------------------------

-- 1) Guest inserts into PUBLIC conversations only
drop policy if exists messages_insert_public_guest on public.messages;
create policy messages_insert_public_guest
on public.messages
for insert
to anon
with check (
  sender_type = 'user'
  and sender_id is null
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'public'
  )
);

-- 2) Auth user inserts into PUBLIC conversations
drop policy if exists messages_insert_public_auth on public.messages;
create policy messages_insert_public_auth
on public.messages
for insert
to authenticated
with check (
  sender_type = 'user'
  and auth.uid() is not null
  and sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'public'
  )
);

-- 3) Private messages: authenticated owner only
drop policy if exists messages_insert_private_owner on public.messages;
create policy messages_insert_private_owner
on public.messages
for insert
to authenticated
with check (
  sender_type = 'user'
  and auth.uid() is not null
  and sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'private'
      and c.customer_id = auth.uid()
  )
);

-- 4) Admin can insert admin messages anywhere
drop policy if exists messages_insert_admin_any on public.messages;
create policy messages_insert_admin_any
on public.messages
for insert
to authenticated
with check (
  sender_type = 'admin'
  and auth.uid() is not null
  and sender_id = auth.uid()
  and (auth.jwt() ->> 'role') = 'admin'
);

-- -------------------------
-- UPDATE policies (optional but recommended)
-- If your app updates unread counters from client, you need conversation update policies.
-- If you do updates only via service role (edge), you can omit these.
-- -------------------------

-- Allow authenticated owner to update unread_count_user on their private conversations
drop policy if exists conversations_update_private_owner on public.conversations;
create policy conversations_update_private_owner
on public.conversations
for update
to authenticated
using (
  type = 'private'
  and auth.uid() is not null
  and customer_id = auth.uid()
)
with check (
  type = 'private'
  and auth.uid() is not null
  and customer_id = auth.uid()
);

-- Allow admin to update any conversation
drop policy if exists conversations_update_admin_any on public.conversations;
create policy conversations_update_admin_any
on public.conversations
for update
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');
