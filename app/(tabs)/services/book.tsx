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

export default function BookingRequestScreen() {
  const { packageId } = useLocalSearchParams<{ packageId?: string }>();
  const router = useRouter();

  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const createBooking = useBookingStore((state) => state.createBooking);
  const isLoading = useBookingStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  const [startDate, setStartDate] = useState<string>('');
  const [travelers, setTravelers] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const {
    data: pkg,
    isLoading: pkgLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['package', { id: packageId ?? null }],
    enabled: Boolean(packageId),
    queryFn: async (): Promise<PackageRow> => {
      console.log('[book] fetching package', { packageId });
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, category_id, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type',
        )
        .eq('id', packageId as string)
        .maybeSingle();

      if (error) {
        console.log('[book] package fetch error', error);
        throw new Error(error.message);
      }
      if (!data) throw new Error('Package not found');

      console.log('[book] package fetched', { id: data.id });
      return data as PackageRow;
    },
  });

  const pkgTitle = useMemo(() => {
    if (!pkg) return '';
    return getLocalizedText(pkg, 'title', language);
  }, [language, pkg]);

  const handleRequest = useCallback(async () => {
    if (!startDate || !pkg || !user) return;

    const finalNotes = [
      `Package: ${pkgTitle} (${pkg.id})`,
      `Preferred start date: ${startDate}`,
      `Travelers: ${parseInt(travelers, 10) || 1}`,
      notes?.trim() ? `Notes: ${notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const created = await createBooking({ notes: finalNotes });

    if (!created) {
      Alert.alert(t('somethingWentWrong') ?? 'Something went wrong', t('retry') ?? 'Please try again');
      return;
    }

    Alert.alert('Success', t('bookingRequestSent') ?? 'Booking request sent', [
      { text: 'OK', onPress: () => router.navigate('/(tabs)/bookings') },
    ]);
  }, [createBooking, notes, pkg, pkgTitle, router, startDate, t, travelers, user]);

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
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('preferredStartDate') ?? 'Preferred Start Date (YYYY-MM-DD)'}</Text>
          <TextInput
            testID="book-start-date"
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2025-12-01"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

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

        <TouchableOpacity testID="book-submit" style={styles.button} onPress={handleRequest} disabled={isLoading || !startDate}>
          <Text style={styles.buttonText}>{isLoading ? t('loading') ?? 'Loading…' : t('submit') ?? 'Submit'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stateCenter: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  stateSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 10,
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
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  pkgTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 32,
    marginTop: 6,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.card,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontWeight: '600',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    opacity: 1,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
