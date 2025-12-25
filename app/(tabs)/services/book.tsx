import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useBookingStore } from '@/store/bookingStore';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import DateRangeSelect from '@/components/DateRangeSelect';

type PackageRow = {
  id: string;
  category_id: string | null;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_de: string | null;
  image_url: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_type: 'fixed' | 'starting_from' | null;
};

function getLocalizedText(row: PackageRow, key: 'title' | 'description', lang: PreferredLanguage): string {
  const v =
    lang === 'ar'
      ? (key === 'title' ? row.title_ar : row.description_ar)
      : lang === 'de'
        ? (key === 'title' ? row.title_de : row.description_de)
        : (key === 'title' ? row.title_en : row.description_en);

  const fallback = key === 'title' ? row.title_en : row.description_en;
  return (v ?? fallback ?? '').trim();
}

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default function BookingRequestScreen() {
  const { packageId } = useLocalSearchParams<{ packageId?: string }>();
  const router = useRouter();

  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const profileFullName = useProfileStore((s) => (s as any).fullName ?? null);
  const profilePhone = useProfileStore((s) => (s as any).phone ?? null);

  const createBooking = useBookingStore((state) => state.createBooking);
  const isLoading = useBookingStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  const [startIso, setStartIso] = useState<string | null>(null);
  const [endIso, setEndIso] = useState<string | null>(null);
  const [travelers, setTravelers] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const { data: pkg, isLoading: pkgLoading, isError, error, refetch } = useQuery({
    queryKey: ['package', { id: packageId ?? null }],
    enabled: Boolean(packageId),
    queryFn: async (): Promise<PackageRow> => {
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, category_id, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type',
        )
        .eq('id', packageId as string)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Package not found');
      return data as PackageRow;
    },
  });

  const pkgTitle = useMemo(() => {
    if (!pkg) return '';
    return getLocalizedText(pkg, 'title', language);
  }, [language, pkg]);

  const isValid = useMemo(() => {
    if (!pkg || !user) return false;
    if (!startIso || !endIso) return false;
    if (!isIsoDate(startIso) || !isIsoDate(endIso)) return false;
    if (endIso < startIso) return false;

    const tr = parseInt(travelers, 10);
    if (!Number.isFinite(tr) || tr < 1 || tr > 20) return false;

    return true;
  }, [endIso, pkg, startIso, travelers, user]);

  const handleRequest = useCallback(async () => {
    if (!pkg || !user || !startIso || !endIso) return;

    // ✅ require profile info before booking
    if (!profileFullName?.trim() || !profilePhone?.trim()) {
      Alert.alert(
        t('completeProfile') ?? 'Complete your profile',
        t('needNamePhoneToBook') ?? 'Please enter your full name and phone number before booking.',
        [{ text: 'OK', onPress: () => router.push('/account') }],
      );
      return;
    }

    if (endIso < startIso) {
      Alert.alert(t('somethingWentWrong') ?? 'Invalid dates', t('retry') ?? 'Please try again');
      return;
    }

    const tr = parseInt(travelers, 10) || 1;

    const created = await createBooking({
      packageId: pkg.id,
      preferredStartDate: startIso,
      preferredEndDate: endIso,
      travelers: tr,
      customerNotes: notes?.trim() ? notes.trim() : null,
    });

    if (!created) {
      Alert.alert(t('somethingWentWrong') ?? 'Something went wrong', t('retry') ?? 'Please try again');
      return;
    }

    Alert.alert('Success', t('bookingRequestSent') ?? 'Booking request sent', [
      { text: 'OK', onPress: () => router.navigate('/(tabs)/bookings') },
    ]);
  }, [createBooking, endIso, notes, pkg, profileFullName, profilePhone, router, startIso, t, travelers, user]);

  if (!packageId) {
    return (
      <View style={styles.container} testID="book-missing-id">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>Missing package id</Text>
          <TouchableOpacity testID="book-back" style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (pkgLoading) {
    return (
      <View style={styles.container} testID="book-loading">
        <View style={styles.stateCenter}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateTitle}>{t('loading') ?? 'Loading…'}</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <View style={styles.container} testID="book-error">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>{t('somethingWentWrong') ?? 'Something went wrong'}</Text>
          <Text style={styles.stateSubtitle}>{message}</Text>
          <TouchableOpacity testID="book-retry" style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!pkg) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="book">
      <Text style={styles.subtitle}>{t('requestBookingFor') ?? 'Request booking for:'}</Text>
      <Text style={styles.pkgTitle} testID="book-package-title">
        {pkgTitle}
      </Text>

      <View style={styles.form}>
        <DateRangeSelect
          labelFrom={t('preferredStartDate') ?? 'Preferred start date'}
          labelTo={t('preferredEndDate') ?? 'Preferred end date'}
          valueFrom={startIso}
          valueTo={endIso}
          onChangeFrom={setStartIso}
          onChangeTo={setEndIso}
        />

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('numberOfTravelers') ?? 'Number of Travelers'}</Text>
          <TextInput
            testID="book-travelers"
            style={styles.input}
            value={travelers}
            onChangeText={setTravelers}
            keyboardType="number-pad"
            placeholderTextColor={Colors.textSecondary}
          />
          <Text style={styles.hint}>{t('travelersHint') ?? '1 - 20'}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('notes') ?? 'Notes / Special Requests'}</Text>
          <TextInput
            testID="book-notes"
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <TouchableOpacity
          testID="book-submit"
          style={[styles.button, { opacity: isLoading || !isValid ? 0.6 : 1 }]}
          onPress={handleRequest}
          disabled={isLoading || !isValid}
        >
          <Text style={styles.buttonText}>
            {isLoading ? t('loading') ?? 'Loading…' : t('submit') ?? 'Submit'}
          </Text>
        </TouchableOpacity>

        {!isValid ? (
          <Text style={styles.validationText}>
            {t('bookingValidationHint') ?? 'Please select a valid date range and number of travelers.'}
          </Text>
        ) : null}

        {user && (!profileFullName?.trim() || !profilePhone?.trim()) ? (
          <Text style={styles.validationText}>
            {t('needNamePhoneToBook') ?? 'Please enter your full name and phone number in Account before booking.'}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stateCenter: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  stateSubtitle: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryButton: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  retryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  content: { padding: 24 },
  subtitle: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  pkgTitle: { color: Colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.3, marginBottom: 20, marginTop: 6 },
  form: { gap: 24 },
  inputContainer: { gap: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: Colors.card, height: 50, borderRadius: 12, paddingHorizontal: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontWeight: '600' },
  textArea: { height: 120, paddingTop: 16, textAlignVertical: 'top' },
  button: { backgroundColor: Colors.tint, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  buttonText: { color: Colors.background, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  validationText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
