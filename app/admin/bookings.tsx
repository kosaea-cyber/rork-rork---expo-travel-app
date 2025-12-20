import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, UserRound, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';
import { useI18nStore } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';

type ProfileLite = { full_name?: string | null; name?: string | null; email?: string | null };

type PackageLite = { title_en?: string | null; title_ar?: string | null; title_de?: string | null };

type BookingAdminListRow = Pick<
  BookingRow,
  | 'id'
  | 'status'
  | 'travelers'
  | 'preferred_start_date'
  | 'preferred_end_date'
  | 'created_at'
  | 'user_id'
  | 'package_id'
> & {
  profiles?: ProfileLite | null;
  packages?: PackageLite | null;
};

type Snack = { type: 'success' | 'error'; message: string } | null;

function formatCustomerLabel(p: ProfileLite | null | undefined, userId: string): string {
  const name = (p?.full_name ?? p?.name ?? '').trim();
  const email = (p?.email ?? '').trim();
  if (name) return name;
  if (email) return email;
  return userId;
}

function shortId(id: string): string {
  const cleaned = (id ?? '').trim();
  return cleaned.length > 10 ? `${cleaned.slice(0, 8)}…${cleaned.slice(-4)}` : cleaned;
}

function formatDateRange(start: string | null, end: string | null): string {
  const s = (start ?? '').trim();
  const e = (end ?? '').trim();
  if (!s) return '—';
  const endSafe = e || s;
  return `${s} → ${endSafe}`;
}

function getPackageTitle(p: PackageLite | null | undefined, lang: 'en' | 'ar' | 'de'): string {
  const byLang = (lang === 'ar' ? p?.title_ar : lang === 'de' ? p?.title_de : p?.title_en) ?? null;
  const localized = (byLang ?? '').trim();
  const fallback = (p?.title_en ?? '').trim();
  return localized || fallback;
}

export default function BookingsPage() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  const storeIsLoading = useBookingStore((s) => s.isLoading);
  const storeError = useBookingStore((s) => s.error);
  const fetchAllBookingsForAdmin = useBookingStore((s) => s.fetchAllBookingsForAdmin);
  const updateBookingStatusAdmin = useBookingStore((s) => s.updateBookingStatusAdmin);
  const adminBookings = useBookingStore((s) => s.adminBookings);

  const [rows, setRows] = useState<BookingAdminListRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  const [snack, setSnack] = useState<Snack>(null);
  const snackAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

  const showSnack = useCallback(
    (next: Snack) => {
      setSnack(next);
      snackAnim.setValue(0);
      Animated.timing(snackAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(snackAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setSnack(null));
      }, 2200);
    },
    [snackAnim],
  );

  const loadBookingsWithJoins = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[admin/bookings] loading bookings with joins');

      const joinSelect =
        'id, status, travelers, preferred_start_date, preferred_end_date, created_at, user_id, package_id, profiles(full_name, name, email), packages(title_en, title_ar, title_de)';

      const res = await supabase
        .from('bookings')
        .select(joinSelect)
        .in('status', ['pending', 'confirmed', 'cancelled'])
        .order('created_at', { ascending: false });

      console.log('[admin/bookings] join query response', {
        error: res.error?.message ?? null,
        rows: res.data?.length ?? 0,
      });

      if (res.error) {
        console.log('[admin/bookings] join query failed; falling back to store fetch', res.error.message);

        await fetchAllBookingsForAdmin();
        const fallback = adminBookings.map((b) => ({
          id: b.id,
          status: b.status,
          travelers: b.travelers,
          preferred_start_date: b.preferred_start_date,
          preferred_end_date: b.preferred_end_date,
          created_at: b.created_at,
          user_id: b.user_id,
          package_id: b.package_id,
          profiles: null,
          packages: null,
        }));

        setRows(fallback);

        if (storeError?.message) {
          setError(storeError.message);
        }

        return;
      }

      setRows((res.data ?? []) as BookingAdminListRow[]);
    } catch (e) {
      console.log('[admin/bookings] loadBookingsWithJoins exception', e);
      setError('Failed to load bookings.');

      try {
        await fetchAllBookingsForAdmin();
        const fallback = adminBookings.map((b) => ({
          id: b.id,
          status: b.status,
          travelers: b.travelers,
          preferred_start_date: b.preferred_start_date,
          preferred_end_date: b.preferred_end_date,
          created_at: b.created_at,
          user_id: b.user_id,
          package_id: b.package_id,
          profiles: null,
          packages: null,
        }));
        setRows(fallback);
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, [adminBookings, fetchAllBookingsForAdmin, storeError?.message]);

  useEffect(() => {
    loadBookingsWithJoins();
  }, [loadBookingsWithJoins]);

  const filtered = useMemo(() => {
    return rows.filter((b) => (filter === 'all' ? true : b.status === filter));
  }, [rows, filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#16A34A';
      case 'cancelled':
        return '#DC2626';
      case 'pending':
        return '#F59E0B';
      default:
        return '#9CA3AF';
    }
  };

  const handleAction = useCallback(
    async (bookingId: string, nextStatus: 'confirmed' | 'cancelled') => {
      setActionBookingId(bookingId);
      try {
        const updated = await updateBookingStatusAdmin(bookingId, nextStatus);
        if (!updated) {
          showSnack({ type: 'error', message: 'Failed to update booking status.' });
          return;
        }

        await loadBookingsWithJoins();
        showSnack({
          type: 'success',
          message: nextStatus === 'confirmed' ? 'Booking confirmed.' : 'Booking cancelled.',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        showSnack({ type: 'error', message: msg });
      } finally {
        setActionBookingId(null);
      }
    },
    [loadBookingsWithJoins, showSnack, updateBookingStatusAdmin],
  );

  const renderItem = ({ item }: { item: BookingAdminListRow }) => {
    const statusColor = getStatusColor(item.status);

    const customer = formatCustomerLabel(item.profiles ?? null, item.user_id);
    const packageTitle = getPackageTitle(item.packages ?? null, language) || item.package_id || '—';

    const dateRange = formatDateRange(item.preferred_start_date, item.preferred_end_date);

    const isActionLoading = actionBookingId === item.id;
    const canUpdate = item.status === 'pending';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/admin/booking/[id]' as any, params: { id: item.id } })}
        testID={`admin-booking-${item.id}`}
        activeOpacity={0.9}
      >
        <View style={styles.tableRow}>
          <View style={[styles.cell, styles.colId]}>
            <Text style={styles.mono} numberOfLines={1}>
              {shortId(item.id)}
            </Text>
          </View>

          <View style={[styles.cell, styles.colCustomer]}>
            <View style={styles.customerRow}>
              <UserRound size={14} color={Colors.textSecondary} />
              <Text style={styles.customerText} numberOfLines={1}>
                {customer}
              </Text>
            </View>
          </View>

          <View style={[styles.cell, styles.colPackage]}>
            <Text style={styles.cellText} numberOfLines={1}>
              {packageTitle}
            </Text>
            {!item.packages && item.package_id ? (
              <Text style={styles.subtleMono} numberOfLines={1}>
                {item.package_id}
              </Text>
            ) : null}
          </View>

          <View style={[styles.cell, styles.colDates]}>
            <Text style={styles.cellText} numberOfLines={1}>
              {dateRange}
            </Text>
          </View>

          <View style={[styles.cell, styles.colStatus]}>
            <View style={[styles.badge, { backgroundColor: statusColor + '1A', borderColor: statusColor + '55' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>

          <View style={[styles.cell, styles.colActions]}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.confirmBtn, (!canUpdate || isActionLoading) && styles.actionBtnDisabled]}
              disabled={!canUpdate || isActionLoading}
              onPress={() => handleAction(item.id, 'confirmed')}
              testID={`admin-booking-confirm-${item.id}`}
            >
              <CheckCircle2 size={14} color="white" />
              <Text style={styles.actionBtnText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn, (!canUpdate || isActionLoading) && styles.actionBtnDisabled]}
              disabled={!canUpdate || isActionLoading}
              onPress={() => handleAction(item.id, 'cancelled')}
              testID={`admin-booking-cancel-${item.id}`}
            >
              <XCircle size={14} color="white" />
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isActionLoading ? (
          <View style={styles.actionSpinner}>
            <ActivityIndicator size="small" color={Colors.tint} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const headerRow = (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, styles.colId]}>Booking</Text>
      <Text style={[styles.headerCell, styles.colCustomer]}>Customer</Text>
      <Text style={[styles.headerCell, styles.colPackage]}>Package</Text>
      <Text style={[styles.headerCell, styles.colDates]}>Dates</Text>
      <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
      <Text style={[styles.headerCell, styles.colActions]}>Actions</Text>
    </View>
  );

  const list = (
    <FlatList
      data={filtered}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={isLoading || storeIsLoading}
          onRefresh={() => loadBookingsWithJoins()}
          tintColor={Colors.tint}
        />
      }
      ListHeaderComponent={headerRow}
      stickyHeaderIndices={Platform.OS === 'web' ? undefined : [0]}
      ListEmptyComponent={
        <View style={styles.empty} testID="adminBookingsEmpty">
          <Text style={styles.emptyText}>No bookings found</Text>
        </View>
      }
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.tab, filter === f && styles.activeTab]} onPress={() => setFilter(f)}>
            <Text style={[styles.tabText, filter === f && styles.activeTabText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && rows.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} testID="adminBookingsLoading" />
      ) : error || storeError ? (
        <View style={styles.empty} testID="adminBookingsError">
          <Text style={styles.emptyText}>Failed to load bookings.</Text>
          <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>{error ?? storeError?.message}</Text>
          <TouchableOpacity style={[styles.tab, { marginTop: 16 }]} onPress={loadBookingsWithJoins} testID="adminBookingsRetry">
            <Text style={styles.tabText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView horizontal contentContainerStyle={styles.webTableWrap} showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 980 }}>{list}</View>
        </ScrollView>
      ) : (
        list
      )}

      {snack ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.snack,
            {
              opacity: snackAnim,
              transform: [
                {
                  translateY: snackAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
          testID={snack.type === 'success' ? 'adminBookingsSnackSuccess' : 'adminBookingsSnackError'}
        >
          <Text style={styles.snackText}>{snack.message}</Text>
        </Animated.View>
      ) : null}
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
  webTableWrap: {
    paddingRight: 12,
  },
  list: {
    padding: 12,
    paddingBottom: 90,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  headerCell: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cell: {
    paddingRight: 10,
  },
  colId: { width: 120 },
  colCustomer: { width: 240 },
  colPackage: { width: 240 },
  colDates: { width: 170 },
  colStatus: { width: 110 },
  colActions: { width: 190, paddingRight: 0 },
  mono: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  subtleMono: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cellText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerText: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  confirmBtn: { backgroundColor: '#16A34A' },
  cancelBtn: { backgroundColor: '#DC2626' },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 12,
  },
  actionSpinner: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
  },
  snack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  snackText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
});
