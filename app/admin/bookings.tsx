import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { Booking } from '@/lib/db/types';
import { supabase } from '@/lib/supabase/client';

type BookingRow = {
  id: string;
  reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  package_id: string | null;
  package_title: string | null;
  service_category_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number | null;
  notes: string | null;
  created_at: string | null;
  type: string | null;
};

function mapBookingRow(row: BookingRow): Booking {
  return {
    id: row.id,
    reference: row.reference ?? '',
    customerId: row.customer_id ?? '',
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    packageId: row.package_id ?? undefined,
    packageTitle: row.package_title ?? undefined,
    serviceCategoryId: row.service_category_id ?? '',
    status: (row.status ?? 'pending') as Booking['status'],
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    travelers: row.travelers ?? 0,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? '',
    type: row.type ?? undefined,
  };
}

export default function BookingsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  const bookingsQuery = useQuery({
    queryKey: ['admin', 'bookings'],
    queryFn: async (): Promise<Booking[]> => {
      console.log('[admin/bookings] loading bookings from supabase');
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[admin/bookings] supabase error', error);
        throw new Error(error.message);
      }

      const rows: BookingRow[] = (data ?? []) as BookingRow[];
      return rows.map(mapBookingRow);
    },
  });

  const filtered = useMemo(() => {
    const bookings: Booking[] = bookingsQuery.data ?? [];
    return bookings.filter((b: Booking) => (filter === 'all' ? true : b.status === filter));
  }, [bookingsQuery.data, filter]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const renderItem = ({ item }: { item: Booking }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/admin/booking/${item.id}`)}
    >
      <View style={styles.row}>
        <View>
          <Text style={styles.ref}>{item.reference}</Text>
          <Text style={styles.date}>{new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}</Text>
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

      {bookingsQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} testID="adminBookingsLoading" />
      ) : bookingsQuery.isError ? (
        <View style={styles.empty} testID="adminBookingsError">
          <Text style={styles.emptyText}>Failed to load bookings.</Text>
          <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>
            {(bookingsQuery.error as Error | undefined)?.message ?? 'Unknown error'}
          </Text>
          <TouchableOpacity style={[styles.tab, { marginTop: 16 }]} onPress={() => bookingsQuery.refetch()} testID="adminBookingsRetry">
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
            <RefreshControl
              refreshing={bookingsQuery.isFetching}
              onRefresh={() => bookingsQuery.refetch()}
              tintColor={Colors.tint}
            />
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
