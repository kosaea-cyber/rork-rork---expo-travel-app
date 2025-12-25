import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { type BookingRow, type BookingStatus, useBookingStore } from '@/store/bookingStore';
import { useI18nStore } from '@/constants/i18n';
import { type PreferredLanguage } from '@/store/profileStore';

type AdminBookingJoinRow = BookingRow & {
  profiles: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    preferred_language: PreferredLanguage | null;
  } | null;

  packages: {
    id: string;
    title_en: string | null;
    title_ar: string | null;
    title_de: string | null;
    price_amount: number | null;
    price_currency: string | null;
    price_type: string | null;
  } | null;
};

function getLocalizedTitle(pkg: NonNullable<AdminBookingJoinRow['packages']>, lang: PreferredLanguage) {
  const v = lang === 'ar' ? pkg.title_ar : lang === 'de' ? pkg.title_de : pkg.title_en;
  return (v ?? pkg.title_en ?? pkg.title_de ?? pkg.title_ar ?? '').trim();
}

function getStatusColor(status: BookingStatus) {
  switch (status) {
    case 'confirmed':
      return '#4CAF50';
    case 'cancelled':
      return '#F44336';
    case 'pending':
      return '#FF9800';
    default:
      return '#9E9E9E';
  }
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = (useI18nStore((state) => state.language) ?? 'en') as PreferredLanguage;

  const updateBookingStatus = useBookingStore((s) => s.updateBookingStatus);

  const [booking, setBooking] = useState<AdminBookingJoinRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          id,
          user_id,
          status,
          notes,
          created_at,
          updated_at,
          package_id,
          preferred_start_date,
          preferred_end_date,
          travelers,
          customer_notes,

          profiles:profiles!bookings_user_id_profiles_fkey (
            id,
            full_name,
            phone,
            email,
            role,
            preferred_language
          ),

          packages:packages!bookings_package_id_fkey (
            id,
            title_en,
            title_ar,
            title_de,
            price_amount,
            price_currency,
            price_type
          )
        `,
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);

      setBooking((data ?? null) as AdminBookingJoinRow | null);
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

  const canConfirm = useMemo(() => booking?.status === 'pending', [booking?.status]);
  const canComplete = useMemo(() => booking?.status === 'confirmed', [booking?.status]);

  const updateStatus = useCallback(
    async (status: BookingStatus) => {
      if (!booking) return;

      Alert.alert('Confirm', `Update status to "${status}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          style: 'destructive',
          onPress: async () => {
            const updated = await updateBookingStatus(booking.id, status);
            if (!updated) return;
            await loadData(); // حتى ترجع joins + أحدث بيانات
          },
        },
      ]);
    },
    [booking, loadData, updateBookingStatus],
  );

  const customerLang = useMemo(() => {
    return (booking?.profiles?.preferred_language ?? fallbackLanguage ?? 'en') as PreferredLanguage;
  }, [booking?.profiles?.preferred_language, fallbackLanguage]);

  const packageTitle = useMemo(() => {
    if (!booking?.packages) return null;
    return getLocalizedTitle(booking.packages, customerLang);
  }, [booking?.packages, customerLang]);

  const statusColor = useMemo(() => {
    return booking ? getStatusColor(booking.status) : '#9E9E9E';
  }, [booking]);

  const customerName = booking?.profiles?.full_name?.trim() || '—';
  const customerEmail = booking?.profiles?.email?.trim() || '—';
  const customerPhone = booking?.profiles?.phone?.trim() || '—';

  const dateRange = useMemo(() => {
    const from = booking?.preferred_start_date ?? null;
    const to = booking?.preferred_end_date ?? null;
    if (!from && !to) return '—';
    if (from && to) return `${from} → ${to}`;
    return from ?? to ?? '—';
  }, [booking?.preferred_end_date, booking?.preferred_start_date]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.tint} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} testID="adminBookingError">
        <Text style={{ color: Colors.text, fontWeight: '700' }}>Failed to load booking</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: 6 }}>{error}</Text>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
          onPress={loadData}
          testID="adminBookingRetry"
        >
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.text }}>Booking not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking #{booking.id.slice(0, 8)}</Text>
      </View>

      <View style={styles.content}>
        {/* STATUS CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>

          <View style={styles.statusRow}>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>
              <Text style={styles.badgeText}>{booking.status}</Text>
            </View>

            <View style={styles.actions}>
              {canConfirm && (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnConfirm]}
                    onPress={() => updateStatus('confirmed')}
                    testID="adminBookingConfirm"
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                    <Text style={styles.btnText}>Confirm</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnCancel]}
                    onPress={() => updateStatus('cancelled')}
                    testID="adminBookingCancel"
                  >
                    <Ionicons name="close-circle-outline" size={16} color="white" />
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {canComplete && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => updateStatus('completed')}
                  testID="adminBookingComplete"
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="white" />
                  <Text style={styles.btnText}>Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* CUSTOMER CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {customerName}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {customerEmail}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {customerPhone}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Language</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {customerLang.toUpperCase()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>User ID</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {booking.user_id ?? '—'}
            </Text>
          </View>
        </View>

        {/* BOOKING DETAILS CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Booking details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Package</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {packageTitle || booking.package_id || '—'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Preferred dates</Text>
            <Text style={styles.detailValue}>{dateRange}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Travelers</Text>
            <Text style={styles.detailValue}>{String(booking.travelers ?? 1)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {booking.created_at ? new Date(booking.created_at).toLocaleString() : '—'}
            </Text>
          </View>

          {booking.updated_at ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Updated</Text>
              <Text style={styles.detailValue}>{new Date(booking.updated_at).toLocaleString()}</Text>
            </View>
          ) : null}

          {booking.customer_notes?.trim() ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Customer Notes</Text>
              <Text style={styles.notesText}>{booking.customer_notes}</Text>
            </View>
          ) : null}

          {booking.notes?.trim() ? (
            <View style={[styles.notesBox, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.notesLabel, { color: '#1565C0' }]}>Admin Notes</Text>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: Colors.tint,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 16 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },

  content: { padding: 16, gap: 16 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 12,
  },

  statusRow: { gap: 12 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: 'white', fontWeight: '900', textTransform: 'uppercase' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  btnConfirm: { backgroundColor: '#4CAF50' },
  btnCancel: { backgroundColor: '#F44336' },
  btnPrimary: { backgroundColor: Colors.tint },
  btnText: { color: 'white', fontWeight: '800', fontSize: 12 },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: { flex: 1, textAlign: 'right', color: Colors.text, fontWeight: '700' },

  notesBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesLabel: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notesText: { color: Colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 },
});
