import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { type BookingRow, type BookingStatus, useBookingStore } from '@/store/bookingStore';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const updateBookingStatusAdmin = useBookingStore((s) => s.updateBookingStatusAdmin);

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      console.log('[admin/booking] load booking', { id });
      const { data, error } = await supabase
        .from('bookings')
        .select('id, user_id, status, notes, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[admin/booking] select error', error.message);
        throw new Error(error.message);
      }

      if (!data) {
        setBooking(null);
        setLoading(false);
        return;
      }

      setBooking(data as BookingRow);
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
            const updated = await updateBookingStatusAdmin(booking.id, status);
            if (!updated) return;
            setBooking(updated);
          },
        },
      ]);
    },
    [booking, updateBookingStatusAdmin],
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.tint} /></View>;
  if (error) {
    return (
      <View style={styles.center} testID="adminBookingError">
        <Text style={{ color: Colors.text, fontWeight: '700' }}>Failed to load booking</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: 6 }}>{error}</Text>
        <TouchableOpacity style={[styles.btn, styles.btnComplete, { marginTop: 16 }]} onPress={() => loadData()} testID="adminBookingRetry">
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!booking) return <View style={styles.center}><Text style={{ color: Colors.text }}>Booking not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking #{booking.id.slice(0, 8)}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    booking.status === 'confirmed'
                      ? '#4CAF50'
                      : booking.status === 'cancelled'
                        ? '#F44336'
                        : booking.status === 'pending'
                          ? '#FF9800'
                          : '#9E9E9E',
                },
              ]}
            >
              <Text style={styles.badgeText}>{booking.status}</Text>
            </View>

            <View style={styles.actions}>
              {canConfirm ? (
                <>
                  <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={() => updateStatus('confirmed')} testID="adminBookingConfirm">
                    <CheckCircle size={16} color="white" />
                    <Text style={styles.btnText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => updateStatus('cancelled')} testID="adminBookingCancel">
                    <XCircle size={16} color="white" />
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {canComplete ? (
                <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={() => updateStatus('confirmed')} testID="adminBookingConfirm2">
                  <CheckCircle size={16} color="white" />
                  <Text style={styles.btnText}>Complete</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>User ID</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {booking.user_id}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{new Date(booking.created_at).toLocaleString()}</Text>
          </View>
          {booking.updated_at ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Updated</Text>
              <Text style={styles.detailValue}>{new Date(booking.updated_at).toLocaleString()}</Text>
            </View>
          ) : null}

          {booking.notes?.trim() ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.tint,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusRow: {
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnConfirm: { backgroundColor: '#4CAF50' },
  btnCancel: { backgroundColor: '#F44336' },
  btnComplete: { backgroundColor: Colors.tint },
  btnText: { color: 'white', fontWeight: '600', fontSize: 12 },
  
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: { fontWeight: '600', fontSize: 16 },
  userEmail: { color: '#666', fontSize: 14 },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: '#333',
    fontWeight: '600',
  },
  notesBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  notesLabel: { fontSize: 12, color: '#F57C00', fontWeight: 'bold', textTransform: 'uppercase' },
  notesText: { color: '#333', fontSize: 14, marginTop: 4 },
});
