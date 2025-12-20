import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';
import HeaderLogo from '@/components/HeaderLogo';

export default function BookingsScreen() {
  const t = useI18nStore((state) => state.t);
  const router = useRouter();
  const { user, isGuest } = useAuthStore();
  const myBookings = useBookingStore((s) => s.myBookings);
  const isLoading = useBookingStore((s) => s.isLoading);
  const error = useBookingStore((s) => s.error);
  const fetchMyBookings = useBookingStore((s) => s.fetchMyBookings);

  const sorted = useMemo(() => {
    return [...myBookings].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [myBookings]);

  useEffect(() => {
    if (user) {
      fetchMyBookings();
    }
  }, [user, fetchMyBookings]);

  if (!user && !isGuest) {
    // Should not happen due to route protection but safe guard
    return null;
  }

  if (isGuest || !user) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.message}>{t('loginToBook')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/auth/login')}>
          <Text style={styles.buttonText}>{t('login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return '#FFA000';
    }
  };

  const renderItem = ({ item }: { item: BookingRow }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/(tabs)/bookings/${item.id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.idText}>#{item.id.slice(0, 8)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{t(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.packageTitle} numberOfLines={1}>
        {item.notes?.trim() ? item.notes.split('\n')[0] : t('booking') ?? 'Booking'}
      </Text>

      <View style={styles.row}>
        <Text style={styles.dateLabel}>{t('createdAt') ?? 'Created:'}</Text>
        <Text style={styles.dateValue}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabBookings')}</Text>
        <HeaderLogo />
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={Colors.tint} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{error?.message ?? t('noBookings')}</Text>
              {error?.message ? (
                <TouchableOpacity testID="bookings-retry" style={styles.retryButton} onPress={() => fetchMyBookings()}>
                  <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Courier', // Monospace for ID
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  packageTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    color: Colors.textSecondary,
    marginRight: 8,
  },
  dateValue: {
    color: Colors.text,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
