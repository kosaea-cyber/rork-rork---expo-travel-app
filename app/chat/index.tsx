import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { type Conversation, useChatStore } from '@/store/chatStore';

type UiState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

export default function ChatListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const { conversations, getPublicConversation, getOrCreatePrivateConversation, subscribeToConversation } = useChatStore();

  const [ui, setUi] = useState<UiState>({ status: 'loading' });
  const [conversationIds, setConversationIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      console.log('[chat:list] load', { hasUser: Boolean(user), isAdmin });

      const ids: string[] = [];

      if (isAdmin) {
        const conv = await getPublicConversation();
        if (!conv?.id) {
          setUi({ status: 'error', message: 'Public chat is not configured yet. Please contact support.' });
          return;
        }
        ids.push(conv.id);
      } else {
        if (!user) {
          console.log('[chat:list] guest -> signInAnonymously');
          const { data: sessionData } = await supabase.auth.getSession();
          const hasSession = Boolean(sessionData.session);
          if (!hasSession) {
            const { error: anonErr } = await supabase.auth.signInAnonymously();
            if (anonErr) throw anonErr;
          }
        }

        const conv = await getOrCreatePrivateConversation();
        if (!conv?.id) {
          setUi({ status: 'error', message: 'Could not load your messages. Please try again.' });
          return;
        }
        ids.push(conv.id);
      }

      setConversationIds(ids);
      setUi({ status: 'ready' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error';
      console.error('[chat:list] load failed', { msg, e });
      setUi({ status: 'error', message: msg });
    }
  }, [getOrCreatePrivateConversation, getPublicConversation, isAdmin, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (conversationIds.length === 0) return;

    const unsubs = conversationIds.map((id) => subscribeToConversation(id));
    return () => {
      for (const u of unsubs) u();
    };
  }, [conversationIds, subscribeToConversation]);

  const data = useMemo<Conversation[]>(() => {
    const map = new Map(conversations.map((c) => [c.id, c] as const));
    return conversationIds
      .map((id) => map.get(id))
      .filter((c): c is Conversation => Boolean(c))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [conversationIds, conversations]);

  const openConversation = useCallback(
    (conversationId: string) => {
      router.push(`/chat/${conversationId}` as any);
    },
    [router]
  );

  if (ui.status === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.emptyText}>Loading messages…</Text>
        </View>
      </View>
    );
  }

  if (ui.status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{ui.message}</Text>
          <Pressable
            testID="chat.list.retry"
            onPress={load}
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const title = item.type === 'public' ? 'Public chat' : 'Support';
          const preview = item.lastMessagePreview ?? 'No messages yet.';

          return (
            <Pressable
              testID={`chat.list.item.${item.id}`}
              onPress={() => openConversation(item.id)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{title.slice(0, 1).toUpperCase()}</Text>
              </View>

              <View style={styles.content}>
                <View style={styles.header}>
                  <Text style={styles.subject} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.time}>
                    {new Date(item.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {preview}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 0,
  },
  item: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  preview: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 76, // Align with content
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
