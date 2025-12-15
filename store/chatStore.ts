import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { useI18nStore } from '@/constants/i18n';
import { aiProvider } from '@/lib/ai/provider';
import { supabase } from '@/lib/supabase/client';

export type ConversationType = 'private' | 'public';
export type MessageSenderType = 'user' | 'admin' | 'system' | 'ai';

export type SendMode = 'public_guest' | 'public_auth' | 'private_user' | 'admin';

type AiMode = 'off' | 'auto_reply' | 'human_handoff';

type AiSettingsRow = {
  id: string;
  is_enabled: boolean;
  mode: AiMode;
  public_chat_enabled: boolean;
  private_chat_enabled: boolean;
  system_prompt: string | null;
};

let aiSettingsCache:
  | {
      expiresAtMs: number;
      value: AiSettingsRow | null;
    }
  | null = null;

async function getAiSettingsCached(): Promise<AiSettingsRow | null> {
  const now = Date.now();
  if (aiSettingsCache && aiSettingsCache.expiresAtMs > now) {
    return aiSettingsCache.value;
  }

  try {
    console.log('[chatStore] ai_settings cache miss; loading');

    const res = await supabase.from('ai_settings').select('*').limit(1).maybeSingle();

    if (res.error) {
      console.warn('[chatStore] ai_settings select failed', safeErrorDetails(res.error));
      aiSettingsCache = { expiresAtMs: now + 60_000, value: null };
      return null;
    }

    const row = (res.data ?? null) as AiSettingsRow | null;
    aiSettingsCache = { expiresAtMs: now + 60_000, value: row };
    return row;
  } catch (e) {
    console.warn('[chatStore] ai_settings load unexpected error', safeErrorDetails(e));
    aiSettingsCache = { expiresAtMs: now + 60_000, value: null };
    return null;
  }
}

type RealtimeHealth = 'idle' | 'connecting' | 'subscribed' | 'error' | 'closed';

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

async function bestEffortInsertAiLog(payload: { status: 'skipped' | 'queued'; request_json: Record<string, unknown> }) {
  try {
    console.log('[chatStore] ai_logs insert', payload);
    const { error } = await supabase.from('ai_logs').insert(payload);
    if (error) {
      console.warn('[chatStore] ai_logs insert failed', safeErrorDetails(error));
    }
  } catch (e) {
    console.warn('[chatStore] ai_logs insert unexpected error', safeErrorDetails(e));
  }
}

interface ChatState {
  conversations: Conversation[];
  messagesByConversationId: Record<string, Message[]>;
  realtimeHealthByConversationId: Record<string, RealtimeHealth>;
  realtimeErrorByConversationId: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;

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
    realtimeHealthByConversationId: {},
    realtimeErrorByConversationId: {},
    isLoading: false,
    error: null,

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
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] fetchMessages', { conversationId, limit, before: before ?? null });

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
          return {
            messagesByConversationId: {
              ...s.messagesByConversationId,
              [conversationId]: mergeMessages(existing, incoming),
            },
            isLoading: false,
          };
        });

        return incoming;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] fetchMessages failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load messages' });
        return [];
      }
    },

    sendMessage: async (conversationId, body, mode) => {
      try {
        const trimmed = body.trim();
        if (!trimmed) return null;

        console.log('[chatStore] sendMessage', { conversationId, mode, bodyLen: trimmed.length });

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          const details = safeErrorDetails(authError);
          console.error('[chatStore] auth.getUser error', details);
        }

        const userId = authData.user?.id ?? null;

        let senderType: MessageSenderType = 'user';
        let senderId: string | null = null;

        if (mode === 'public_guest') {
          senderType = 'user';
          senderId = null;
        } else if (mode === 'public_auth') {
          senderType = 'user';
          senderId = userId;
          if (!senderId) throw new Error('Not authenticated');
        } else if (mode === 'private_user') {
          senderType = 'user';
          senderId = userId;
          if (!senderId) throw new Error('Not authenticated');
        } else if (mode === 'admin') {
          senderType = 'admin';
          senderId = userId;
          if (!senderId) throw new Error('Not authenticated');
        }

        const { data, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_type: senderType,
            sender_id: senderId,
            body: trimmed,
          })
          .select('id, conversation_id, sender_type, sender_id, body, created_at')
          .single();

        if (error) {
          const details = safeErrorDetails(error);
          console.error('[chatStore] sendMessage insert error', details);
          throw new Error((details.message as string | null) ?? 'Failed to send message');
        }

        const msg = mapMessageRow(data as MessageRow);

        set((s) => {
          const existing = s.messagesByConversationId[conversationId] ?? [];
          return {
            messagesByConversationId: {
              ...s.messagesByConversationId,
              [conversationId]: mergeMessages(existing, [msg]),
            },
          };
        });

        try {
          const preview = trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
          const updatePayload: Partial<ConversationRow> = {
            last_message_at: new Date().toISOString(),
            last_message_preview: preview,
            last_sender_type: senderType,
          };

          const { error: updateError } = await supabase.from('conversations').update(updatePayload).eq('id', conversationId);

          if (updateError) {
            console.warn('[chatStore] conversations metadata update blocked/failed (expected if trigger exists)', safeErrorDetails(updateError));
          }
        } catch (e) {
          console.warn('[chatStore] conversations metadata update unexpected error', safeErrorDetails(e));
        }

        if (senderType === 'user' && (mode === 'public_guest' || mode === 'public_auth' || mode === 'private_user')) {
          void (async () => {
            try {
              const knownConv = get().conversations.find((c) => c.id === conversationId) ?? null;
              let convType: ConversationType | null = knownConv?.type ?? null;

              if (!convType) {
                const res = await supabase.from('conversations').select('type').eq('id', conversationId).maybeSingle();
                if (!res.error && res.data && (res.data as { type?: unknown }).type) {
                  const t = (res.data as { type?: unknown }).type;
                  if (t === 'public' || t === 'private') convType = t;
                } else if (res.error) {
                  console.warn('[chatStore] conversation type fetch failed', safeErrorDetails(res.error));
                }
              }

              if (!convType) {
                console.warn('[chatStore] auto-reply skipped: conversation type unknown', { conversationId });
                return;
              }

              const settings = await getAiSettingsCached();
              console.log('[chatStore] auto-reply evaluate', {
                conversationId,
                convType,
                hasSettings: Boolean(settings),
                isEnabled: settings?.is_enabled ?? null,
                mode: settings?.mode ?? null,
              });

              if (!settings) return;
              if (!settings.is_enabled) return;
              if (settings.mode === 'off') return;

              const isAllowed = convType === 'public' ? settings.public_chat_enabled : settings.private_chat_enabled;
              if (!isAllowed) return;

              if (settings.mode === 'human_handoff') {
                await bestEffortInsertAiLog({ status: 'queued', request_json: { reason: 'stub' } });
                return;
              }

              if (settings.mode === 'auto_reply') {
                let providerText: string | null = null;

                try {
                  providerText = await aiProvider.generateReply({
                    conversationId,
                    conversationType: convType,
                    userMessage: trimmed,
                    systemPrompt: settings.system_prompt ?? null,
                  });
                } catch (e) {
                  console.warn('[chatStore] aiProvider.generateReply failed (non-fatal)', safeErrorDetails(e));
                  providerText = null;
                }

                const reply = providerText?.trim() ? providerText.trim() : null;

                if (reply) {
                  const insertAiRes = await supabase
                    .from('messages')
                    .insert({
                      conversation_id: conversationId,
                      sender_type: 'ai',
                      sender_id: null,
                      body: reply,
                    })
                    .select('id, conversation_id, sender_type, sender_id, body, created_at')
                    .single();

                  if (insertAiRes.error) {
                    console.warn('[chatStore] AI reply insert failed; falling back to stub', safeErrorDetails(insertAiRes.error));
                  } else if (insertAiRes.data) {
                    const aiMsg = mapMessageRow(insertAiRes.data as MessageRow);
                    set((s) => {
                      const existing = s.messagesByConversationId[conversationId] ?? [];
                      return {
                        messagesByConversationId: {
                          ...s.messagesByConversationId,
                          [conversationId]: mergeMessages(existing, [aiMsg]),
                        },
                      };
                    });

                    await bestEffortInsertAiLog({ status: 'skipped', request_json: { reason: 'provider_returned_text' } });
                    return;
                  }
                }

                const autoBody = useI18nStore.getState().t('chatAutoReplyStub');

                const insertRes = await supabase
                  .from('messages')
                  .insert({
                    conversation_id: conversationId,
                    sender_type: 'system',
                    sender_id: null,
                    body: autoBody,
                  })
                  .select('id, conversation_id, sender_type, sender_id, body, created_at')
                  .single();

                if (insertRes.error) {
                  console.warn('[chatStore] auto-reply message insert failed', safeErrorDetails(insertRes.error));
                } else if (insertRes.data) {
                  const systemMsg = mapMessageRow(insertRes.data as MessageRow);
                  set((s) => {
                    const existing = s.messagesByConversationId[conversationId] ?? [];
                    return {
                      messagesByConversationId: {
                        ...s.messagesByConversationId,
                        [conversationId]: mergeMessages(existing, [systemMsg]),
                      },
                    };
                  });
                }

                await bestEffortInsertAiLog({ status: 'skipped', request_json: { reason: 'stub' } });
              }
            } catch (e) {
              console.warn('[chatStore] auto-reply flow failed (non-fatal)', safeErrorDetails(e));
            }
          })();
        }

        return msg;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] sendMessage failed', details);
        set({ error: (details.message as string | null) ?? 'Failed to send message' });
        return null;
      }
    },

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

                console.log('[chatStore] realtime message INSERT', {
                  conversationId,
                  id: msg.id,
                  senderType: msg.senderType,
                });

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
            console.log('[chatStore] realtime status', { conversationId, status });

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
                  [conversationId]: status === 'CHANNEL_ERROR' ? 'Realtime channel error' : 'Realtime timed out',
                },
              }));
            } else if (status === 'CLOSED') {
              set((s) => ({
                realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'closed' },
              }));
            }
          });

        if (channel) {
          channelsByConversationId[conversationId] = channel;
        }
      } catch (e) {
        console.error('[chatStore] subscribeToConversation failed', safeErrorDetails(e));
        set((s) => ({
          realtimeHealthByConversationId: { ...s.realtimeHealthByConversationId, [conversationId]: 'error' },
          realtimeErrorByConversationId: {
            ...s.realtimeErrorByConversationId,
            [conversationId]: (safeErrorDetails(e).message as string | null) ?? 'Realtime subscribe failed',
          },
        }));
      }

      return () => {
        try {
          if (channel) {
            console.log('[chatStore] unsubscribeToConversation', { conversationId });
            supabase.removeChannel(channel);
            delete channelsByConversationId[conversationId];
          }

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
        console.log('[chatStore] markConversationReadForUser', { conversationId });
        const { error } = await supabase.from('conversations').update({ unread_count_user: 0 }).eq('id', conversationId);

        if (error) {
          console.warn('[chatStore] markConversationReadForUser update error', safeErrorDetails(error));
          return;
        }

        set((s) => {
          const existing = s.conversations.find((c) => c.id === conversationId) ?? null;
          if (!existing) return s;
          return {
            conversations: upsertConversation(s.conversations, { ...existing, unreadCountUser: 0 }),
          };
        });
      } catch (e) {
        console.warn('[chatStore] markConversationReadForUser unexpected error', safeErrorDetails(e));
      }
    },

    markConversationReadForAdmin: async (conversationId: string) => {
      if (!conversationId) return;

      try {
        console.log('[chatStore] markConversationReadForAdmin', { conversationId });
        const { error } = await supabase.from('conversations').update({ unread_count_admin: 0 }).eq('id', conversationId);

        if (error) {
          console.warn('[chatStore] markConversationReadForAdmin update error', safeErrorDetails(error));
          return;
        }

        set((s) => {
          const existing = s.conversations.find((c) => c.id === conversationId) ?? null;
          if (!existing) return s;
          return {
            conversations: upsertConversation(s.conversations, { ...existing, unreadCountAdmin: 0 }),
          };
        });
      } catch (e) {
        console.warn('[chatStore] markConversationReadForAdmin unexpected error', safeErrorDetails(e));
      }
    },

    adminFetchConversations: async (limit) => {
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] adminFetchConversations', { limit });

        const { data, error } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .order('last_message_at', { ascending: false })
          .limit(limit);

        if (error) {
          const details = safeErrorDetails(error);
          console.error('[chatStore] adminFetchConversations select error', details);
          throw new Error((details.message as string | null) ?? 'Failed to load conversations');
        }

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
        console.error('[chatStore] adminFetchConversations failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load conversations' });
        return [];
      }
    },

    adminGetConversationById: async (conversationId) => {
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] adminGetConversationById', { conversationId });

        const { data, error } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .eq('id', conversationId)
          .single();

        if (error) {
          const details = safeErrorDetails(error);
          console.error('[chatStore] adminGetConversationById select error', details);
          throw new Error((details.message as string | null) ?? 'Failed to load conversation');
        }

        const conv = mapConversationRow(data as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] adminGetConversationById failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to load conversation' });
        return null;
      }
    },

    adminCreatePublicConversationIfMissing: async () => {
      set({ isLoading: true, error: null });

      try {
        console.log('[chatStore] adminCreatePublicConversationIfMissing');

        const { data: existingData, error: existingError } = await supabase
          .from('conversations')
          .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type, unread_count_admin, unread_count_user')
          .eq('type', 'public')
          .order('created_at', { ascending: true })
          .limit(1);

        if (existingError) {
          const details = safeErrorDetails(existingError);
          console.error('[chatStore] public conversations select error', details);
          throw new Error((details.message as string | null) ?? 'Failed to check public conversation');
        }

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

        if (insertError) {
          const details = safeErrorDetails(insertError);
          console.error('[chatStore] insert public conversation error', details);
          throw new Error((details.message as string | null) ?? 'Failed to create public chat');
        }

        const conv = mapConversationRow(inserted as ConversationRow);
        set((s) => ({ conversations: upsertConversation(s.conversations, conv), isLoading: false }));
        return conv;
      } catch (e) {
        const details = safeErrorDetails(e);
        console.error('[chatStore] adminCreatePublicConversationIfMissing failed', details);
        set({ isLoading: false, error: (details.message as string | null) ?? 'Failed to create public chat' });
        return null;
      }
    },
  };
});
