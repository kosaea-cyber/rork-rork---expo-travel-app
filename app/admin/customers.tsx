import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Filter, User as UserIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { User } from '@/lib/db/types';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[admin/customers] loadCustomers');
      const allUsers = await db.users.findMany({ role: 'customer' });
      setCustomers(allUsers);
    } catch (e) {
      console.error('[admin/customers] loadCustomers error', e);
      setCustomers([]);
      setError('Failed to load customers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone?.includes(search)
    );
  }, [customers, search]);

  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/admin/customer/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.email}>{item.email}</Text>
        {item.country && <Text style={styles.details}>{item.country}</Text>}
      </View>
      <View style={styles.meta}>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#4CAF50' : '#E91E63' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers Management</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading && customers.length === 0 ? (
        <View style={styles.stateWrap} testID="adminCustomersLoading">
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateText}>Loading customers…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap} testID="adminCustomersError">
          <Text style={styles.stateTitle}>Couldn’t load customers</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCustomers} testID="adminCustomersRetry">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadCustomers}
          ListEmptyComponent={
            <View style={styles.empty} testID="adminCustomersEmpty">
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
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
  toolbar: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#333',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  details: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
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
    marginTop: 14,
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
});
