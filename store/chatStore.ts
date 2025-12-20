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
  guest_id?: string | null; // ✅ NEW (لـ guest private conversations)
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

async function getGuestId(): Promise<string> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const key = 'chat_guest_id';

    let id = await AsyncStorage.getItem(key);
    if (id && id.trim()) return id;

    // prefer expo-crypto randomUUID if available
    try {
      const Crypto = await import('expo-crypto');
      const maybeUuid = (Crypto as unknown as { randomUUID?: () => string }).randomUUID;
      if (typeof maybeUuid === 'function') {
        id = maybeUuid();
      }
    } catch {
      // ignore
    }

    id = id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // normalize to allowed header charset: [a-zA-Z0-9_-]
    id = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

    await AsyncStorage.setItem(key, id);
    return id;
  } catch (e) {
    console.warn('[chatStore] getGuestId failed, using ephemeral id', safeErrorDetails(e));
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  }
}

function getEdgeBase(): string {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return baseUrl.replace(/\/$/, '');
}

async function getAccessTokenOrNull(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function isAuthedSession(): Promise<boolean> {
  const token = await getAccessTokenOrNull();
  return Boolean(token);
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
  getOrCreatePrivateConversation: () => Promise<Conversation | null>; // now supports guest too (creates guest private)

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

    /**
     * ✅ NEW BEHAVIOR:
     * - If user is authenticated => old behavior (private conversation by customer_id)
     * - If NOT authenticated => create/get a guest private conversation via Edge Function:
     *   /functions/v1/chat-get-or-create-guest-conversation
     */
    getOrCreatePrivateConversation: async () => {
      set({ isLoading: true, error: null });

      try {
        const authed = await isAuthedSession();

        // -------------------------
        // AUTH USER: old behavior
        // -------------------------
        if (authed) {
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
        }

        // -------------------------
        // GUEST: Edge Function
        // -------------------------
        const base = getEdgeBase();
        if (!base) {
          set({ isLoading: false, error: 'Missing Supabase URL' });
          return null;
        }

        const guestId = await getGuestId();
        const url = `${base}/functions/v1/chat-get-or-create-guest-conversation`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-guest-id': guestId,
          },
          body: JSON.stringify({}), // no body needed
        });

        const json = (await res.json().catch(() => null)) as
          | { data?: ConversationRow | null; error?: unknown }
          | null;

        if (!res.ok) {
          const msg = normalizeSupabaseError(json?.error ?? { status: res.status, message: json ?? res.statusText });
          set({ isLoading: false, error: msg });
          return null;
        }

        const row = (json?.data ?? null) as ConversationRow | null;
        if (!row?.id) {
          set({ isLoading: false, error: 'Chat is not ready yet' });
          return null;
        }

        const conv = mapConversationRow(row);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load chat' });
        return null;
      }
    },

    /**
     * ✅ NEW:
     * - Authed => direct Supabase query (as before)
     * - Guest => Edge Function /chat-fetch-messages with x-guest-id
     */
    fetchMessages: async (conversationId, limit, before) => {
      if (!conversationId) return [];
      set({ isLoading: true, error: null });

      try {
        const authed = await isAuthedSession();

        // -------------------------
        // AUTH: direct query
        // -------------------------
        if (authed) {
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
        }

        // -------------------------
        // GUEST: Edge fetch
        // -------------------------
        const base = getEdgeBase();
        if (!base) throw new Error('Missing Supabase URL');

        const guestId = await getGuestId();
        const url = `${base}/functions/v1/chat-fetch-messages`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-guest-id': guestId,
          },
          body: JSON.stringify({ conversationId, limit, before: before ?? null }),
        });

        const json = (await res.json().catch(() => null)) as
          | { data?: MessageRow[] | null; error?: unknown; hasMore?: boolean }
          | null;

        if (!res.ok) {
          const msg = normalizeSupabaseError(json?.error ?? { status: res.status, message: json ?? res.statusText });
          set({ isLoading: false, error: msg });
          return [];
        }

        const rows = (json?.data ?? []) as MessageRow[];
        const incoming = rows.map(mapMessageRow); // already expected oldest->newest in our edge

        set((s) => {
          const existing = s.messagesByConversationId[conversationId] ?? [];
          const hasMore = typeof json?.hasMore === 'boolean' ? json.hasMore : rows.length >= limit;
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

    /**
     * ✅ NEW:
     * - Guest ALWAYS sends via Edge with x-guest-id
     * - Auth users can use Edge too (preferred) with bearer token
     * - Fallback direct insert ONLY for authed sessions
     */
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

        const base = getEdgeBase();
        if (!base) {
          set({ error: 'Missing Supabase URL' });
          return null;
        }

        const edgeUrl = `${base}/functions/v1/chat-send-message`;

        const token = await getAccessTokenOrNull();
        const isGuest = !token;

        const headers: Record<string, string> = { 'content-type': 'application/json' };

        if (token) headers.authorization = `Bearer ${token}`;
        if (isGuest) {
          const guestId = await getGuestId();
          headers['x-guest-id'] = guestId;
        }

        // ✅ Force correct mode for guests:
        // guests are allowed ONLY with public_guest in our edge function
        const effectiveMode: SendMode = isGuest ? 'public_guest' : mode;

        // 1) Try Edge
        try {
          const res = await fetch(edgeUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ conversationId, body: trimmed, mode: effectiveMode }),
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
          // If guest -> no fallback (will fail via RLS). Return error.
          if (isGuest) {
            const msg = normalizeSupabaseError(e);
            set({ error: msg });
            return null;
          }

          console.warn('[chatStore] sendMessage edge crashed, trying fallback direct insert', safeErrorDetails(e));
        }

        // 2) Fallback direct insert (AUTH ONLY)
        const senderType: MessageSenderType = mode === 'admin' ? 'admin' : 'user';
        const { data: userData } = await supabase.auth.getUser();
        const senderId = userData.user?.id ?? null;

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
          set({ error: msg });
          return null;
        }

        const msg = mapMessageRow(inserted as MessageRow);

        set((s) => {
          const existing = s.messagesByConversationId[conversationId] ?? [];
          return {
            messagesByConversationId: {
              ...s.messagesByConversationId,
              [conversationId]: mergeMessages(existing, [msg]),
            },
          };
        });

        // best-effort conversation meta update
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

        return msg;
      } catch (e) {
        const msg = normalizeSupabaseError(e);
        console.error('[chatStore] sendMessage failed', safeErrorDetails(e));
        set({ error: msg });
        return null;
      }
    },

    /**
     * Realtime:
     * - For guests (no auth) realtime غالباً لن يشتغل حسب RLS/realtime settings
     * - الكود يحاول realtime ثم يسقط على polling
     */
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
          } catch {
            // ignore
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
            // Poll uses our fetchMessages, which supports guest via edge
            await get().fetchMessages(conversationId, 30);
          } catch {
            // ignore
          }
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
                set((s) => ({
                  realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'error' },
                  realtimeErrorByConversationId: { ...s.realtimeErrorByConversationId, [conversationId]: status },
                }));
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
      } catch {
        // ignore
      }
    },

    markConversationReadForAdmin: async (conversationId: string) => {
      if (!conversationId) return;
      try {
        await supabase.from('conversations').update({ unread_count_admin: 0 }).eq('id', conversationId);
      } catch {
        // ignore
      }
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
