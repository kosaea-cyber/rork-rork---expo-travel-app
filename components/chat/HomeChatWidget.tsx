import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MessageCircle, Send, X } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { resolveAutoReplyText } from '@/lib/chat/autoReplyTemplates';
import type { Conversation, Message } from '@/store/chatStore';
import { useChatStore } from '@/store/chatStore';

type UiMessage = Message;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function HomeChatWidget() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);

  const openAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<UiMessage> | null>(null);

  const {
    isLoading,
    error,
    messagesByConversationId,
    realtimeHealthByConversationId,
    realtimeErrorByConversationId,
    getPublicConversation,
    fetchMessages,
    subscribeToConversation,
    sendMessage,
    markConversationReadForUser,
  } = useChatStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);

  const language = useI18nStore((s) => s.language);
  const publicBannerText = useMemo(() => {
    if (!conversation || conversation.type !== 'public') return null;
    return resolveAutoReplyText({ categoryKey: 'general', preferredLanguage: language });
  }, [conversation, language]);

  const messages = useMemo<UiMessage[]>(() => {
    if (!conversation?.id) return [];
    return messagesByConversationId[conversation.id] ?? [];
  }, [conversation?.id, messagesByConversationId]);

  const realtimeHealth = useMemo(() => {
    const id = conversation?.id;
    if (!id) return 'idle' as const;
    return realtimeHealthByConversationId[id] ?? ('idle' as const);
  }, [conversation?.id, realtimeHealthByConversationId]);

  const realtimeError = useMemo(() => {
    const id = conversation?.id;
    if (!id) return null;
    return realtimeErrorByConversationId[id] ?? null;
  }, [conversation?.id, realtimeErrorByConversationId]);

  const animateOpen = useCallback(
    (nextOpen: boolean) => {
      Animated.timing(openAnim, {
        toValue: nextOpen ? 1 : 0,
        duration: nextOpen ? 220 : 160,
        useNativeDriver: true,
      }).start();
    },
    [openAnim]
  );

  const bootstrap = useCallback(async () => {
    setLocalError(null);
    setIsBootstrapping(true);

    try {
      console.log('[HomeChatWidget] bootstrap');

      const conv = await getPublicConversation();
      if (!conv) {
        const storeErrUnknown: unknown = useChatStore.getState().error;
        const storeErr = typeof storeErrUnknown === 'string' ? storeErrUnknown : null;
        console.error('[HomeChatWidget] no public conversation', storeErrUnknown);

        setLocalError(
          storeErr && storeErr.trim().length > 0
            ? storeErr
            : 'Public chat is not configured yet. Please contact support.'
        );

        setIsBootstrapping(false);
        return;
      }

      setConversation(conv);
      await fetchMessages(conv.id, 30);
      void markConversationReadForUser(conv.id);
      setIsBootstrapping(false);

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    } catch (e) {
      console.error('[HomeChatWidget] bootstrap failed', e);
      const storeErrUnknown: unknown = useChatStore.getState().error;
      const storeErr = typeof storeErrUnknown === 'string' ? storeErrUnknown : null;
      setLocalError(
        storeErr && storeErr.trim().length > 0
          ? storeErr
          : 'Chat is temporarily unavailable. Please try again.'
      );
      setIsBootstrapping(false);
    }
  }, [fetchMessages, getPublicConversation, markConversationReadForUser]);

  useEffect(() => {
    if (!isOpen) return;
    animateOpen(true);
    void bootstrap();
    return;
  }, [animateOpen, bootstrap, isOpen]);

  useEffect(() => {
    if (!isOpen || !conversation?.id) return;

    const unsub = subscribeToConversation(conversation.id);
    return () => {
      try {
        unsub?.();
      } catch (e) {
        console.error('[HomeChatWidget] unsubscribe failed', e);
      }
    };
  }, [conversation?.id, isOpen, subscribeToConversation]);

  useEffect(() => {
    if (!isOpen) {
      animateOpen(false);
    }
  }, [animateOpen, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [isOpen, messages.length]);

  const onOpenPress = useCallback(() => {
    console.log('[HomeChatWidget] open press');
    setIsOpen(true);
  }, []);

  const onClosePress = useCallback(() => {
    console.log('[HomeChatWidget] close press');
    setIsOpen(false);
    setDraft('');
    setLocalError(null);
  }, []);

  const onRetry = useCallback(() => {
    console.log('[HomeChatWidget] retry');
    void bootstrap();
  }, [bootstrap]);

  const onRefresh = useCallback(() => {
    const convId = conversation?.id;
    if (!convId) return;
    console.log('[HomeChatWidget] manual refresh', { convId });
    void fetchMessages(convId, 30);
  }, [conversation?.id, fetchMessages]);

  const onSend = useCallback(async () => {
    const convId = conversation?.id;
    if (!convId) {
      setLocalError('Chat is not ready yet.');
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) return;

    setDraft('');
    setLocalError(null);

    const sent = await sendMessage(convId, trimmed, 'public_guest');
    if (!sent) {
      setLocalError('Failed to send message. Please try again.');
      setDraft(trimmed);
    }
  }, [conversation?.id, draft, sendMessage]);

  const effectiveError = localError ?? error;
  const showLoading = isBootstrapping || isLoading;

  const renderItem = useCallback(({ item }: { item: UiMessage }) => {
    const mine = item.senderType === 'user';

    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>
            {item.body}
          </Text>
          <Text style={[styles.messageMeta, mine ? styles.messageMetaMine : styles.messageMetaTheirs]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((item: UiMessage) => item.id, []);

  const modalTransform = useMemo(() => {
    const translateY = openAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
    const scale = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
    return { translateY, scale };
  }, [openAnim]);

  return (
    <View pointerEvents="box-none" style={styles.root} testID="homeChatWidget">
      <Pressable
        onPress={onOpenPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        testID="homeChatWidgetOpenButton"
      >
        <View style={styles.fabInner}>
          <MessageCircle color={Colors.text} size={22} />
        </View>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={onClosePress}
        statusBarTranslucent
        testID="homeChatWidgetModal"
      >
        <View style={styles.overlay} testID="homeChatWidgetOverlay">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClosePress} testID="homeChatWidgetBackdrop" />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            style={styles.kbRoot}
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY: modalTransform.translateY }, { scale: modalTransform.scale }],
                  opacity: openAnim,
                },
              ]}
              testID="homeChatWidgetSheet"
            >
              <View style={styles.sheetHeader}>
                <View style={styles.headerLeft}>
                  <Text style={styles.sheetTitle} testID="homeChatWidgetTitle">
                    Chat
                  </Text>
                  <Text style={styles.sheetSubtitle} testID="homeChatWidgetGuestLabel">
                    You are chatting as Guest
                  </Text>

                  {realtimeHealth === 'error' ? (
                    <Pressable
                      onPress={onRefresh}
                      style={({ pressed }) => [styles.realtimeBanner, pressed && styles.realtimeBannerPressed]}
                      testID="homeChatWidgetRealtimeFallback"
                    >
                      <Text style={styles.realtimeBannerText}>
                        Realtime unavailable{realtimeError ? `: ${realtimeError}` : ''}. Tap to refresh.
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  onPress={onClosePress}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                  accessibilityRole="button"
                  testID="homeChatWidgetCloseButton"
                >
                  <X color={Colors.textSecondary} size={18} />
                </Pressable>
              </View>

              {effectiveError ? (
                <View style={styles.errorBox} testID="homeChatWidgetError">
                  <Text style={styles.errorTitle}>Something went wrong</Text>
                  <Text style={styles.errorText}>{effectiveError}</Text>
                  <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
                    testID="homeChatWidgetRetryButton"
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.messagesWrap}>
                {publicBannerText ? (
                  <View style={styles.systemBanner} testID="homeChatWidget.publicBanner">
                    <Text style={styles.systemBannerText}>{publicBannerText}</Text>
                  </View>
                ) : null}
                {showLoading && messages.length === 0 ? (
                  <View style={styles.loading} testID="homeChatWidgetLoading">
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={styles.loadingText}>Connecting…</Text>
                  </View>
                ) : (
                  <FlatList
                    ref={(r) => {
                      listRef.current = r;
                    }}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    testID="homeChatWidgetMessagesList"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>

              <View style={styles.composer} testID="homeChatWidgetComposer">
                <View style={styles.inputWrap}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Write a message…"
                    placeholderTextColor={Colors.textSecondary}
                    style={styles.input}
                    multiline
                    testID="homeChatWidgetInput"
                  />
                </View>

                <Pressable
                  onPress={onSend}
                  disabled={!draft.trim() || !conversation?.id}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (!draft.trim() || !conversation?.id) && styles.sendButtonDisabled,
                    pressed && styles.sendButtonPressed,
                  ]}
                  testID="homeChatWidgetSendButton"
                >
                  <Send color={Colors.text} size={18} />
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabPressed: {
    transform: [{ scale: 0.98 }],
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  kbRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sheet: {
    width: '100%',
    maxHeight: '82%',
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  realtimeBanner: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,140,0,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.34)',
  },
  realtimeBannerPressed: {
    transform: [{ scale: 0.99 }],
  },
  realtimeBannerText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  closeButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  errorBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.38)',
  },
  retryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  retryText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  messagesWrap: {
    flex: 1,
    minHeight: 240,
  },
  systemBanner: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  systemBannerText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: 'rgba(212,175,55,0.22)',
    borderColor: 'rgba(212,175,55,0.45)',
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  messageTextMine: {
    color: Colors.text,
  },
  messageTextTheirs: {
    color: Colors.text,
  },
  messageMeta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
  },
  messageMetaMine: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
  },
  messageMetaTheirs: {
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  inputWrap: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
  },
  input: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    maxHeight: 92,
    padding: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
});
