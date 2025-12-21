import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCirclePlus, RefreshCw } from 'lucide-react-native';

import colors from '@/constants/colors';
import { type Conversation, useChatStore } from '@/store/chatStore';

type RowItem = Conversation;

type UiState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

const PAGE_LIMIT = 60;

function formatCustomer(customerId: string | null): string {
  if (!customerId) return '—';
  if (customerId.length <= 10) return customerId;
  return `${customerId.slice(0, 6)}…${customerId.slice(-4)}`;
}

export default function AdminMessagesPage() {
  const router = useRouter();

  const { adminFetchConversations, adminCreatePublicConversationIfMissing } = useChatStore();

  const [items, setItems] = useState<RowItem[]>([]);
  const [ui, setUi] = useState<UiState>({ status: 'loading' });

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      console.log('[admin/messages] load conversations');
      const data = await adminFetchConversations(PAGE_LIMIT);
      setItems(data);
      setUi({ status: 'ready' });
    } catch (e) {
      console.error('[admin/messages] load failed', e);
      setItems([]);
      setUi({ status: 'error', message: 'Failed to load conversations. Please try again.' });
    }
  }, [adminFetchConversations]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreatePublic = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      console.log('[admin/messages] create public chat');
      const conv = await adminCreatePublicConversationIfMissing();
      if (conv) {
        await load();
        router.push(`/admin/message/${conv.id}`);
        return;
      }

      setUi({ status: 'error', message: 'Could not create public chat. Please try again.' });
    } catch (e) {
      console.error('[admin/messages] create public chat failed', e);
      setUi({ status: 'error', message: 'Could not create public chat. Please try again.' });
    }
  }, [adminCreatePublicConversationIfMissing, load, router]);

  const header = useMemo(() => {
    return (
      <View style={styles.headerWrap}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Conversations</Text>
          <Pressable testID="adminMessages.createPublic" style={styles.createBtn} onPress={onCreatePublic}>
            <MessageCirclePlus size={18} color={colors.background} />
            <Text style={styles.createBtnText}>Create Public Chat</Text>
          </Pressable>
        </View>

        <View style={styles.legendRow}>
          <Text style={[styles.legendCell, { flex: 0.9 }]}>Type</Text>
          <Text style={[styles.legendCell, { flex: 1.35 }]}>Customer</Text>
          <Text style={[styles.legendCell, { flex: 1.1, textAlign: 'right' }]}>Last</Text>
        </View>
      </View>
    );
  }, [onCreatePublic]);

  const empty = useMemo(() => {
    if (ui.status === 'loading') {
      return (
        <View style={styles.stateWrap} testID="adminMessages.loading">
          <ActivityIndicator color={colors.tint} />
          <Text style={styles.stateTitle}>Loading conversations…</Text>
        </View>
      );
    }

    if (ui.status === 'error') {
      return (
        <View style={styles.stateWrap} testID="adminMessages.error">
          <Text style={styles.stateTitle}>Couldn’t load conversations</Text>
          <Text style={styles.stateText}>{ui.message}</Text>
          <Pressable testID="adminMessages.retry" style={styles.retryBtn} onPress={load}>
            <RefreshCw size={16} color={colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.stateWrap} testID="adminMessages.empty">
        <Text style={styles.stateTitle}>No conversations yet</Text>
        <Text style={styles.stateText}>Create a public chat, or wait for customers to message you.</Text>
      </View>
    );
  }, [load, ui]);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      const chipBg = item.type === 'public' ? '#1D4ED8' : '#0F766E';
      const last = item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : '—';

      return (
        <Pressable
          testID={`adminMessages.row.${item.id}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/admin/message/${item.id}`)}
        >
          <View style={[styles.typeChip, { backgroundColor: chipBg }]}>
            <Text style={styles.typeChipText}>{item.type}</Text>
          </View>

          <Text style={styles.customerText} numberOfLines={1}>
            {formatCustomer(item.customerId)}
          </Text>

          <Text style={styles.lastText} numberOfLines={1}>
            {last}
          </Text>
        </Pressable>
      );
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        refreshing={ui.status === 'loading'}
        onRefresh={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  createBtnText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 13,
  },
  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendCell: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  typeChip: {
    flex: 0.9,
    maxWidth: 88,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  typeChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  customerText: {
    flex: 1.35,
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  lastText: {
    flex: 1.1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  stateWrap: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
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
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  retryText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 13,
  },
});
