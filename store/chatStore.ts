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

    getPublicConversation: async () => {
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] getPublicConversation');

        const { data, error } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .eq('type', 'public')
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) {
          const details = safeErrorDetails(error);
          console.error('[chatStore] getPublicConversation select error', details);
          throw new Error((details.message as string | null) ?? 'Failed to load public conversation');
        }

        const row = (data?.[0] ?? null) as ConversationRow | null;
        const conv = row ? mapConversationRow(row) : null;

        if (conv) {
          set((s) => ({ conversations: upsertConversation(s.conversations, conv) }));
        }

        set({ isLoading: false });
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] getPublicConversation failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load public conversation' });
        return null;
      }
    },

    getOrCreatePrivateConversation: async () => {
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] getOrCreatePrivateConversation');

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          const details = safeErrorDetails(authError);
          console.error('[chatStore] auth.getUser error', details);
        }

        const userId = authData.user?.id ?? '';
        if (!userId) {
          set({ isLoading: false, error: 'Not authenticated' });
          return null;
        }

        const { data: existingData, error: existingError } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .eq('type', 'private')
          .eq('customer_id', userId)
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (existingError) {
          const details = safeErrorDetails(existingError);
          console.error('[chatStore] private conversations select error', details);
          throw new Error((details.message as string | null) ?? 'Failed to load private conversation');
        }

        const existingRow = (existingData?.[0] ?? null) as ConversationRow | null;
        if (existingRow) {
          const conv = mapConversationRow(existingRow);
          set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
          return conv;
        }

        const { data: inserted, error: insertError } = await supabase
          .from('conversations')
          .insert({ type: 'private', customer_id: userId })
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .single();

        if (insertError) {
          const details = safeErrorDetails(insertError);
          console.error('[chatStore] insert private conversation error', details);
          throw new Error((details.message as string | null) ?? 'Failed to create private conversation');
        }

        const conv = mapConversationRow(inserted as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] getOrCreatePrivateConversation failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load chat' });
        return null;
      }
    },

    fetchMessages: async (conversationId, limit, before) => {
      const fetchInternal = async (opts: { setLoading: boolean }): Promise<Message[]> => {
        if (opts.setLoading) set({ isLoading: true, error: null });

        try {
          console.log('[chatStore] fetchMessages', { conversationId, limit, before: before ?? null, setLoading: opts.setLoading });

          let q = supabase
            .from('messages')
            .select('id, conversation_id, sender_type, sender_id, body, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (before) {
            q = q.lt('created_at', before);
          }

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
          if (opts.setLoading) set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load messages' });
          return [];
        }
      };

      return await fetchInternal({ setLoading: true });
    },

    // ✅ FIX: allow public_guest to send WITHOUT JWT
    sendMessage: async (conversationId, body, mode) => {
      try {
        const trimmed = body.trim();
        if (!trimmed) return null;

        const now = Date.now();
        const last = get().lastSendAtMs;
        if (last && now - last < 3000) {
          console.warn('[chatStore] sendMessage UI rate limit hit', { conversationId, mode, deltaMs: now - last });
          set({ error: 'rate_limited' });
          return null;
        }

        console.log('[chatStore] sendMessage (edge)', { conversationId, mode, bodyLen: trimmed.length });

        set({ lastSendAtMs: now, error: null });

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        if (!baseUrl) {
          set({ error: 'Missing Supabase URL' });
          return null;
        }

        const normalizedBase = baseUrl.replace(/\/$/, '');
        const url = `${normalizedBase}/functions/v1/chat-send-message`;

        console.log('[chatStore] edge function target', {
          normalizedBase,
          url,
          projectRef: (() => {
            try {
              const host = new URL(normalizedBase).host;
              const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
              return m?.[1] ?? null;
            } catch {
              return null;
            }
          })(),
        });

        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[chatStore] auth.getSession error', safeErrorDetails(sessionError));
        }

        const accessToken = sessionData.session?.access_token ?? null;
        if (accessToken) {
          headers.authorization = `Bearer ${accessToken}`;
        }

        if (mode === 'public_guest') {
          if (!accessToken) {
            let guestId: string | null = null;

            try {
              const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
              guestId = await AsyncStorage.getItem('chat_guest_id');
              if (!guestId) {
                try {
                  const Crypto = await import('expo-crypto');
                  const maybeUuid = (Crypto as unknown as { randomUUID?: () => string }).randomUUID;
                  guestId = typeof maybeUuid === 'function' ? maybeUuid() : null;
                } catch {
                  guestId = null;
                }

                guestId = guestId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                await AsyncStorage.setItem('chat_guest_id', guestId);
              }
            } catch (e) {
              console.warn('[chatStore] guestId storage unavailable, generating ephemeral guest id', safeErrorDetails(e));
              guestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            }

            headers['x-guest-id'] = guestId;
          }
        } else {
          if (!accessToken) {
            set({ error: 'not_authenticated' });
            return null;
          }
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ conversationId, body: trimmed, mode }),
        });

        const json = (await res.json().catch(() => null)) as
          | { data?: MessageRow | null; error?: unknown }
          | null;

        if (!res.ok) {
          const msg = normalizeSupabaseError(json?.error ?? { status: res.status, message: json ?? res.statusText });
          console.error('[chatStore] sendMessage edge failed', { status: res.status, msg, raw: json });
          set({ error: msg });
          return null;
        }

        const row = (json?.data ?? null) as MessageRow | null;
        if (!row) {
          console.error('[chatStore] sendMessage edge missing data', { json });
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
        const details = safeErrorDetails(e);
        console.error('[chatStore] sendMessage failed', {
          ...details,
          normalized: normalizeSupabaseError(e),
          raw: e,
        });
        set({ error: normalizeSupabaseError(e) });
        return null;
      }
    },

    // subscribeToConversation .. (بدون تغيير)
    subscribeToConversation: (conversationId) => {
      console.log('[chatStore] subscribeToConversation', { conversationId });

      const existing = channelsByConversationId[conversationId];
      if (existing) {
        console.log('[chatStore] subscribeToConversation already subscribed', { conversationId });
        return () => {
          try {
            console.log('[chatStore] unsubscribeToConversation (existing)', { conversationId });
            supabase.removeChannel(existing);
            delete channelsByConversationId[conversationId];
            set((s) => ({
              realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
              realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
            }));
          } catch (e) {
            console.error('[chatStore] unsubscribeToConversation failed', safeErrorDetails(e));
          }
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
          console.log('[chatStore] stopRealtime', { conversationId });
          supabase.removeChannel(channel);
          delete channelsByConversationId[conversationId];
        } catch (e) {
          console.warn('[chatStore] stopRealtime failed', safeErrorDetails(e));
        } finally {
          channel = null;
        }
      };

      const startPolling = () => {
        if (pollTimer || stopped) return;

        console.log('[chatStore] polling enabled', { conversationId });
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

            if (error) {
              console.warn('[chatStore] poll fetch error', safeErrorDetails(error));
              return;
            }

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
          } catch (e) {
            console.warn('[chatStore] poll tick failed', safeErrorDetails(e));
          }
        };

        pollTimer = setInterval(() => void tick(), 7000);
        void tick();
      };

      const startRealtime = () => {
        if (stopped || channel) return;

        console.log('[chatStore] realtime enabled', { conversationId });

        try {
          channel = supabase
            .channel(`messages:${conversationId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
              (payload) => {
                try {
                  const row = payload.new as unknown as MessageRow;
                  const msg = mapMessageRow(row);

                  set((s) => {
                    const existingMessages = s.messagesByConversationId[conversationId] ?? [];
                    const knownConv = s.conversations.find((c) => c.id === conversationId) ?? null;

                    return {
                      messagesByConversationId: {
                        ...s.messagesByConversationId,
                        [conversationId]: mergeMessages(existingMessages, [msg]),
                      },
                      conversations: upsertConversation(s.conversations, {
                        id: conversationId,
                        type: knownConv?.type ?? 'private',
                        customerId: knownConv?.customerId ?? null,
                        createdAt: knownConv?.createdAt ?? new Date().toISOString(),
                        lastMessageAt: msg.createdAt,
                        lastMessagePreview: msg.body.slice(0, 80),
                        lastSenderType: msg.senderType,
                        unreadCountAdmin: knownConv?.unreadCountAdmin ?? 0,
                        unreadCountUser: knownConv?.unreadCountUser ?? 0,
                      }),
                    };
                  });
                } catch (e) {
                  console.error('[chatStore] realtime payload handling failed', safeErrorDetails(e));
                }
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
        } catch (e) {
          console.error('[chatStore] startRealtime failed', safeErrorDetails(e));
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
        try {
          stopped = true;
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          stopRealtime();
          set((s) => ({
            realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
            realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: null },
          }));
        } catch (e) {
          console.error('[chatStore] unsubscribeToConversation failed', safeErrorDetails(e));
        }
      };
    },

    markConversationReadForUser: async (conversationId: string) => {
      if (!conversationId) return;

      try {
        const { error } = await supabase.from('conversations').update({ unread_count_user: 0 }).eq('id', conversationId);
        if (error) {
          console.warn('[chatStore] markConversationReadForUser update error', safeErrorDetails(error));
          return;
        }
        set((s) => {
          const existing = s.conversations.find((c) => c.id === conversationId) ?? null;
          if (!existing) return s;
          return { conversations: upsertConversation(s.conversations, { ...existing, unreadCountUser: 0 }) };
        });
      } catch (e) {
        console.warn('[chatStore] markConversationReadForUser unexpected error', safeErrorDetails(e));
      }
    },

    markConversationReadForAdmin: async (conversationId: string) => {
      if (!conversationId) return;

      try {
        const { error } = await supabase.from('conversations').update({ unread_count_admin: 0 }).eq('id', conversationId);
        if (error) {
          console.warn('[chatStore] markConversationReadForAdmin update error', safeErrorDetails(error));
          return;
        }
        set((s) => {
          const existing = s.conversations.find((c) => c.id === conversationId) ?? null;
          if (!existing) return s;
          return { conversations: upsertConversation(s.conversations, { ...existing, unreadCountAdmin: 0 }) };
        });
      } catch (e) {
        console.warn('[chatStore] markConversationReadForAdmin unexpected error', safeErrorDetails(e));
      }
    },

    adminFetchConversations: async (limit) => {
      set({ isLoading: true, error: null });

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
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
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load conversations' });
        return [];
      }
    },

    adminGetConversationById: async (conversationId) => {
      set({ isLoading: true, error: null });

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .eq('id', conversationId)
          .single();

        if (error) throw error;

        const conv = mapConversationRow(data as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load conversation' });
        return null;
      }
    },

    adminCreatePublicConversationIfMissing: async () => {
      set({ isLoading: true, error: null });

      try {
        const { data: existingData, error: existingError } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
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
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .single();

        if (insertError) throw insertError;

        const conv = mapConversationRow(inserted as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to create public chat' });
        return null;
      }
    },
  };
});
