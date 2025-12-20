import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarList, DateData } from 'react-native-calendars';

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

type DateRange = { from: string; to: string } | null;

function getLocalizedText(row: PackageRow, key: 'title' | 'description', lang: PreferredLanguage): string {
  const v =
    lang === 'ar'
      ? key === 'title'
        ? row.title_ar
        : row.description_ar
      : lang === 'de'
        ? key === 'title'
          ? row.title_de
          : row.description_de
        : key === 'title'
          ? row.title_en
          : row.description_en;

  const fallback = key === 'title' ? row.title_en : row.description_en;
  return (v ?? fallback ?? '').trim();
}

function isoToday(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function clampRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

function buildMarkedDates(range: DateRange): Record<string, any> {
  if (!range) return {};

  const { from, to } = range;
  const marks: Record<string, any> = {};

  if (from === to) {
    marks[from] = {
      selected: true,
      startingDay: true,
      endingDay: true,
      color: Colors.tint,
      textColor: Colors.background,
    };
    return marks;
  }

  // react-native-calendars uses period marking: startingDay/endingDay
  marks[from] = { startingDay: true, color: Colors.tint, textColor: Colors.background };
  marks[to] = { endingDay: true, color: Colors.tint, textColor: Colors.background };

  // Fill in-between (simple loop day-by-day)
  // Note: This is safe for typical date ranges; booking ranges are short.
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let t = start.getTime() + dayMs; t < end.getTime(); t += dayMs) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    marks[iso] = { color: 'rgba(212,175,55,0.35)', textColor: Colors.text };
  }

  return marks;
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

  const [range, setRange] = useState<DateRange>(null);
  const [rangeDraft, setRangeDraft] = useState<DateRange>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  const [travelers, setTravelers] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const today = useMemo(() => isoToday(), []);

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

  const rangeLabel = useMemo(() => {
    if (!range) return '';
    if (range.from === range.to) return range.from;
    return `${range.from} → ${range.to}`;
  }, [range]);

  const openCalendar = useCallback(() => {
    // start with current range as draft
    setRangeDraft(range);
    setIsCalendarOpen(true);
  }, [range]);

  const closeCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, []);

  const onPickDay = useCallback(
    (day: DateData) => {
      const picked = day.dateString;

      // prevent past days (CalendarList already uses minDate, but keep safe)
      if (picked < today) return;

      setRangeDraft((prev) => {
        if (!prev) return { from: picked, to: picked };

        // If user already picked a full range, start a new one
        if (prev.from && prev.to && prev.from !== prev.to) {
          return { from: picked, to: picked };
        }

        // If only one date selected (from===to), extend to second date
        const next = clampRange(prev.from, picked);
        return next;
      });
    },
    [today],
  );

  const applyRange = useCallback(() => {
    if (!rangeDraft?.from || !rangeDraft?.to) {
      setRange(null);
      setIsCalendarOpen(false);
      return;
    }
    const next = clampRange(rangeDraft.from, rangeDraft.to);
    setRange(next);
    setIsCalendarOpen(false);
  }, [rangeDraft]);

  const clearRange = useCallback(() => {
    setRangeDraft(null);
  }, []);

  const markedDates = useMemo(() => buildMarkedDates(rangeDraft), [rangeDraft]);

  const handleRequest = useCallback(async () => {
    if (!pkg || !user || !range?.from) return;

    const travelersInt = parseInt(travelers, 10) || 1;

    const dateLine =
      range && range.from
        ? range.to && range.to !== range.from
          ? `Preferred dates: ${range.from} to ${range.to}`
          : `Preferred date: ${range.from}`
        : 'Preferred date: (missing)';

    const finalNotes = [
      `Package: ${pkgTitle} (${pkg.id})`,
      dateLine,
      `Travelers: ${travelersInt}`,
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
  }, [createBooking, notes, pkg, pkgTitle, range, router, t, travelers, user]);

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
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="book">
        <Text style={styles.subtitle}>{t('requestBookingFor') ?? 'Request booking for:'}</Text>
        <Text style={styles.pkgTitle} testID="book-package-title">
          {pkgTitle}
        </Text>

        <View style={styles.form}>
          {/* Date Range Picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('preferredStartDate') ?? 'Preferred Dates'}</Text>

            <Pressable onPress={openCalendar} testID="book-date-range-open">
              <View pointerEvents="none">
                <TextInput
                  testID="book-date-range"
                  style={styles.input}
                  value={rangeLabel}
                  editable={false}
                  placeholder="Select dates (from → to)"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </Pressable>

            <Text style={styles.hint}>
              {range
                ? range.from === range.to
                  ? 'Selected: 1 day'
                  : `Selected: ${range.from} → ${range.to}`
                : 'Tap to choose your preferred travel dates.'}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('numberOfTravelers') ?? 'Number of Travelers'}</Text>
            <TextInput
              testID="book-travelers"
              style={styles.input}
              value={travelers}
              onChangeText={setTravelers}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
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

          <TouchableOpacity
            testID="book-submit"
            style={styles.button}
            onPress={handleRequest}
            disabled={isLoading || !range?.from}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('loading') ?? 'Loading…' : t('submit') ?? 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
        testID="book-calendar-modal"
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCalendar} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select dates</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={clearRange} style={styles.modalBtnGhost} testID="book-calendar-clear">
                  <Text style={styles.modalBtnGhostText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={applyRange} style={styles.modalBtnPrimary} testID="book-calendar-apply">
                  <Text style={styles.modalBtnPrimaryText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSub}>
              <Text style={styles.modalSubText}>
                {rangeDraft
                  ? rangeDraft.from === rangeDraft.to
                    ? `Selected: ${rangeDraft.from}`
                    : `Selected: ${rangeDraft.from} → ${rangeDraft.to}`
                  : 'Pick start date, then end date.'}
              </Text>
            </View>

            <CalendarList
              onDayPress={onPickDay}
              minDate={today}
              pastScrollRange={0}
              futureScrollRange={12}
              scrollEnabled
              showScrollIndicator={false}
              markingType="period"
              markedDates={markedDates}
              theme={{
                backgroundColor: Colors.card,
                calendarBackground: Colors.card,
                textSectionTitleColor: Colors.textSecondary,
                dayTextColor: Colors.text,
                monthTextColor: Colors.text,
                selectedDayTextColor: Colors.background,
                todayTextColor: Colors.tint,
                arrowColor: Colors.tint,
              }}
            />
          </View>
        </View>
      </Modal>
    </>
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
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  modalSheet: {
    height: '78%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  modalBtnGhostText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.tint,
  },
  modalBtnPrimaryText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '900',
  },
  modalSub: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  modalSubText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
