import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { normalizeSupabaseError } from '@/lib/utils/supabaseError';

export type ConversationType = 'private' | 'public';
export type MessageSenderType = 'user' | 'admin' | 'system' | 'ai';

type RealtimeHealth = 'idle' | 'connecting' | 'subscribed' | 'polling' | 'error' | 'closed';

export interface Conversation {
  id: string;
  type: ConversationType;
  customerId: string | null;
  guestId: string | null;
  guestStage: number;
  guestName: string | null;
  guestPhone: string | null;
  preferredLanguage: string | null;

  createdAt: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastSenderType: MessageSenderType | null;
  unreadCountAdmin: number;
  unreadCountUser: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  body: string;
  createdAt: string;
}

type ConversationRow = {
  id: string;
  type: ConversationType;
  customer_id: string | null;
  guest_id: string | null;
  guest_stage: number | null;
  guest_name: string | null;
  guest_phone: string | null;
  preferred_language: string | null;

  created_at: string | null;
  last_message_at: string | null;
  last_message_preview?: string | null;
  last_sender_type?: MessageSenderType | null;
  unread_count_admin?: number | null;
  unread_count_user?: number | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  sender_id: string | null;
  body: string;
  created_at: string | null;
};

function safeErrorDetails(error: unknown): Record<string, unknown> {
  if (!error) return { error: null };

  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    name?: string;
  };

  return {
    message: e?.message ?? String(error),
    code: e?.code ?? null,
    details: e?.details ?? null,
    hint: e?.hint ?? null,
    status: e?.status ?? null,
    name: e?.name ?? null,
  };
}

function mapConversationRow(row: ConversationRow): Conversation {
  const nowIso = new Date().toISOString();

  return {
    id: row.id,
    type: row.type,
    customerId: row.customer_id ?? null,
    guestId: row.guest_id ?? null,
    guestStage: row.guest_stage ?? 0,
    guestName: row.guest_name ?? null,
    guestPhone: row.guest_phone ?? null,
    preferredLanguage: row.preferred_language ?? null,

    createdAt: row.created_at ?? nowIso,
    lastMessageAt: row.last_message_at ?? row.created_at ?? nowIso,
    lastMessagePreview: row.last_message_preview ?? null,
    lastSenderType: row.last_sender_type ?? null,
    unreadCountAdmin: row.unread_count_admin ?? 0,
    unreadCountUser: row.unread_count_user ?? 0,
  };
}

function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id ?? null,
    body: row.body,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function upsertConversation(list: Conversation[], next: Conversation): Conversation[] {
  const idx = list.findIndex((c) => c.id === next.id);
  if (idx === -1) return [next, ...list];
  const copy = [...list];
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

interface ChatState {
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  hasMoreByConversationId: Record<string, boolean>;
  realtimeHealthByConversationId: Record<string, RealtimeHealth>;
  realtimeErrorByConversationId: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;

  // ✅ preferredLanguage صار optional
  getOrCreateGuestConversation: (preferredLanguage?: string) => Promise<Conversation | null>;

  // ✅ للتوافق مع أي كود قديم كان يناديها
  getOrCreatePrivateConversation: (preferredLanguage?: string) => Promise<Conversation | null>;

  fetchMessages: (conversationId: string, limit: number, before?: string) => Promise<Message[]>;

  // ✅ senderType صار optional (ثالث باراميتر)
  sendMessage: (conversationId: string, body: string, senderType?: string) => Promise<Message | null>;

  subscribeToConversation: (conversationId: string) => () => void;
  markConversationReadForUser: (conversationId: string) => Promise<void>;

  // (admin)
  adminFetchConversations: (limit: number) => Promise<Conversation[]>;
  adminGetConversationById: (conversationId: string) => Promise<Conversation | null>;
}

export const useChatStore = create<ChatState>((set, get) => {
  const channelsByConversationId: Record<string, RealtimeChannel> = {};

  return {
    conversations: [],
    messagesByConversationId: {},
    hasMoreByConversationId: {},
    realtimeHealthByConversationId: {},
    realtimeErrorByConversationId: {},
    isLoading: false,
    error: null,

    getOrCreateGuestConversation: async (preferredLanguage?: string) => {
      const lang = (preferredLanguage ?? 'en').trim() || 'en';

      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] getOrCreateGuestConversation', { preferredLanguage: lang });

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[chatStore] auth.getSession error', safeErrorDetails(sessionError));
        }

        const accessToken = sessionData.session?.access_token ?? null;
        if (!accessToken) {
          set({ isLoading: false, error: 'not_authenticated' });
          return null;
        }

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        if (!baseUrl) {
          set({ isLoading: false, error: 'Missing Supabase URL' });
          return null;
        }

        const url = `${baseUrl.replace(/\/$/, '')}/functions/v1/chat-get-or-create-guest-conversation`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ preferredLanguage: lang }),
        });

        const json = (await res.json().catch(() => null)) as
          | { data?: Partial<ConversationRow> | null; error?: unknown }
          | null;

        if (!res.ok) {
          const msg = normalizeSupabaseError(
            json?.error ?? { status: res.status, message: json ?? res.statusText },
          );
          console.error('[chatStore] guest-conversation edge failed', {
            status: res.status,
            msg,
            raw: json,
          });
          set({ isLoading: false, error: msg });
          return null;
        }

        const row = (json?.data ?? null) as ConversationRow | null;
        if (!row?.id) {
          set({ isLoading: false, error: 'Failed to load guest conversation' });
          return null;
        }

        // ضمان القيم اللي ممكن ما ترجع
        const conv = mapConversationRow({
          ...row,
          type: (row.type ?? 'public') as ConversationType,
          created_at: row.created_at ?? new Date().toISOString(),
          last_message_at: row.last_message_at ?? row.created_at ?? new Date().toISOString(),
        });

        set((s) => ({
          conversations: upsertConversation(s.conversations, conv),
          isLoading: false,
        }));

        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] getOrCreateGuestConversation failed', details);
        set({
          isLoading: false,
          error: (details.message as string | null) ?? 'Failed to load guest chat',
        });
        return null;
      }
    },

    // ✅ wrapper للتوافق مع أي استدعاء قديم
    getOrCreatePrivateConversation: async (preferredLanguage?: string) => {
      console.warn('[chatStore] getOrCreatePrivateConversation: using guest conversation fallback');
      return await get().getOrCreateGuestConversation(preferredLanguage);
    },

    fetchMessages: async (conversationId, limit, before) => {
      const fetchInternal = async (opts: { setLoading: boolean }): Promise<Message[]> => {
        if (opts.setLoading) set({ isLoading: true, error: null });

        try {
          console.log('[chatStore] fetchMessages', { conversationId, limit, before: before ?? null });

          let q = supabase
            .from('messages')
            .select('id, conversation_id, sender_type, sender_id, body, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (before) q = q.lt('created_at', before);

          const { data, error } = await q;

          if (error) {
            const details = safeErrorDetails(error);
            console.error('[chatStore] fetchMessages select error', details);
            throw new Error((details.message as string | null) ?? 'Failed to load messages');
          }

          const rows = (data ?? []) as MessageRow[];
          const incoming = rows.map(mapMessageRow).reverse();

          set((s) => {
            const existing = s.messagesByConversationId[conversationId] ?? [];
            const hasMore = rows.length >= limit;
            return {
              messagesByConversationId: {
                ...s.messagesByConversationId,
                [conversationId]: mergeMessages(existing, incoming),
              },
              hasMoreByConversationId: {
                ...s.hasMoreByConversationId,
                [conversationId]: hasMore,
              },
              isLoading: opts.setLoading ? false : s.isLoading,
            };
          });

          return incoming;
        } catch (e) {
          const details = safeErrorDetails(e);
          console.error('[chatStore] fetchMessages failed', details);
          if (opts.setLoading) {
            set({
              isLoading: false,
              error: (details.message as string | null) ?? 'Failed to load messages',
            });
          }
          return [];
        }
      };

      return await fetchInternal({ setLoading: true });
    },

    // ✅ senderType موجود بس تجاهله (لتفادي خطأ TS)
    sendMessage: async (conversationId, body, _senderType) => {
      try {
        const trimmed = body.trim();
        if (!trimmed) return null;

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[chatStore] auth.getSession error', safeErrorDetails(sessionError));
        }

        const accessToken = sessionData.session?.access_token ?? null;
        if (!accessToken) {
          set({ error: 'not_authenticated' });
          return null;
        }

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        if (!baseUrl) {
          set({ error: 'Missing Supabase URL' });
          return null;
        }

        const url = `${baseUrl.replace(/\/$/, '')}/functions/v1/chat-send-message`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ conversationId, body: trimmed }),
        });

        const json = (await res.json().catch(() => null)) as
          | { data?: MessageRow | null; error?: unknown }
          | null;

        if (!res.ok) {
          const msg = normalizeSupabaseError(
            json?.error ?? { status: res.status, message: json ?? res.statusText },
          );
          console.error('[chatStore] sendMessage edge failed', { status: res.status, msg, raw: json });
          set({ error: msg });
          return null;
        }

        const row = (json?.data ?? null) as MessageRow | null;
        if (!row) {
          set({ error: 'Failed to send message' });
          return null;
        }

        const msg = mapMessageRow(row);

        set((s) => {
          const existing = s.messagesByConversationId[conversationId] ?? [];
          return {
            messagesByConversationId: {
              ...s.messagesByConversationId,
              [conversationId]: mergeMessages(existing, [msg]),
            },
          };
        });

        return msg;
      } catch (e) {
        console.error('[chatStore] sendMessage failed', safeErrorDetails(e));
        set({ error: normalizeSupabaseError(e) });
        return null;
      }
    },

    subscribeToConversation: (conversationId) => {
      console.log('[chatStore] subscribeToConversation', { conversationId });

      const existing = channelsByConversationId[conversationId];
      if (existing) {
        return () => {
          try {
            supabase.removeChannel(existing);
            delete channelsByConversationId[conversationId];
            set((s) => ({
              realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
              realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
            }));
          } catch (e) {
            console.error('[chatStore] unsubscribe failed', safeErrorDetails(e));
          }
        };
      }

      set((s) => ({
        realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'connecting' },
        realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
      }));

      let channel: RealtimeChannel | null = null;
      let stopped = false;

      const stop = () => {
        if (!channel) return;
        try {
          supabase.removeChannel(channel);
          delete channelsByConversationId[conversationId];
        } finally {
          channel = null;
        }
      };

      try {
        channel = supabase
          .channel(`messages:${conversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              try {
                const row = payload.new as unknown as MessageRow;
                const msg = mapMessageRow(row);

                set((s) => {
                  const existingMessages = s.messagesByConversationId[conversationId] ?? [];
                  return {
                    messagesByConversationId: {
                      ...s.messagesByConversationId,
                      [conversationId]: mergeMessages(existingMessages, [msg]),
                    },
                  };
                });
              } catch (e) {
                console.error('[chatStore] realtime payload error', safeErrorDetails(e));
              }
            },
          )
          .subscribe((status) => {
            if (stopped) return;

            if (status === 'SUBSCRIBED') {
              set((s) => ({
                realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'subscribed' },
                realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
              }));
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              set((s) => ({
                realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'error' },
                realtimeErrorByConversationId: {
                  ...s.realtimeErrorByConversationId,
                  [conversationId]:
                    status === 'CHANNEL_ERROR' ? 'Realtime channel error' : 'Realtime timed out',
                },
              }));
            } else if (status === 'CLOSED') {
              set((s) => ({
                realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
              }));
            }
          });

        if (channel) channelsByConversationId[conversationId] = channel;
      } catch (e) {
        console.error('[chatStore] subscribe failed', safeErrorDetails(e));
        set((s) => ({
          realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'error' },
          realtimeErrorByConversationId: {
            ...s.realtimeErrorByConversationId,
            [conversationId]: 'Realtime subscribe failed',
          },
        }));
      }

      return () => {
        stopped = true;
        stop();
        set((s) => ({
          realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
          realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
        }));
      };
    },

    markConversationReadForUser: async (conversationId: string) => {
      if (!conversationId) return;

      try {
        const { error } = await supabase
          .from('conversations')
          .update({ unread_count_user: 0 })
          .eq('id', conversationId);

        if (error) {
          console.warn('[chatStore] markConversationReadForUser error', safeErrorDetails(error));
          return;
        }

        set((s) => {
          const existing = s.conversations.find((c) => c.id === conversationId) ?? null;
          if (!existing) return s;
          return { conversations: upsertConversation(s.conversations, { ...existing, unreadCountUser: 0 }) };
        });
      } catch (e) {
        console.warn('[chatStore] markConversationReadForUser unexpected', safeErrorDetails(e));
      }
    },

    adminFetchConversations: async (limit) => {
      set({ isLoading: true, error: null });

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, guest_id, guest_stage, guest_name, guest_phone, preferred_language, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user',
          )
          .order('last_message_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        const rows = (data ?? []) as ConversationRow[];
        const mapped = rows.map(mapConversationRow);

        set((s) => {
          let next = s.conversations;
          for (const c of mapped) next = upsertConversation(next, c);
          return { conversations: next, isLoading: false };
        });

        return mapped;
      } catch (e) {
        console.error('[chatStore] adminFetchConversations failed', safeErrorDetails(e));
        set({ isLoading: false, error: normalizeSupabaseError(e) });
        return [];
      }
    },

    adminGetConversationById: async (conversationId) => {
      set({ isLoading: true, error: null });

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, guest_id, guest_stage, guest_name, guest_phone, preferred_language, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user',
          )
          .eq('id', conversationId)
          .single();

        if (error) throw error;

        const conv = mapConversationRow(data as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        console.error('[chatStore] adminGetConversationById failed', safeErrorDetails(e));
        set({ isLoading: false, error: normalizeSupabaseError(e) });
        return null;
      }
    },
  };
});
