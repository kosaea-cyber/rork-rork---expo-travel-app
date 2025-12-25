import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

  // تحميل مستقل لزر Create Public Chat
  const [creatingPublic, setCreatingPublic] = useState(false);

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
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
    setCreatingPublic(true);

    try {
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
    } finally {
      setCreatingPublic(false);
    }
  }, [adminCreatePublicConversationIfMissing, load, router]);

  const header = useMemo(() => (
    <View style={styles.headerWrap}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Conversations</Text>

        <Pressable
          testID="adminMessages.createPublic"
          style={({ pressed }) => [
            styles.createBtn,
            pressed && { opacity: 0.9 },
            creatingPublic && { opacity: 0.7 },
          ]}
          onPress={onCreatePublic}
          disabled={creatingPublic}
        >
          {creatingPublic ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.background} />
          )}
          <Text style={styles.createBtnText}>
            {creatingPublic ? 'Creating…' : 'Create Public Chat'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.legendRow}>
        <Text style={[styles.legendCell, { flex: 0.9 }]}>Type</Text>
        <Text style={[styles.legendCell, { flex: 1.35 }]}>Customer</Text>
        <Text style={[styles.legendCell, { flex: 1.1, textAlign: 'right' }]}>Last</Text>
      </View>
    </View>
  ), [creatingPublic, onCreatePublic]);

  const empty = useMemo(() => {
    if (ui.status === 'loading') {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={colors.tint} />
          <Text style={styles.stateTitle}>Loading conversations…</Text>
        </View>
      );
    }

    if (ui.status === 'error') {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Couldn’t load conversations</Text>
          <Text style={styles.stateText}>{ui.message}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh" size={16} color={colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateTitle}>No conversations yet</Text>
        <Text style={styles.stateText}>
          Create a public chat, or wait for customers to message you.
        </Text>
      </View>
    );
  }, [load, ui]);

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      const chipBg = item.type === 'public' ? '#1D4ED8' : '#0F766E';
      const last = item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : '—';

      return (
        <Pressable
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
    flexGrow: 1,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    gap: 10,
  },
  legendCell: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeChip: {
    flex: 0.9,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
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
    textAlign: 'right',
  },
  stateWrap: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
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
  },
});
