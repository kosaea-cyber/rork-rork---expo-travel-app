import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';

type UiState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'admin_list' };

export default function ChatListScreen() {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const { conversations, getPublicConversation } = useChatStore();

  const [ui, setUi] = useState<UiState>({ status: 'loading' });

  const openChat = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      const { data: sessionRes, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[chat] error', sessionError);
      }

      const session = sessionRes.session ?? null;
      console.log('[chat] session?', !!session);

      if (!session) {
        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('type', 'public')
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) {
          console.error('[chat] error', error);
          setUi({ status: 'error', message: error.message });
          return;
        }

        const conversationId = (data?.[0]?.id ?? '') as string;
        if (!conversationId) {
          setUi({ status: 'error', message: 'Public chat is not configured yet. Please contact support.' });
          return;
        }

        console.log('[chat] conversationId', conversationId);
        router.replace(`/chat/${conversationId}` as any);
        return;
      }

      const userId = session.user.id;

      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('type', 'private')
        .eq('customer_id', userId)
        .limit(1);

      if (existingError) {
        console.error('[chat] error', existingError);
        setUi({ status: 'error', message: existingError.message });
        return;
      }

      const existingId = (existing?.[0]?.id ?? '') as string;

      if (existingId) {
        console.log('[chat] conversationId', existingId);
        router.replace(`/chat/${existingId}` as any);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('conversations')
        .insert({ type: 'private', customer_id: userId })
        .select('id')
        .single();

      if (insertError) {
        console.error('[chat] error', insertError);
        setUi({ status: 'error', message: insertError.message });
        return;
      }

      const conversationId = (inserted?.id ?? '') as string;
      if (!conversationId) {
        setUi({ status: 'error', message: 'Failed to create a conversation. Please try again.' });
        return;
      }

      console.log('[chat] conversationId', conversationId);
      router.replace(`/chat/${conversationId}` as any);
    } catch (e) {
      console.error('[chat] error', e);
      setUi({ status: 'error', message: e instanceof Error ? e.message : 'Unexpected error' });
    }
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      setUi({ status: 'admin_list' });
      void getPublicConversation();
      return;
    }

    void openChat();
  }, [getPublicConversation, isAdmin, openChat]);

  const adminListData = useMemo(() => conversations, [conversations]);

  if (ui.status === 'admin_list') {
    return (
      <View style={styles.container}>
        {adminListData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet.</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Open messages from Admin → Messages.</Text>
          </View>
        )}
      </View>
    );
  }

  if (ui.status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{ui.message}</Text>
          <Pressable
            testID="chat.open.retry"
            onPress={openChat}
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
      <View style={styles.emptyContainer}>
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.emptyText}>Opening chat…</Text>
      </View>
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
