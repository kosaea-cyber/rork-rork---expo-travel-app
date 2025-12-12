import { create } from 'zustand';
import { trpcVanilla } from '@/lib/trpc';
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

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],

  fetchConversations: async (customerId) => {
    try {
      // Assuming user context
      const convs = await trpcVanilla.chat.listMyConversations.query();
      
      const uiConvs: UIConversation[] = await Promise.all(convs.map(async (c) => {
        // Fetch details (messages)
        const details = await trpcVanilla.chat.getConversation.query({ id: c.id });
        const msgs = details.messages;
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].text : '';
        return {
          ...c,
          messages: msgs,
          lastMessage: lastMsg
        };
      }));
      
      set({ conversations: uiConvs });
    } catch (e) {
      console.error(e);
    }
  },

  createConversation: async (subject, initialMessage, customerId, customerName, bookingId) => {
    // Note: customerId and customerName ignored as backend uses ctx.user
    
    const newConv = await trpcVanilla.chat.createConversation.mutate({ subject });
    
    // Send initial message
    await trpcVanilla.chat.sendMessage.mutate({
        conversationId: newConv.id,
        text: initialMessage
    });
    
    // Refresh list or update state manually
    // We need to fetch the message we just sent to get ID/timestamp
    // But sendMessage returns the message.
    
    // Let's just refetch all for simplicity
    await get().fetchConversations();
    
    return newConv.id;
  },

  sendMessage: async (conversationId, text, senderId) => {
    const msg = await trpcVanilla.chat.sendMessage.mutate({
        conversationId,
        text
    });
    
    // Update local state
    const { conversations } = get();
    const updated = conversations.map(c => {
        if (c.id === conversationId) {
            return {
                ...c,
                messages: [...c.messages, msg],
                lastMessage: text,
                lastMessageAt: msg.createdAt
            };
        }
        return c;
    });
    
    set({ conversations: updated });
  },

  toggleStatus: async (conversationId) => {
    // Not implemented in chat router yet (only admin?)
    // If admin, we need admin router or protected route
    // Assuming we skip this for now or implement if needed
  }
}));
