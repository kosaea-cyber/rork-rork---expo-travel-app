import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { resolveAutoReplyText } from '@/lib/chat/autoReplyTemplates';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { type Message, type SendMode, useChatStore } from '@/store/chatStore';
import { useProfileStore } from '@/store/profileStore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useI18nStore((state) => state.t);

  const routeConversationId = String(id ?? '');

  const {
    conversations,
    messagesByConversationId,
    hasMoreByConversationId,
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
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isAdmin) {
        setResolvedConversationId(routeConversationId);
        return;
      }

      console.log('[chat] non-admin open -> ensure anonymous/private conversation');

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSession = Boolean(sessionData.session);

        if (!hasSession) {
          const { error: anonErr } = await supabase.auth.signInAnonymously();
          if (anonErr) throw anonErr;
        }

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.warn('[chat] auth.getUser failed', userErr);
        }

        const uid = userData.user?.id ?? '';
        if (!cancelled) setCurrentUserId(uid);

        const conv = await getOrCreatePrivateConversation();
        if (!cancelled) {
          setResolvedConversationId(conv?.id ?? '');
        }
      } catch (e) {
        console.error('[chat] ensure private conversation failed', e);
        if (!cancelled) {
          setResolvedConversationId('');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [getOrCreatePrivateConversation, isAdmin, routeConversationId]);

  const conversationId = isAdmin ? routeConversationId : resolvedConversationId;

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversationId, conversations]
  );

  const messages = useMemo<Message[]>(() => {
    if (!conversationId) return [];
    return messagesByConversationId[conversationId] ?? [];
  }, [conversationId, messagesByConversationId]);

  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const bannerText = useMemo(() => {
    if (conversation?.type !== 'public') return null;
    return resolveAutoReplyText({ categoryKey: 'general', preferredLanguage: preferredLanguage ?? 'en' });
  }, [conversation?.type, preferredLanguage]);

  const [text, setText] = useState<string>('');
  const [toast, setToast] = useState<string>('');
  const lastSendAtRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }, []);
  const flatListRef = useRef<FlatList<Message>>(null);

  const hasMore = useMemo(() => {
    if (!conversationId) return false;
    return hasMoreByConversationId[conversationId] ?? false;
  }, [conversationId, hasMoreByConversationId]);

  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  const onLoadOlder = useCallback(async () => {
    if (!conversationId) return;
    const oldest = messages[0]?.createdAt ?? null;
    if (!oldest) return;

    try {
      setIsLoadingOlder(true);
      console.log('[chat] load older', { conversationId, before: oldest });
      await fetchMessages(conversationId, 30, oldest);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, fetchMessages, messages]);

  const mode: SendMode = useMemo(() => {
    if (isAdmin) return 'admin';
    if (conversation?.type === 'public') return user ? 'public_auth' : 'public_guest';
    return 'private_user';
  }, [conversation?.type, isAdmin, user]);

  useEffect(() => {
    if (!conversationId) return;
    void fetchMessages(conversationId, 30);
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

    if (conversation?.type === 'public' && !user) {
      showToast('Please sign in to send messages.');
      return;
    }

    const now = Date.now();
    if (now - lastSendAtRef.current < 3000) {
      showToast('Please wait a moment');
      return;
    }
    lastSendAtRef.current = now;

    try {
      const sent = await sendMessage(conversationId, trimmed, mode);
      if (sent) {
        setText('');
        return;
      }

      if (chatError === 'rate_limited') {
        showToast('Please wait a moment');
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
  }, [chatError, conversation?.type, conversationId, mode, sendMessage, showToast, text, user]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isSystem = item.senderType === 'system';
      const isAdminSender = item.senderType === 'admin';

      const effectiveUserId = user?.id ?? currentUserId;

      const isFromCurrentUser =
        item.senderType === 'user' &&
        ((effectiveUserId ? item.senderId === effectiveUserId : false) || (effectiveUserId === '' && item.senderId == null));

      const containerStyle = isFromCurrentUser
        ? styles.userMessage
        : isSystem
          ? styles.systemMessage
          : styles.adminMessage;

      const textStyle = isFromCurrentUser
        ? styles.userMessageText
        : isSystem
          ? styles.systemMessageText
          : styles.adminMessageText;

      const timeStyle = isFromCurrentUser
        ? styles.userTimeText
        : isSystem
          ? styles.systemTimeText
          : styles.adminTimeText;

      const badgeText = isSystem ? 'SYSTEM' : isAdminSender ? 'ADMIN' : null;

      return (
        <View style={[styles.messageContainer, containerStyle]} testID={`chat.message.${item.id}`}>
          {badgeText ? (
            <View style={styles.senderBadge} testID={`chat.message.badge.${item.id}`}>
              <Text style={styles.senderBadgeText}>{badgeText}</Text>
            </View>
          ) : null}

          <Text style={[styles.messageText, textStyle]}>{item.body}</Text>
          <Text style={[styles.timeText, timeStyle]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    },
    [currentUserId, user]
  );

  if (!conversationId) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>Conversation not found</Text>
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
        ListHeaderComponent={
          messages.length > 0 && hasMore ? (
            <TouchableOpacity
              testID="chat.loadOlder"
              onPress={onLoadOlder}
              disabled={isLoadingOlder}
              style={[styles.loadOlderBtn, isLoadingOlder ? { opacity: 0.6 } : null]}
            >
              <Text style={styles.loadOlderText}>{isLoadingOlder ? 'Loading…' : 'Load older'}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, conversation?.type === 'public' && !user ? styles.inputDisabled : null]}
            value={text}
            onChangeText={setText}
            placeholder={conversation?.type === 'public' && !user ? 'Sign in to message' : t('sendMessage')}
            placeholderTextColor={Colors.textSecondary}
            editable={!(conversation?.type === 'public' && !user)}
            testID="chat.input"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || (conversation?.type === 'public' && !user)) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || (conversation?.type === 'public' && !user)}
            testID="chat.send"
          >
            <Send color={Colors.background} size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="chat.toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
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
  loadOlderBtn: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  loadOlderText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
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
  systemMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
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
  systemMessageText: {
    color: Colors.text,
    fontWeight: '700',
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
  systemTimeText: {
    color: 'rgba(10, 25, 47, 0.6)',
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
  inputDisabled: {
    opacity: 0.7,
  },
  senderBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
    backgroundColor: 'rgba(10, 25, 47, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(10, 25, 47, 0.14)',
  },
  senderBadgeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110,
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
