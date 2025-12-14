import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { Conversation, User } from '@/lib/db/types';

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<(Conversation & { customerName: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[admin/messages] loadData');
      const convs = await db.conversations.findMany();

      const enriched = await Promise.all(
        convs.map(async (c) => {
          const u = await db.users.findUnique({ id: c.customerId });
          return { ...c, customerName: u ? u.name : 'Unknown User' };
        })
      );

      setConversations(enriched);
    } catch (e) {
      console.error('[admin/messages] loadData error', e);
      setConversations([]);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation & { customerName: string } }) => (
      <TouchableOpacity
        testID={`admin-message-thread-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/admin/message/${item.id}`)}
      >
        <View style={styles.header}>
          <Text style={styles.subject} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={styles.date}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.customer} numberOfLines={1}>
          {item.customerName}
        </Text>
        <View style={[styles.badge, { backgroundColor: item.status === 'open' ? '#4CAF50' : '#999' }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </TouchableOpacity>
    ),
    [router]
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateWrap} testID="adminMessagesLoading">
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateText}>Loading messages…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateWrap} testID="adminMessagesError">
          <Text style={styles.stateTitle}>Couldn’t load messages</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData} testID="adminMessagesRetry">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.empty} testID="adminMessagesEmpty">
        <Text style={styles.emptyText}>No conversations yet</Text>
      </View>
    );
  }, [error, loadData, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={listEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  pageHeader: {
    padding: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  customer: {
    color: '#666',
    fontSize: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontWeight: '600',
  },
  stateWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.background,
    fontWeight: '800',
  },
});
