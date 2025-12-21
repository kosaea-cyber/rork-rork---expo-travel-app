export type AiConversationType = 'public' | 'private';

export type AiGenerateReplyInput = {
  conversationId: string;
  conversationType: AiConversationType;
  userMessage: string;
  systemPrompt?: string | null;
};

export interface AiProvider {
  generateReply: (input: AiGenerateReplyInput) => Promise<string | null>;
}

const defaultProvider: AiProvider = {
  generateReply: async () => {
    return null;
  },
};

export const aiProvider: AiProvider = defaultProvider;
