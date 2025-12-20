import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const t = useI18nStore((state) => state.t);

  const bookings = useBookingStore((state) => state.myBookings);

  const getOrCreatePrivateConversation = useChatStore((state) => state.getOrCreatePrivateConversation);
  const sendMessage = useChatStore((state) => state.sendMessage);

  const user = useAuthStore((state) => state.user);

  const booking = bookings.find((b: BookingRow) => b.id === String(id));

  const statusMeta = useMemo(() => {
    const status = booking?.status ?? 'pending';
    if (status === 'confirmed') {
      return { label: t('confirmed') ?? 'Confirmed', color: Colors.success, bg: Colors.success + '14' };
    }
    if (status === 'cancelled') {
      return { label: t('cancelled') ?? 'Cancelled', color: Colors.error, bg: Colors.error + '14' };
    }
    return { label: t('pending') ?? 'Pending', color: '#FFA000', bg: '#FFA00014' };
  }, [booking?.status, t]);

  const handleContact = useCallback(async () => {
    try {
      if (!user) {
        Alert.alert(
          t('signInRequired') || 'Sign in required',
          t('signInToMessage') || 'Please sign in to message support about your booking.',
          [
            { text: t('cancel') || 'Cancel', style: 'cancel' },
            { text: t('signIn') || 'Sign in', onPress: () => router.push('/auth' as any) },
          ]
        );
        return;
      }

      const conv = await getOrCreatePrivateConversation();
      if (!conv) {
        router.push('/chat' as any);
        return;
      }

      await sendMessage(conv.id, `Hello, I have a question about my booking (${booking?.id}).`, 'private_user');
      router.push((`/chat/${conv.id}` as unknown) as any);
    } catch (e) {
      console.error('[BookingDetailsScreen] handleContact failed', e);
      Alert.alert(t('error') || 'Error', t('chatUnavailable') || 'Chat is temporarily unavailable.');
      router.push('/chat' as any);
    }
  }, [booking?.id, getOrCreatePrivateConversation, router, sendMessage, t, user]);

  if (!booking) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>Booking not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="booking-details">
      <View style={styles.statusCard} testID="booking-status-section">
        <Text style={styles.statusTitle}>{t('status') ?? 'Status'}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
          <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <Text style={styles.statusHint}>
          {t('bookingStatusHint') ??
            'You will receive a message in Messages when your booking is confirmed.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Booking ID</Text>
        <Text style={styles.value}>{booking.id}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('bookingDateTime') ?? 'Booking date/time'}</Text>
        <Text style={styles.value}>{new Date(booking.created_at).toLocaleString()}</Text>

        {booking.notes?.trim() ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{booking.notes}</Text>
          </>
        ) : null}
      </View>

      <TouchableOpacity testID="booking-open-chat" style={styles.button} onPress={handleContact}>
        <Text style={styles.buttonText}>{t('openConversation')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24 },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  statusTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusHint: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 1,
  },
  value: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  button: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.tint,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
