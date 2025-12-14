import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { Conversation as DBConversation, Message as DBMessage } from '@/lib/db/types';

// Extended type for UI
export interface UIConversation extends DBConversation {
  messages: DBMessage[];
  lastMessage?: string; // Derived
}

export { DBMessage as Message };

interface ChatState {
  conversations: UIConversation[];
  sendMessage: (conversationId: string, text: string, senderId: string) => Promise<void>;
  createConversation: (subject: string, initialMessage: string, customerId: string, customerName?: string, bookingId?: string) => Promise<string>;
  toggleStatus: (conversationId: string) => Promise<void>;
  fetchConversations: (customerId?: string) => Promise<void>;
}

type ConversationRow = {
  id: string;
  customer_id: string;
  booking_id: string | null;
  subject: string;
  status: 'open' | 'closed' | null;
  last_message_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string | null;
  is_read: boolean | null;
};

function mapConversationRow(row: ConversationRow): DBConversation {
  return {
    id: row.id,
    customerId: row.customer_id,
    bookingId: row.booking_id ?? undefined,
    subject: row.subject,
    status: (row.status ?? 'open') as DBConversation['status'],
    lastMessageAt: row.last_message_at ?? row.created_at ?? new Date().toISOString(),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function mapMessageRow(row: MessageRow): DBMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at ?? new Date().toISOString(),
    isRead: row.is_read ?? false,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],

  fetchConversations: async (customerIdParam) => {
    try {
      console.log('[chatStore] fetchConversations', { customerIdParam: customerIdParam ?? null });

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[chatStore] auth.getUser error', authError);
      }

      const customerId = customerIdParam ?? authData.user?.id ?? '';
      if (!customerId) {
        set({ conversations: [] });
        return;
      }

      const { data: convRows, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId)
        .order('last_message_at', { ascending: false });

      if (convError) {
        console.error('[chatStore] conversations select error', convError);
        throw new Error(convError.message);
      }

      const convs: ConversationRow[] = (convRows ?? []) as ConversationRow[];
      const uiConvs: UIConversation[] = await Promise.all(
        convs.map(async (row: ConversationRow): Promise<UIConversation> => {
          const c = mapConversationRow(row);

          const { data: msgRows, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: true });

          if (msgError) {
            console.error('[chatStore] messages select error', msgError);
            throw new Error(msgError.message);
          }

          const msgs: DBMessage[] = ((msgRows ?? []) as MessageRow[]).map(mapMessageRow);
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1]?.text ?? '' : '';

          return {
            ...c,
            messages: msgs,
            lastMessage: lastMsg,
          };
        })
      );

      set({ conversations: uiConvs });
    } catch (e) {
      console.error('[chatStore] fetchConversations failed', e);
    }
  },

  createConversation: async (subject, initialMessage, customerIdParam, customerName, bookingId) => {
    try {
      console.log('[chatStore] createConversation', { subject, hasInitialMessage: Boolean(initialMessage) });

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[chatStore] auth.getUser error', authError);
      }

      const customerId = customerIdParam ?? authData.user?.id ?? '';
      if (!customerId) {
        throw new Error('Not authenticated');
      }

      const nowIso = new Date().toISOString();

      const { data: insertedConv, error: insertConvError } = await supabase
        .from('conversations')
        .insert({
          customer_id: customerId,
          booking_id: bookingId ?? null,
          subject,
          status: 'open',
          last_message_at: nowIso,
        })
        .select('*')
        .single();

      if (insertConvError) {
        console.error('[chatStore] insert conversation error', insertConvError);
        throw new Error(insertConvError.message);
      }

      const convRow = insertedConv as ConversationRow;
      const conv = mapConversationRow(convRow);

      if (initialMessage.trim()) {
        await get().sendMessage(conv.id, initialMessage.trim(), customerId);
      }

      await get().fetchConversations(customerId);
      return conv.id;
    } catch (e) {
      console.error('[chatStore] createConversation failed', e);
      return '';
    }
  },

  sendMessage: async (conversationId, text, senderIdParam) => {
    try {
      const trimmed = text.trim();
      if (!trimmed) return;

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[chatStore] auth.getUser error', authError);
      }

      const senderId = senderIdParam ?? authData.user?.id ?? '';
      if (!senderId) {
        throw new Error('Not authenticated');
      }

      const nowIso = new Date().toISOString();

      const { data: insertedMsg, error: insertMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          text: trimmed,
          is_read: false,
        })
        .select('*')
        .single();

      if (insertMsgError) {
        console.error('[chatStore] insert message error', insertMsgError);
        throw new Error(insertMsgError.message);
      }

      const { error: convUpdateError } = await supabase
        .from('conversations')
        .update({ last_message_at: nowIso })
        .eq('id', conversationId);

      if (convUpdateError) {
        console.error('[chatStore] update conversation last_message_at error', convUpdateError);
      }

      const msg = mapMessageRow(insertedMsg as MessageRow);

      const { conversations } = get();
      const updated = conversations.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: [...c.messages, msg],
            lastMessage: msg.text,
            lastMessageAt: msg.createdAt,
          };
        }
        return c;
      });

      set({ conversations: updated });
    } catch (e) {
      console.error('[chatStore] sendMessage failed', e);
    }
  },

  toggleStatus: async (conversationId) => {
    try {
      const current = get().conversations.find((c) => c.id === conversationId);
      if (!current) return;

      const nextStatus: DBConversation['status'] = current.status === 'open' ? 'closed' : 'open';

      const { error } = await supabase
        .from('conversations')
        .update({ status: nextStatus })
        .eq('id', conversationId);

      if (error) {
        console.error('[chatStore] toggleStatus error', error);
        return;
      }

      set({
        conversations: get().conversations.map((c) => (c.id === conversationId ? { ...c, status: nextStatus } : c)),
      });
    } catch (e) {
      console.error('[chatStore] toggleStatus failed', e);
    }
  },
}));
