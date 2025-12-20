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
import { ArrowLeft, CheckCircle2, UserRound, XCircle, Package as PackageIcon, Users, Calendar } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { type BookingRow, type BookingStatus, useBookingStore } from '@/store/bookingStore';
import { useI18nStore } from '@/constants/i18n';

type ProfileLite = { id: string; full_name?: string | null; name?: string | null; email?: string | null };

type PackageLite = { id: string; title_en?: string | null; title_ar?: string | null; title_de?: string | null };

type Snack = { type: 'success' | 'error'; message: string } | null;

function formatCustomerLabel(p: ProfileLite | null, userId: string): string {
  const name = (p?.full_name ?? p?.name ?? '').trim();
  const email = (p?.email ?? '').trim();
  if (name && email) return `${name} · ${email}`;
  if (name) return name;
  if (email) return email;
  return userId;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const s = (start ?? '').trim();
  const e = (end ?? '').trim();
  if (!s && !e) return '—';
  const startSafe = s || e;
  const endSafe = e || s;
  if (!startSafe) return '—';
  if (!endSafe) return startSafe;
  return `${startSafe} → ${endSafe}`;
}

function getPackageTitle(pkg: PackageLite | null, lang: 'en' | 'ar' | 'de'): string {
  const localizedRaw = (lang === 'ar' ? pkg?.title_ar : lang === 'de' ? pkg?.title_de : pkg?.title_en) ?? '';
  const localized = localizedRaw.trim();
  const fallback = (pkg?.title_en ?? '').trim();
  return localized || fallback;
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const language = useI18nStore((s) => s.language);

  const updateBookingStatusAdmin = useBookingStore((s) => s.updateBookingStatusAdmin);
  const fetchAllBookingsForAdmin = useBookingStore((s) => s.fetchAllBookingsForAdmin);

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [pkg, setPkg] = useState<PackageLite | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [snack, setSnack] = useState<Snack>(null);
  const snackAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

  const canUpdate = useMemo(() => booking?.status === 'pending', [booking?.status]);

  const statusColor = useMemo(() => {
    if (booking?.status === 'confirmed') return '#16A34A';
    if (booking?.status === 'cancelled') return '#DC2626';
    return '#F59E0B';
  }, [booking?.status]);

  const customerLabel = useMemo(() => {
    return booking ? formatCustomerLabel(profile, booking.user_id) : '';
  }, [booking, profile]);

  const packageTitle = useMemo(() => {
    if (!booking?.package_id) return '—';
    const t = getPackageTitle(pkg, language);
    return t.trim() ? t : booking.package_id;
  }, [booking?.package_id, language, pkg]);

  const dateRange = useMemo(() => {
    return formatDateRange(booking?.preferred_start_date ?? null, booking?.preferred_end_date ?? null);
  }, [booking?.preferred_start_date, booking?.preferred_end_date]);

  const createdLabel = useMemo(() => {
    const raw = booking?.created_at ?? null;
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString();
  }, [booking?.created_at]);

  const notesLabel = useMemo(() => {
    const v = (booking?.customer_notes ?? '').trim();
    return v ? v : '—';
  }, [booking?.customer_notes]);

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
    const bookingId = typeof id === 'string' ? id.trim() : '';
    if (!bookingId) {
      console.log('[admin/bookingDetail] missing route param id');
      setBooking(null);
      setProfile(null);
      setPkg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[admin/bookingDetail] load booking', { bookingId });

      const bookingSelect =
        'id, user_id, status, notes, package_id, preferred_start_date, preferred_end_date, travelers, customer_notes, created_at, updated_at';

      const { data, error: bookingError } = await supabase
        .from('bookings')
        .select(bookingSelect)
        .eq('id', bookingId)
        .maybeSingle();

      console.log('[admin/bookingDetail] booking query result', {
        hasRow: Boolean(data),
        error: bookingError?.message ?? null,
      });

      if (bookingError) throw new Error(bookingError.message);

      if (!data) {
        setBooking(null);
        setProfile(null);
        setPkg(null);
        setLoading(false);
        return;
      }

      const row = data as BookingRow;
      setBooking(row);

      const [profileRes, packageRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, name, email').eq('id', row.user_id).maybeSingle(),
        row.package_id
          ? supabase.from('packages').select('id, title_en, title_ar, title_de').eq('id', row.package_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
      ]);

      console.log('[admin/bookingDetail] profile/package results', {
        profileError: profileRes.error?.message ?? null,
        hasProfile: Boolean(profileRes.data),
        packageError: (packageRes as any)?.error?.message ?? null,
        hasPackage: Boolean((packageRes as any)?.data),
      });

      if (profileRes.error) setProfile(null);
      else setProfile((profileRes.data as ProfileLite | null) ?? null);

      const pkgData = (packageRes as { data: unknown; error: { message?: string } | null }).data;
      const pkgErr = (packageRes as { data: unknown; error: { message?: string } | null }).error;

      if (pkgErr) setPkg(null);
      else setPkg((pkgData as PackageLite | null) ?? null);

      setLoading(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.log('[admin/bookingDetail] load error', message);
      setError(message);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
              showSnack({
                type: 'success',
                message: status === 'confirmed' ? 'Booking confirmed.' : 'Booking cancelled.',
              });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
    },
    [booking, fetchAllBookingsForAdmin, showSnack, updateBookingStatusAdmin],
  );

  if (loading) {
    return (
      <View style={styles.center} testID="adminBookingLoading">
        <ActivityIndicator color={Colors.tint} />
      </View>
    );
  }

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

  if (!booking) {
    return (
      <View style={styles.center} testID="adminBookingNotFound">
        <Text style={{ color: Colors.text }}>Booking not found</Text>
      </View>
    );
  }

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
              <View style={styles.inlineRight}>
                <UserRound size={14} color={Colors.textSecondary} />
                <Text style={styles.kValue} numberOfLines={1}>
                  {customerLabel}
                </Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Created</Text>
              <Text style={styles.kValue} numberOfLines={1}>
                {createdLabel}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Status</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor + '1A', borderColor: statusColor + '55' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{booking.status}</Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Package</Text>
              <View style={styles.inlineRight}>
                <PackageIcon size={14} color={Colors.textSecondary} />
                <Text style={styles.kValue} numberOfLines={1}>
                  {packageTitle}
                </Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Travelers</Text>
              <View style={styles.inlineRight}>
                <Users size={14} color={Colors.textSecondary} />
                <Text style={styles.kValue} numberOfLines={1}>
                  {String(booking.travelers ?? 1)}
                </Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Date range</Text>
              <View style={styles.inlineRight}>
                <Calendar size={14} color={Colors.textSecondary} />
                <Text style={styles.kValue} numberOfLines={1}>
                  {dateRange}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText} testID="adminBookingCustomerNotes">
              {notesLabel}
            </Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 90 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    backgroundColor: Colors.tint,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: { marginRight: 6 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  headerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  content: { padding: 16, gap: 16 },
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
  kValue: { flex: 1, color: Colors.text, fontWeight: '800', fontSize: 13, textAlign: 'right' },
  kValueMono: { flex: 1, color: Colors.text, fontWeight: '800', fontSize: 12, textAlign: 'right' },
  inlineRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flex: 1 },
  statusPill: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-end' },
  statusText: { fontWeight: '900', fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' },
  notesText: { color: Colors.text, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionConfirm: { backgroundColor: '#16A34A' },
  actionCancel: { backgroundColor: '#DC2626' },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },
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
  snackText: { color: 'white', fontWeight: '800', fontSize: 13 },
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
  retryBtnText: { color: Colors.text, fontWeight: '900', fontSize: 13 },
});
