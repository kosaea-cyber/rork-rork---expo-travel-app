-- PHASE S3A — Chat Anti-Spam + Rate Limit (RLS)
-- Goal:
-- 1) Guests (anon) can READ public chat.
-- 2) Only authenticated users can send messages (no anon inserts).
-- 3) Private chat inserts only by owner; admin can insert to any.

-- NOTES:
-- - Adjust policy names if you already have different ones.
-- - If your tables are not in schema public, update accordingly.

-- Enable RLS (safe if already enabled)
alter table public.messages enable row level security;
alter table public.conversations enable row level security;

-- Drop common existing insert policies on messages (best-effort)
drop policy if exists messages_insert_anon on public.messages;
drop policy if exists messages_insert_authenticated on public.messages;
drop policy if exists messages_insert_public on public.messages;
drop policy if exists messages_insert_private on public.messages;
drop policy if exists messages_insert_user on public.messages;
drop policy if exists messages_insert_admin on public.messages;

-- READ rules (assumes you already have selects; keep minimal here)
-- Allow anyone (anon + auth) to read messages for public conversations.
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

-- Private messages readable only by owner or admin.
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
        c.customer_id = auth.uid()
        or (auth.jwt() ->> 'role') = 'admin'
      )
  )
);

-- INSERT rules
-- Public messages: authenticated users only.
drop policy if exists messages_insert_public_auth on public.messages;
create policy messages_insert_public_auth
on public.messages
for insert
to authenticated
with check (
  sender_type = 'user'
  and sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'public'
  )
);

-- Private messages: authenticated owner only.
drop policy if exists messages_insert_private_owner on public.messages;
create policy messages_insert_private_owner
on public.messages
for insert
to authenticated
with check (
  sender_type = 'user'
  and sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = public.messages.conversation_id
      and c.type = 'private'
      and c.customer_id = auth.uid()
  )
);

-- Admin can insert admin messages anywhere.
drop policy if exists messages_insert_admin_any on public.messages;
create policy messages_insert_admin_any
on public.messages
for insert
to authenticated
with check (
  sender_type = 'admin'
  and sender_id = auth.uid()
  and (auth.jwt() ->> 'role') = 'admin'
);

-- Optional: allow system/ai inserts only to admin/service role via bypass (edge function uses service role, bypasses RLS)
-- If you insert system messages from client, you'll need a policy for it; recommended is ONLY via service role.
