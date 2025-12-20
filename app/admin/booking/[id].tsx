import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, UserRound, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { type BookingRow, type BookingStatus, useBookingStore } from '@/store/bookingStore';

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

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const updateBookingStatusAdmin = useBookingStore((s) => s.updateBookingStatusAdmin);
  const fetchAllBookingsForAdmin = useBookingStore((s) => s.fetchAllBookingsForAdmin);

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      console.log('[admin/booking] load booking', { id });
      const { data, error: bookingError } = await supabase
        .from('bookings')
        .select('id, user_id, status, notes, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (bookingError) {
        console.error('[admin/booking] select error', bookingError.message);
        throw new Error(bookingError.message);
      }

      if (!data) {
        setBooking(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const row = data as BookingRow;
      setBooking(row);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, name, email')
        .eq('id', row.user_id)
        .maybeSingle();

      if (profileError) {
        console.log('[admin/booking] profile load failed', profileError.message);
        setProfile(null);
      } else {
        setProfile((profileData as ProfileLite | null) ?? null);
      }

      setLoading(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canUpdate = useMemo(() => booking?.status === 'pending', [booking?.status]);

  const updateStatus = useCallback(
    async (status: BookingStatus) => {
      if (!booking) return;

      Alert.alert('Confirm', `Update status to "${status}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await updateBookingStatusAdmin(booking.id, status);
              if (!updated) {
                showSnack({ type: 'error', message: 'Failed to update booking status.' });
                return;
              }
              setBooking(updated);
              await fetchAllBookingsForAdmin();
              showSnack({ type: 'success', message: status === 'confirmed' ? 'Booking confirmed.' : 'Booking cancelled.' });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
    },
    [booking, fetchAllBookingsForAdmin, showSnack, updateBookingStatusAdmin],
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.tint} /></View>;
  if (error) {
    return (
      <View style={styles.center} testID="adminBookingError">
        <Text style={{ color: Colors.text, fontWeight: '700' }}>Failed to load booking</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: 6 }}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { marginTop: 16 }]} onPress={() => loadData()} testID="adminBookingRetry">
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!booking) return <View style={styles.center}><Text style={{ color: Colors.text }}>Booking not found</Text></View>;

  const statusColor = booking.status === 'confirmed' ? '#16A34A' : booking.status === 'cancelled' ? '#DC2626' : '#F59E0B';
  const preferred = extractPreferredStartDate(booking.notes);
  const customer = formatCustomerLabel(profile, booking.user_id);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="adminBookingBack">
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Booking
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {booking.id}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Overview</Text>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Booking ID</Text>
              <Text style={styles.kValueMono} numberOfLines={1}>
                {booking.id}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Customer</Text>
              <View style={styles.customerInline}>
                <UserRound size={14} color={Colors.textSecondary} />
                <Text style={styles.kValue} numberOfLines={1}>
                  {customer}
                </Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Created</Text>
              <Text style={styles.kValue} numberOfLines={1}>
                {new Date(booking.created_at).toLocaleString()}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Status</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor + '1A', borderColor: statusColor + '55' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{booking.status}</Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Date/Time</Text>
              <Text style={styles.kValue} numberOfLines={1}>
                {preferred ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{(booking.notes ?? '').trim() ? booking.notes : '—'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionConfirm, (!canUpdate || actionLoading) && styles.actionDisabled]}
                disabled={!canUpdate || actionLoading}
                onPress={() => updateStatus('confirmed')}
                testID="adminBookingConfirm"
              >
                <CheckCircle2 size={16} color="white" />
                <Text style={styles.actionText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionCancel, (!canUpdate || actionLoading) && styles.actionDisabled]}
                disabled={!canUpdate || actionLoading}
                onPress={() => updateStatus('cancelled')}
                testID="adminBookingCancel"
              >
                <XCircle size={16} color="white" />
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {actionLoading ? (
              <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
                <ActivityIndicator size="small" color={Colors.tint} />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

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
          testID={snack.type === 'success' ? 'adminBookingSnackSuccess' : 'adminBookingSnackError'}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: Colors.tint,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    marginRight: 6,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  kLabel: {
    color: Colors.textSecondary,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kValue: {
    flex: 1,
    color: Colors.text,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'right',
  },
  kValueMono: {
    flex: 1,
    color: Colors.text,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'right',
  },
  customerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1,
  },
  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  notesText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionConfirm: {
    backgroundColor: '#16A34A',
  },
  actionCancel: {
    backgroundColor: '#DC2626',
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
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
  retryBtn: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: Colors.text,
    fontWeight: '900',
    fontSize: 13,
  },
});
