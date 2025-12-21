import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';

export default function BookingsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  const adminBookings = useBookingStore((s) => s.adminBookings);
  const isLoading = useBookingStore((s) => s.isLoading);
  const error = useBookingStore((s) => s.error);
  const adminFetchAllBookings = useBookingStore((s) => s.adminFetchAllBookings);

  useEffect(() => {
    adminFetchAllBookings();
  }, [adminFetchAllBookings]);

  const filtered = useMemo(() => {
    return adminBookings.filter((b) => (filter === 'all' ? true : b.status === filter));
  }, [adminBookings, filter]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const renderItem = ({ item }: { item: BookingRow }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/admin/booking/${item.id}`)} testID={`admin-booking-${item.id}`}>
      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.ref}>#{item.id.slice(0, 8)}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
          <Text style={styles.userId} numberOfLines={1}>
            user: {item.user_id}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.tab, filter === f && styles.activeTab]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.activeTabText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} testID="adminBookingsLoading" />
      ) : error ? (
        <View style={styles.empty} testID="adminBookingsError">
          <Text style={styles.emptyText}>Failed to load bookings.</Text>
          <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>{error.message}</Text>
          <TouchableOpacity style={[styles.tab, { marginTop: 16 }]} onPress={() => adminFetchAllBookings()} testID="adminBookingsRetry">
            <Text style={styles.tabText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => adminFetchAllBookings()} tintColor={Colors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="adminBookingsEmpty">
              <Text style={styles.emptyText}>No bookings found</Text>
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
  tabs: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: Colors.tint,
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ref: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  userId: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  },
});
