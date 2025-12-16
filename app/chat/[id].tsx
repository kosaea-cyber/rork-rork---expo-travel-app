import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { type Message, type SendMode, useChatStore } from '@/store/chatStore';
import { resolveAutoReplyText } from '@/lib/chat/autoReplyTemplates';
import { useProfileStore } from '@/store/profileStore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useI18nStore((state) => state.t);

  const routeConversationId = String(id ?? '');

  const {
    conversations,
    messagesByConversationId,
    fetchMessages,
    sendMessage,
    subscribeToConversation,
    getOrCreatePrivateConversation,
    markConversationReadForAdmin,
    markConversationReadForUser,
    error: chatError,
  } = useChatStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);

  const [resolvedConversationId, setResolvedConversationId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isAdmin) {
        setResolvedConversationId(routeConversationId);
        return;
      }

      if (!user) {
        setResolvedConversationId('');
        return;
      }

      const conv = await getOrCreatePrivateConversation();
      if (!cancelled) {
        setResolvedConversationId(conv?.id ?? '');
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [getOrCreatePrivateConversation, isAdmin, routeConversationId, user]);

  const conversationId = isAdmin ? routeConversationId : resolvedConversationId;

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversationId, conversations]
  );

  const messages = messagesByConversationId[conversationId] ?? [];

  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const bannerText = useMemo(() => {
    if (conversation?.type !== 'public') return null;
    return resolveAutoReplyText({ categoryKey: 'general', preferredLanguage: preferredLanguage ?? 'en' });
  }, [conversation?.type, preferredLanguage]);

  const [text, setText] = useState<string>('');
  const flatListRef = useRef<FlatList<Message>>(null);

  const mode: SendMode = useMemo(() => {
    if (isAdmin) return 'admin';
    if (conversation?.type === 'public') return user ? 'public_auth' : 'public_guest';
    return 'private_user';
  }, [conversation?.type, isAdmin, user]);

  useEffect(() => {
    if (!conversationId) return;
    void fetchMessages(conversationId, 60);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;

    if (isAdmin) {
      void markConversationReadForAdmin(conversationId);
    } else {
      void markConversationReadForUser(conversationId);
    }
  }, [conversationId, isAdmin, markConversationReadForAdmin, markConversationReadForUser]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToConversation(conversationId);
    return unsub;
  }, [conversationId, subscribeToConversation]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 120);
  }, [conversationId]);

  useEffect(() => {
    if (!messages.length) return;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!conversationId) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const sent = await sendMessage(conversationId, trimmed, mode);
      if (sent) {
        setText('');
        return;
      }

      const msg = chatError ?? 'Failed to send message';
      console.error('[chat] error', msg);
      Alert.alert('Error', msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat] error', msg);
      Alert.alert('Error', msg);
    }
  }, [chatError, conversationId, mode, sendMessage, text]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.senderType === 'user' && item.senderId && item.senderId === user?.id;

      return (
        <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.adminMessage]}>
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.adminMessageText]}>
            {item.body}
          </Text>
          <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.adminTimeText]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    },
    [user?.id]
  );

  if (!conversationId) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>{user ? 'Conversation not found' : 'Please sign in to chat with support'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{conversation?.type === 'public' ? 'Public chat' : 'Support chat'}</Text>
      </View>

      {bannerText ? (
        <View style={styles.systemBanner} testID="chat.publicBanner">
          <Text style={styles.systemBannerText}>{bannerText}</Text>
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('sendMessage')}
            placeholderTextColor={Colors.textSecondary}
            testID="chat.input"
          />
          <TouchableOpacity
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
            testID="chat.send"
          >
            <Send color={Colors.background} size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerTitle: {
    color: Colors.tint,
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  systemBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  systemBannerText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.tint,
    borderBottomRightRadius: 2,
  },
  adminMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  userMessageText: {
    color: Colors.background,
  },
  adminMessageText: {
    color: Colors.text,
  },
  timeText: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(10, 25, 47, 0.6)',
  },
  adminTimeText: {
    color: Colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
