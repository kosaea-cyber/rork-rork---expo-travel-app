import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
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

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const sorted = useMemo(() => {
    return [...myBookings].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [myBookings]);

  const onRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await fetchMyBookings();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMyBookings]);

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
        <TouchableOpacity style={styles.button} onPress={() => router.push('/auth/login' as any)}>
          <Text style={styles.buttonText}>{t('login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusMeta = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'confirmed':
        return { label: t('confirmed') ?? 'Confirmed', color: Colors.success };
      case 'cancelled':
        return { label: t('cancelled') ?? 'Cancelled', color: Colors.error };
      default:
        return { label: t('pending') ?? 'Pending', color: '#FFA000' };
    }
  };

  const renderItem = ({ item }: { item: BookingRow }) => {
    const meta = getStatusMeta(item.status);
    return (
      <TouchableOpacity
        testID={`booking-item-${item.id}`}
        style={styles.card}
        onPress={() => router.push({ pathname: '/(tabs)/bookings/[id]' as any, params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.idText}>#{item.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.color + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
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
  };

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
          testID="my-bookings-list"
          data={sorted}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.tint}
              colors={[Colors.tint]}
            />
          }
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
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
