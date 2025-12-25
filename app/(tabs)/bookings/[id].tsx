import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';

type PackageRow = {
  id: string;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
};

function getLocalizedTitle(pkg: PackageRow, lang: PreferredLanguage) {
  const v = lang === 'ar' ? pkg.title_ar : lang === 'de' ? pkg.title_de : pkg.title_en;
  return (v ?? pkg.title_en ?? pkg.title_de ?? pkg.title_ar ?? '').trim();
}

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const bookings = useBookingStore((state) => state.myBookings);

  const getOrCreatePrivateConversation = useChatStore((state) => state.getOrCreateGuestConversation);
  const sendMessage = useChatStore((state) => state.sendMessage);

  const user = useAuthStore((state) => state.user);

  const booking = useMemo(() => {
    const bookingId = String(id ?? '');
    return bookings.find((b: BookingRow) => b.id === bookingId) ?? null;
  }, [bookings, id]);

  const dateRange = useMemo(() => {
    const from = booking?.preferred_start_date ?? null;
    const to = booking?.preferred_end_date ?? null;
    if (!from && !to) return '—';
    if (from && to) return `${from} → ${to}`;
    return from ?? to ?? '—';
  }, [booking?.preferred_end_date, booking?.preferred_start_date]);

  const travelersText = useMemo(() => {
    const tr = booking?.travelers ?? 1;
    return String(tr);
  }, [booking?.travelers]);

  const packageTitle = useMemo(() => {
    return ''; // placeholder will be set by fetch below, but we keep UI stable
  }, []);

  const [pkgTitle, setPkgTitle] = React.useState<string>('');
  const [pkgLoading, setPkgLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    let mounted = true;

    const loadPkg = async () => {
      if (!booking?.package_id) {
        if (mounted) setPkgTitle('');
        return;
      }

      setPkgLoading(true);
      const { data, error } = await supabase
        .from('packages')
        .select('id, title_en, title_ar, title_de')
        .eq('id', booking.package_id)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setPkgTitle('');
        setPkgLoading(false);
        return;
      }

      setPkgTitle(getLocalizedTitle(data as PackageRow, language));
      setPkgLoading(false);
    };

    void loadPkg();
    return () => {
      mounted = false;
    };
  }, [booking?.package_id, language]);

  const handleContact = useCallback(async () => {
    try {
      if (!user || !booking) return;

      const conv = await getOrCreatePrivateConversation();
      if (!conv) {
        router.push('/chat');
        return;
      }

    const title = pkgTitle?.trim() ? ` - ${pkgTitle.trim()}` : '';
await sendMessage(
  conv.id,
  `Hello, I have a question about my booking (#${booking.id.slice(0, 8)}${title}).`,
);

      router.push(`/chat/${conv.id}` as any);
    } catch (e) {
      console.error('[BookingDetailsScreen] handleContact failed', e);
      router.push('/chat');
    }
  }, [booking, getOrCreatePrivateConversation, pkgTitle, router, sendMessage, user]);

  if (!booking) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>{t('bookingNotFound') ?? 'Booking not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>{t('bookingId') ?? 'Booking ID'}</Text>
        <Text style={styles.value}>{booking.id}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('status') ?? 'Status'}</Text>
        <Text style={[styles.value, { color: Colors.tint }]}>{t(booking.status) ?? booking.status}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('package') ?? 'Package'}</Text>
        <Text style={styles.value}>
          {pkgLoading ? (t('loading') ?? 'Loading…') : (pkgTitle || booking.package_id || '—')}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('preferredDates') ?? 'Preferred dates'}</Text>
        <Text style={styles.value}>{dateRange}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('travelers') ?? 'Travelers'}</Text>
        <Text style={styles.value}>{travelersText}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>{t('createdAt') ?? 'Created'}</Text>
        <Text style={styles.value}>{new Date(booking.created_at).toLocaleString()}</Text>

        {booking.customer_notes?.trim() ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.label}>{t('notes') ?? 'Notes'}</Text>
            <Text style={styles.value}>{booking.customer_notes}</Text>
          </>
        ) : null}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleContact}>
        <Text style={styles.buttonText}>{t('openConversation') ?? 'Open conversation'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24 },
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
