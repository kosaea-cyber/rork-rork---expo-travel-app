import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { normalizeSupabaseError } from '@/lib/utils/supabaseError';

export type ConversationType = 'private' | 'public';
export type MessageSenderType = 'user' | 'admin' | 'system' | 'ai';

export type SendMode = 'public_guest' | 'public_auth' | 'private_user' | 'admin';

type RealtimeHealth = 'idle' | 'connecting' | 'subscribed' | 'polling' | 'error' | 'closed';

export interface Conversation {
  id: string;
  type: ConversationType;
  customerId: string | null;
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
  lastSendAtMs: number;

  getPublicConversation: () => Promise<Conversation | null>;
  getOrCreatePrivateConversation: () => Promise<Conversation | null>;
  fetchMessages: (conversationId: string, limit: number, before?: string) => Promise<Message[]>;
  sendMessage: (conversationId: string, body: string, mode: SendMode) => Promise<Message | null>;
  subscribeToConversation: (conversationId: string) => () => void;

  markConversationReadForUser: (conversationId: string) => Promise<void>;
  markConversationReadForAdmin: (conversationId: string) => Promise<void>;

  adminFetchConversations: (limit: number) => Promise<Conversation[]>;
  adminGetConversationById: (conversationId: string) => Promise<Conversation | null>;
  adminCreatePublicConversationIfMissing: () => Promise<Conversation | null>;
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
    lastSendAtMs: 0,

    // ... (باقي الدوال كما هي عندك) ...

    getPublicConversation: async () => {
      set({ isLoading: true, error: null });
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .eq('type', 'public')
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) throw error;

        const row = (data?.[0] ?? null) as ConversationRow | null;
        const conv = row ? mapConversationRow(row) : null;

        if (conv) set((s) => ({ conversations: upsertConversation(s.conversations, conv) }));
        set({ isLoading: false });
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load public conversation' });
        return null;
      }
    },

    getOrCreatePrivateConversation: async () => {
      set({ isLoading: true, error: null });
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id ?? '';
        if (!userId) {
          set({ isLoading: false, error: 'Not authenticated' });
          return null;
        }

        const { data: existingData, error: existingError } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .eq('type', 'private')
          .eq('customer_id', userId)
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (existingError) throw existingError;

        const existingRow = (existingData?.[0] ?? null) as ConversationRow | null;
        if (existingRow) {
          const conv = mapConversationRow(existingRow);
          set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
          return conv;
        }

        const { data: inserted, error: insertError } = await supabase
          .from('conversations')
          .insert({ type: 'private', customer_id: userId })
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .single();

        if (insertError) throw insertError;

        const conv = mapConversationRow(inserted as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load chat' });
        return null;
      }
    },

    fetchMessages: async (conversationId, limit, before) => {
      if (!conversationId) return [];
      set({ isLoading: true, error: null });

      try {
        let q = supabase
          .from('messages')
          .select('id, conversation_id, sender_type, sender_id, body, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (before) q = q.lt('created_at', before);

        const { data, error } = await q;
        if (error) throw error;

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
            isLoading: false,
          };
        });

        return incoming;
      } catch (e) {
        const msg = normalizeSupabaseError(e);
        console.error('[chatStore] fetchMessages failed', safeErrorDetails(e));
        set({ isLoading: false, error: msg });
        return [];
      }
    },

    // ✅ أهم تعديل: إرسال مضمون (Edge Function optional + DB fallback)
    sendMessage: async (conversationId, body, mode) => {
      try {
        const trimmed = body.trim();
        if (!trimmed || !conversationId) return null;

        const now = Date.now();
        const last = get().lastSendAtMs;
        if (last && now - last < 3000) {
          set({ error: 'rate_limited' });
          return null;
        }
        set({ lastSendAtMs: now, error: null });

        // 1) حدّد sender_type + sender_id
        const senderType: MessageSenderType = mode === 'admin' ? 'admin' : 'user';

        const { data: userData } = await supabase.auth.getUser();
        const senderId = userData.user?.id ?? null;

        // 2) جرّب Edge Function (إذا موجودة). إذا فشلت → نتابع fallback.
        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        const normalizedBase = baseUrl.replace(/\/$/, '');
        const edgeUrl = normalizedBase ? `${normalizedBase}/functions/v1/chat-send-message` : '';

        let usedEdge = false;

        if (edgeUrl) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token ?? null;

            const headers: Record<string, string> = { 'content-type': 'application/json' };
            if (accessToken) headers.authorization = `Bearer ${accessToken}`;

            const res = await fetch(edgeUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ conversationId, body: trimmed, mode }),
            });

            if (res.ok) {
              const json = (await res.json().catch(() => null)) as { data?: MessageRow | null } | null;
              const row = (json?.data ?? null) as MessageRow | null;
              if (row) {
                const msg = mapMessageRow(row);
                usedEdge = true;

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
              }
            }
            // إذا edge ردّ لكنه فشل → نكمل fallback
            console.warn('[chatStore] edge send failed, fallback to direct insert', { status: res.status });
          } catch (e) {
            console.warn('[chatStore] edge send crashed, fallback to direct insert', safeErrorDetails(e));
          }
        }

        // 3) Fallback مباشر على Supabase DB (المهم)
        const { data: inserted, error: insertErr } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_type: senderType,
            sender_id: senderId,
            body: trimmed,
          })
          .select('id, conversation_id, sender_type, sender_id, body, created_at')
          .single();

        if (insertErr) {
          const msg = normalizeSupabaseError(insertErr);
          console.error('[chatStore] direct insert failed', safeErrorDetails(insertErr));
          set({ error: msg });
          return null;
        }

        const msg = mapMessageRow(inserted as MessageRow);

        // تحديث محلي للواجهة
        set((s) => {
          const existing = s.messagesByConversationId[conversationId] ?? [];
          return {
            messagesByConversationId: {
              ...s.messagesByConversationId,
              [conversationId]: mergeMessages(existing, [msg]),
            },
          };
        });

        // تحديث conversation preview بشكل "best effort" (إذا RLS تسمح)
        try {
          await supabase
            .from('conversations')
            .update({
              last_message_at: msg.createdAt,
              last_message_preview: msg.body.slice(0, 80),
              last_sender_type: msg.senderType,
            })
            .eq('id', conversationId);
        } catch {
          // ignore
        }

        console.log('[chatStore] sendMessage success', { usedEdge, conversationId });
        return msg;
      } catch (e) {
        const msg = normalizeSupabaseError(e);
        console.error('[chatStore] sendMessage failed', safeErrorDetails(e));
        set({ error: msg });
        return null;
      }
    },

    // subscribeToConversation .. كما هو عندك (بدون تغيير)
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
          } catch {}
        };
      }

      set((s) => ({
        realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'connecting' },
        realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
      }));

      let channel: RealtimeChannel | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let stopped = false;

      const stopRealtime = () => {
        if (!channel) return;
        try {
          supabase.removeChannel(channel);
          delete channelsByConversationId[conversationId];
        } finally {
          channel = null;
        }
      };

      const startPolling = () => {
        if (pollTimer || stopped) return;
        stopRealtime();

        set((s) => ({
          realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'polling' },
          realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
        }));

        const tick = async () => {
          try {
            if (stopped) return;
            const { data, error } = await supabase
              .from('messages')
              .select('id, conversation_id, sender_type, sender_id, body, created_at')
              .eq('conversation_id', conversationId)
              .order('created_at', { ascending: false })
              .limit(30);

            if (error) return;

            const rows = (data ?? []) as MessageRow[];
            const incoming = rows.map(mapMessageRow).reverse();

            set((s) => {
              const prev = s.messagesByConversationId[conversationId] ?? [];
              return {
                messagesByConversationId: {
                  ...s.messagesByConversationId,
                  [conversationId]: mergeMessages(prev, incoming),
                },
              };
            });
          } catch {}
        };

        pollTimer = setInterval(() => void tick(), 7000);
        void tick();
      };

      const startRealtime = () => {
        if (stopped || channel) return;

        try {
          channel = supabase
            .channel(`messages:${conversationId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
              (payload) => {
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
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                set((s) => ({
                  realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'subscribed' },
                  realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
                }));
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                startPolling();
              } else if (status === 'CLOSED') {
                set((s) => ({
                  realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
                }));
              }
            });

          if (channel) channelsByConversationId[conversationId] = channel;
        } catch {
          startPolling();
        }
      };

      void (async () => {
        try {
          const { getAiSettingsCached } = await import('@/lib/ai/settings');
          const s = await getAiSettingsCached();
          if (stopped) return;
          if (s.realtime_enabled) startRealtime();
          else startPolling();
        } catch {
          startRealtime();
        }
      })();

      return () => {
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        stopRealtime();
        set((s) => ({
          realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
          realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
        }));
      };
    },

    markConversationReadForUser: async (conversationId: string) => {
      if (!conversationId) return;
      try {
        await supabase.from('conversations').update({ unread_count_user: 0 }).eq('id', conversationId);
      } catch {}
    },

    markConversationReadForAdmin: async (conversationId: string) => {
      if (!conversationId) return;
      try {
        await supabase.from('conversations').update({ unread_count_admin: 0 }).eq('id', conversationId);
      } catch {}
    },

    adminFetchConversations: async (limit) => {
      set({ isLoading: true, error: null });
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
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
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .eq('id', conversationId)
          .single();

        if (error) throw error;

        const conv = mapConversationRow(data as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        set({ isLoading: false, error: normalizeSupabaseError(e) });
        return null;
      }
    },

    adminCreatePublicConversationIfMissing: async () => {
      set({ isLoading: true, error: null });
      try {
        const { data: existingData, error: existingError } = await supabase
          .from('conversations')
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .eq('type', 'public')
          .order('created_at', { ascending: true })
          .limit(1);

        if (existingError) throw existingError;

        const existingRow = (existingData?.[0] ?? null) as ConversationRow | null;
        if (existingRow) {
          const conv = mapConversationRow(existingRow);
          set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
          return conv;
        }

        const { data: inserted, error: insertError } = await supabase
          .from('conversations')
          .insert({ type: 'public' })
          .select(
            'id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user'
          )
          .single();

        if (insertError) throw insertError;

        const conv = mapConversationRow(inserted as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        set({ isLoading: false, error: normalizeSupabaseError(e) });
        return null;
      }
    },
  };
});
