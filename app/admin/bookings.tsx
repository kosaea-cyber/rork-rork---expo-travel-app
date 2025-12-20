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
import { supabase } from '@/lib/supabase/client';

type ProfileLite = { id: string; full_name?: string | null; name?: string | null; email?: string | null };

type Snack = { type: 'success' | 'error'; message: string } | null;

function extractPreferredStartDate(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Preferred start date:\s*(.+)/i);
  const raw = m?.[1]?.trim() ?? '';
  return raw ? raw : null;
}

function formatCustomerLabel(p: ProfileLite | null, userId: string): string {
  const name = (p?.full_name ?? p?.name ?? '').trim();
  const email = (p?.email ?? '').trim();
  if (name && email) return `${name} · ${email}`;
  if (name) return name;
  if (email) return email;
  return userId;
}

export default function BookingsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  const adminBookings = useBookingStore((s) => s.adminBookings);
  const isLoading = useBookingStore((s) => s.isLoading);
  const error = useBookingStore((s) => s.error);
  const fetchAllBookingsForAdmin = useBookingStore((s) => s.fetchAllBookingsForAdmin);
  const updateBookingStatusAdmin = useBookingStore((s) => s.updateBookingStatusAdmin);

  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
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

  useEffect(() => {
    fetchAllBookingsForAdmin();
  }, [fetchAllBookingsForAdmin]);

  useEffect(() => {
    const run = async () => {
      const ids = Array.from(new Set(adminBookings.map((b) => b.user_id).filter(Boolean)));
      const missing = ids.filter((id) => !profilesById[id]);
      if (missing.length === 0) return;

      try {
        console.log('[admin/bookings] loading customer profiles', { count: missing.length });
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, name, email')
          .in('id', missing)
          .limit(200);

        if (profilesError) {
          console.log('[admin/bookings] profiles load failed', profilesError.message);
          return;
        }

        const next: Record<string, ProfileLite> = { ...profilesById };
        (data ?? []).forEach((p) => {
          if (p?.id) next[String(p.id)] = p as ProfileLite;
        });
        setProfilesById(next);
      } catch (e) {
        console.log('[admin/bookings] profiles load exception', e);
      }
    };

    run();
  }, [adminBookings, profilesById]);

  const filtered = useMemo(() => {
    return adminBookings.filter((b) => (filter === 'all' ? true : b.status === filter));
  }, [adminBookings, filter]);

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

        await fetchAllBookingsForAdmin();
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
    [fetchAllBookingsForAdmin, showSnack, updateBookingStatusAdmin],
  );

  const renderItem = ({ item }: { item: BookingRow }) => {
    const statusColor = getStatusColor(item.status);
    const preferred = extractPreferredStartDate(item.notes);
    const customer = formatCustomerLabel(profilesById[item.user_id] ?? null, item.user_id);

    const isActionLoading = actionBookingId === item.id;
    const canUpdate = item.status === 'pending';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/admin/booking/${item.id}`)}
        testID={`admin-booking-${item.id}`}
        activeOpacity={0.9}
      >
        <View style={styles.tableRow}>
          <View style={[styles.cell, styles.colId]}>
            <Text style={styles.mono} numberOfLines={1}>
              {item.id}
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

          <View style={[styles.cell, styles.colCreated]}>
            <Text style={styles.cellText} numberOfLines={1}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>

          <View style={[styles.cell, styles.colStatus]}>
            <View style={[styles.badge, { backgroundColor: statusColor + '1A', borderColor: statusColor + '55' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>

          <View style={[styles.cell, styles.colDateTime]}>
            <Text style={styles.cellText} numberOfLines={1}>
              {preferred ?? '—'}
            </Text>
          </View>

          <View style={[styles.cell, styles.colNotes]}>
            <Text style={styles.cellText} numberOfLines={2}>
              {(item.notes ?? '').trim() ? item.notes : '—'}
            </Text>
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
      <Text style={[styles.headerCell, styles.colId]}>Booking ID</Text>
      <Text style={[styles.headerCell, styles.colCustomer]}>Customer</Text>
      <Text style={[styles.headerCell, styles.colCreated]}>Created</Text>
      <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
      <Text style={[styles.headerCell, styles.colDateTime]}>Date/Time</Text>
      <Text style={[styles.headerCell, styles.colNotes]}>Notes</Text>
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
        <RefreshControl refreshing={isLoading} onRefresh={() => fetchAllBookingsForAdmin()} tintColor={Colors.tint} />
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
        <Text style={styles.title}>Bookings</Text>
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

      {isLoading && adminBookings.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} testID="adminBookingsLoading" />
      ) : error ? (
        <View style={styles.empty} testID="adminBookingsError">
          <Text style={styles.emptyText}>Failed to load bookings.</Text>
          <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>{error.message}</Text>
          <TouchableOpacity
            style={[styles.tab, { marginTop: 16 }]}
            onPress={() => fetchAllBookingsForAdmin()}
            testID="adminBookingsRetry"
          >
            <Text style={styles.tabText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView horizontal contentContainerStyle={styles.webTableWrap} showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 1180 }}>{list}</View>
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
  colId: { width: 210 },
  colCustomer: { width: 240 },
  colCreated: { width: 170 },
  colStatus: { width: 110 },
  colDateTime: { width: 150 },
  colNotes: { width: 320 },
  colActions: { width: 190, paddingRight: 0 },
  mono: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cellText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
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
    fontWeight: '700',
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
