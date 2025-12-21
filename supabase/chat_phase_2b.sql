-- PHASE 2B — Conversation metadata updates

-- 1) Add metadata + unread counters to conversations
alter table public.conversations
  add column if not exists last_message_preview text,
  add column if not exists last_sender_type text,
  add column if not exists unread_count_admin integer not null default 0,
  add column if not exists unread_count_user integer not null default 0;

alter table public.conversations
  add constraint conversations_last_sender_type_check
  check (last_sender_type is null or last_sender_type in ('user','admin','system','ai'));

-- 2) Trigger to keep conversations in sync when a message is inserted
create or replace function public._bump_conversation_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = now(),
    last_message_preview = left(coalesce(new.body, ''), 80),
    last_sender_type = new.sender_type,
    unread_count_admin = case when new.sender_type = 'admin' then unread_count_admin else unread_count_admin + 1 end,
    unread_count_user = case when new.sender_type = 'admin' then unread_count_user + 1 else unread_count_user end
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert_bump_conversation on public.messages;
create trigger messages_after_insert_bump_conversation
after insert on public.messages
for each row
execute function public._bump_conversation_on_message_insert();
