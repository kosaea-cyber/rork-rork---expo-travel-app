import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type ConversationType = 'private' | 'public';
export type MessageSenderType = 'user' | 'admin' | 'system' | 'ai';

export type SendMode = 'public_guest' | 'public_auth' | 'private_user' | 'admin';

export interface Conversation {
  id: string;
  type: ConversationType;
  customerId: string | null;
  createdAt: string;
  lastMessageAt: string;
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
  isLoading: boolean;
  error: string | null;

  getPublicConversation: () => Promise<Conversation | null>;
  getOrCreatePrivateConversation: () => Promise<Conversation | null>;
  fetchMessages: (conversationId: string, limit: number, before?: string) => Promise<Message[]>;
  sendMessage: (conversationId: string, body: string, mode: SendMode) => Promise<Message | null>;
  subscribeToConversation: (conversationId: string) => () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversationId: {},
  isLoading: false,
  error: null,

  getPublicConversation: async () => {
    set({ isLoading: true, error: null });

    try {
      console.log('[chatStore] getPublicConversation');

      const { data, error } = await supabase
        .from('conversations')
        .select('id, type, customer_id, created_at, last_message_at')
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
        .select('id, type, customer_id, created_at, last_message_at')
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
        .select('id, type, customer_id, created_at, last_message_at')
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
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (updateError) {
          console.warn('[chatStore] conversations last_message_at update blocked/failed', safeErrorDetails(updateError));
        }
      } catch (e) {
        console.warn('[chatStore] conversations last_message_at update unexpected error', safeErrorDetails(e));
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
                const existing = s.messagesByConversationId[conversationId] ?? [];
                return {
                  messagesByConversationId: {
                    ...s.messagesByConversationId,
                    [conversationId]: mergeMessages(existing, [msg]),
                  },
                };
              });
            } catch (e) {
              console.error('[chatStore] realtime payload handling failed', safeErrorDetails(e));
            }
          }
        )
        .subscribe((status) => {
          console.log('[chatStore] realtime status', { conversationId, status });
        });
    } catch (e) {
      console.error('[chatStore] subscribeToConversation failed', safeErrorDetails(e));
    }

    return () => {
      try {
        if (channel) {
          console.log('[chatStore] unsubscribeToConversation', { conversationId });
          supabase.removeChannel(channel);
        }
      } catch (e) {
        console.error('[chatStore] unsubscribeToConversation failed', safeErrorDetails(e));
      }
    };
  },
}));
