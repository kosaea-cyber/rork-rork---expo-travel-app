import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { Conversation, User } from '@/lib/db/types';

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<(Conversation & { customerName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const convs = await db.conversations.findMany();
    
    // Enrich with customer names
    const enriched = await Promise.all(convs.map(async (c) => {
      const u = await db.users.findUnique({ id: c.customerId });
      return { ...c, customerName: u ? u.name : 'Unknown User' };
    }));
    
    setConversations(enriched);
    setLoading(false);
  };

  const renderItem = ({ item }: { item: Conversation & { customerName: string } }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/admin/message/${item.id}`)}
    >
      <View style={styles.header}>
        <Text style={styles.subject}>{item.subject}</Text>
        <Text style={styles.date}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.customer}>{item.customerName}</Text>
      <View style={[styles.badge, { backgroundColor: item.status === 'open' ? '#4CAF50' : '#999' }]}>
        <Text style={styles.badgeText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Messages</Text>
      </View>
      
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>No conversations yet</Text>
          </View>
        }
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
});
