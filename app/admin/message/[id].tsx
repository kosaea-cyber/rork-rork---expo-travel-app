import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshCw, Send } from 'lucide-react-native';

import colors from '@/constants/colors';
import { type Conversation, type Message, useChatStore } from '@/store/chatStore';

type UiState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

const INITIAL_LIMIT = 80;
const EMPTY_MESSAGES: Message[] = [];

function formatCustomerFull(customerId: string | null): string {
  if (!customerId) return 'Guest / Anonymous';
  return customerId;
}

export default function AdminConversationDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const conversationId = String(id ?? '');

  const {
    conversations,
    messagesByConversationId,
    adminGetConversationById,
    fetchMessages,
    sendMessage,
    subscribeToConversation,
    markConversationReadForAdmin,
  } = useChatStore();

  const [ui, setUi] = useState<UiState>({ status: 'loading' });
  const [text, setText] = useState<string>('');

  const flatListRef = useRef<FlatList<Message>>(null);

  const conversation: Conversation | null = useMemo(() => {
    if (!conversationId) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const messages = useMemo(() => {
    if (!conversationId) return EMPTY_MESSAGES;
    return messagesByConversationId[conversationId] ?? EMPTY_MESSAGES;
  }, [conversationId, messagesByConversationId]);

  const load = useCallback(async () => {
    if (!conversationId) return;

    setUi({ status: 'loading' });

    try {
      console.log('[admin/message] load', { conversationId });
      await adminGetConversationById(conversationId);
      await fetchMessages(conversationId, INITIAL_LIMIT);
      setUi({ status: 'ready' });
    } catch (e) {
      console.error('[admin/message] load failed', e);
      setUi({ status: 'error', message: 'Failed to load conversation. Please try again.' });
    }
  }, [adminGetConversationById, conversationId, fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;
    void load();
  }, [conversationId, load]);

  useEffect(() => {
    if (!conversationId) return;
    void markConversationReadForAdmin(conversationId);
  }, [conversationId, markConversationReadForAdmin]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToConversation(conversationId);
    return unsub;
  }, [conversationId, subscribeToConversation]);

  useEffect(() => {
    if (!messages.length) return;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, [messages.length]);

  const header = useMemo(() => {
    const typeLabel = conversation?.type ?? '—';
    const chipBg = conversation?.type === 'public' ? '#1D4ED8' : '#0F766E';
    const customer = formatCustomerFull(conversation?.customerId ?? null);

    return (
      <View style={styles.headerWrap}>
        <View style={styles.headerTopRow}>
          <View style={[styles.typeChip, { backgroundColor: chipBg }]}>
            <Text style={styles.typeChipText}>{typeLabel}</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversation?.type === 'public' ? 'Public chat' : 'Private chat'}
          </Text>
          <Pressable
            testID="adminMessage.refresh"
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={load}
          >
            <RefreshCw size={18} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.headerSub} numberOfLines={1}>
          Customer: {customer}
        </Text>
      </View>
    );
  }, [conversation?.customerId, conversation?.type, load]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isAdmin = item.senderType === 'admin';

    return (
      <View style={[styles.bubbleWrap, isAdmin ? styles.adminWrap : styles.userWrap]}>
        <View style={[styles.bubble, isAdmin ? styles.adminBubble : styles.userBubble]}>
          <Text style={[styles.bodyText, isAdmin ? styles.adminBody : styles.userBody]}>{item.body}</Text>
          <Text style={[styles.timeText, isAdmin ? styles.adminTime : styles.userTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }, []);

  const onSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId) return;

    console.log('[admin/message] send', { conversationId, len: trimmed.length });
    const res = await sendMessage(conversationId, trimmed, 'admin');
    if (res) setText('');
  }, [conversationId, sendMessage, text]);

  const content = useMemo(() => {
    if (!conversationId) {
      return (
        <View style={styles.stateWrap} testID="adminMessage.noId">
          <Text style={styles.stateTitle}>Conversation not found</Text>
          <Pressable testID="adminMessage.goBack" style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      );
    }

    if (ui.status === 'loading') {
      return (
        <View style={styles.stateWrap} testID="adminMessage.loading">
          <ActivityIndicator color={colors.tint} />
          <Text style={styles.stateTitle}>Loading…</Text>
        </View>
      );
    }

    if (ui.status === 'error') {
      return (
        <View style={styles.stateWrap} testID="adminMessage.error">
          <Text style={styles.stateTitle}>Couldn’t load conversation</Text>
          <Text style={styles.stateText}>{ui.message}</Text>
          <Pressable testID="adminMessage.retry" style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          testID="adminMessage.list"
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <View style={styles.inputBar}>
            <TextInput
              testID="adminMessage.input"
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Reply as admin…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <Pressable
              testID="adminMessage.send"
              style={({ pressed }) => [styles.sendBtn, (!text.trim() || pressed) && { opacity: !text.trim() ? 0.5 : 0.85 }]}
              onPress={onSend}
              disabled={!text.trim()}
            >
              <Send size={18} color={colors.background} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </>
    );
  }, [conversationId, header, load, messages, onSend, renderMessage, router, text, ui]);

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  headerSub: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChip: {
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  typeChipText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 14,
  },
  bubbleWrap: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
  },
  adminWrap: {
    justifyContent: 'flex-end',
  },
  userWrap: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  adminBubble: {
    backgroundColor: colors.tint,
    borderBottomRightRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  adminBody: {
    color: colors.background,
  },
  userBody: {
    color: colors.text,
  },
  timeText: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    alignSelf: 'flex-end',
  },
  adminTime: {
    color: 'rgba(10, 25, 47, 0.6)',
  },
  userTime: {
    color: colors.textSecondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1,
  },
  stateTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 13,
  },
});
