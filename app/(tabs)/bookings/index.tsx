import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Modal,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarList, type DateData } from 'react-native-calendars';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { type BookingRow, useBookingStore } from '@/store/bookingStore';
import HeaderLogo from '@/components/HeaderLogo';

type DateRange = { from: string; to: string } | null;

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

function buildMarkedDates(range: DateRange): Record<string, unknown> {
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

  marks[from] = { startingDay: true, color: Colors.tint, textColor: Colors.background };
  marks[to] = { endingDay: true, color: Colors.tint, textColor: Colors.background };

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let t = start.getTime() + dayMs; t < end.getTime(); t += dayMs) {
    const d = new Date(t);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    marks[iso] = { color: 'rgba(212,175,55,0.30)', textColor: Colors.text };
  }

  return marks;
}

export default function BookingsScreen() {
  const t = useI18nStore((state) => state.t);
  const router = useRouter();
  const { packageId: rawPackageId } = useLocalSearchParams<{ packageId?: string }>();
  const packageId = typeof rawPackageId === 'string' ? rawPackageId : '';

  const { user, isGuest } = useAuthStore();
  const myBookings = useBookingStore((s) => s.myBookings);
  const isLoading = useBookingStore((s) => s.isLoading);
  const error = useBookingStore((s) => s.error);
  const fetchMyBookings = useBookingStore((s) => s.fetchMyBookings);
  const createBooking = useBookingStore((s) => s.createBooking);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [range, setRange] = useState<DateRange>(null);
  const [rangeDraft, setRangeDraft] = useState<DateRange>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  const [travelers, setTravelers] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const today = useMemo(() => isoToday(), []);

  const isAuthedCustomer = Boolean(user) && !isGuest;

  const rangeLabel = useMemo(() => {
    if (!range) return '';
    return `${range.from} → ${range.to}`;
  }, [range]);

  const markedDates = useMemo(() => buildMarkedDates(rangeDraft), [rangeDraft]);

  const sorted = useMemo(() => {
    return [...myBookings].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [myBookings]);

  const onRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await fetchMyBookings();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMyBookings]);

  useEffect(() => {
    if (user) {
      fetchMyBookings();
    }
  }, [user, fetchMyBookings]);

  const openCalendar = useCallback(() => {
    setRangeDraft(range);
    setIsCalendarOpen(true);
  }, [range]);

  const closeCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, []);

  const clearRange = useCallback(() => {
    setRangeDraft(null);
  }, []);

  const onPickDay = useCallback(
    (day: DateData) => {
      const picked = day.dateString;
      if (picked < today) return;

      setRangeDraft((prev) => {
        if (!prev) return { from: picked, to: picked };

        if (prev.from && prev.to && prev.from !== prev.to) {
          return { from: picked, to: picked };
        }

        return clampRange(prev.from, picked);
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

  const handleSubmit = useCallback(async () => {
    if (!packageId) {
      Alert.alert(t('somethingWentWrong') ?? 'Something went wrong', 'Missing package id');
      return;
    }

    if (!range?.from) {
      Alert.alert(t('somethingWentWrong') ?? 'Something went wrong', 'Please select a date range');
      return;
    }

    const travelersInt = Math.max(1, parseInt(travelers, 10) || 1);

    console.log('[bookings/index] createBooking submit', {
      packageId,
      preferredStartDate: range.from,
      preferredEndDate: range.to,
      travelers: travelersInt,
      customerNotesLen: notes.length,
    });

    const created = await createBooking({
      packageId,
      preferredStartDate: range.from,
      preferredEndDate: range.to,
      travelers: travelersInt,
      customerNotes: notes?.trim() ? notes.trim() : undefined,
    });

    if (!created) {
      Alert.alert(t('somethingWentWrong') ?? 'Something went wrong', t('retry') ?? 'Please try again');
      return;
    }

    Alert.alert('Success', t('bookingRequestSent') ?? 'Booking request sent', [
      {
        text: 'OK',
        onPress: () => router.push({ pathname: '/(tabs)/bookings/[id]' as any, params: { id: created.id } }),
      },
    ]);

    setNotes('');
    setTravelers('1');
    setRange(null);
    setRangeDraft(null);
  }, [createBooking, notes, packageId, range, router, t, travelers]);

  const getStatusMeta = useCallback(
    (status: string): { label: string; color: string } => {
      switch (status) {
        case 'confirmed':
          return { label: t('confirmed') ?? 'Confirmed', color: Colors.success };
        case 'cancelled':
          return { label: t('cancelled') ?? 'Cancelled', color: Colors.error };
        default:
          return { label: t('pending') ?? 'Pending', color: '#FFA000' };
      }
    },
    [t],
  );

  const renderItem = useCallback(
    ({ item }: { item: BookingRow }) => {
      const meta = getStatusMeta(item.status);
      return (
        <TouchableOpacity
          testID={`booking-item-${item.id}`}
          style={styles.card}
          onPress={() => router.push({ pathname: '/(tabs)/bookings/[id]' as any, params: { id: item.id } })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.idText}>#{item.id.slice(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.color + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>

          <Text style={styles.packageTitle} numberOfLines={1}>
            {item.notes?.trim() ? item.notes.split('\n')[0] : t('booking') ?? 'Booking'}
          </Text>

          <View style={styles.row}>
            <Text style={styles.dateLabel}>{t('createdAt') ?? 'Created:'}</Text>
            <Text style={styles.dateValue}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [getStatusMeta, router, t],
  );

  if (!user && !isGuest) {
    return null;
  }

  if (!isAuthedCustomer) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.message}>{t('loginToBook')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/auth/login' as any)}>
          <Text style={styles.buttonText}>{t('login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabBookings')}</Text>
        <HeaderLogo />
      </View>

      <FlatList
        testID="my-bookings-list"
        data={sorted}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.tint} colors={[Colors.tint]} />
        }
        ListHeaderComponent={
          packageId ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.createCard}
              testID="booking-create-card"
            >
              <Text style={styles.createTitle}>{t('requestBooking') ?? 'Request booking'}</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('preferredStartDate') ?? 'Preferred dates'}</Text>

                <TouchableOpacity testID="booking-date-range-open" onPress={openCalendar} activeOpacity={0.9}>
                  <View pointerEvents="none">
                    <TextInput
                      testID="booking-date-range"
                      style={styles.input}
                      value={rangeLabel}
                      editable={false}
                      placeholder={t('selectDateRange') ?? 'Select date range'}
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                <Text style={styles.rangeText} testID="booking-date-range-label">
                  {range ? `${range.from} → ${range.to}` : '—'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('numberOfTravelers') ?? 'Travelers'}</Text>
                <TextInput
                  testID="booking-travelers"
                  style={styles.input}
                  value={travelers}
                  onChangeText={setTravelers}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  placeholder="1"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('notes') ?? 'Notes'}</Text>
                <TextInput
                  testID="booking-notes"
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  placeholder={t('notesPlaceholder') ?? 'Anything we should know? (optional)'}
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <TouchableOpacity
                testID="booking-submit"
                style={[styles.button, !range?.from ? styles.buttonDisabled : null]}
                onPress={handleSubmit}
                disabled={isLoading || !range?.from}
              >
                <Text style={styles.buttonText}>{isLoading ? t('loading') ?? 'Loading…' : t('submit') ?? 'Submit'}</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator color={Colors.tint} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{error?.message ?? t('noBookings')}</Text>
              {error?.message ? (
                <TouchableOpacity testID="bookings-retry" style={styles.retryButton} onPress={() => fetchMyBookings()}>
                  <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
      />

      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
        testID="booking-calendar-modal"
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCalendar} testID="booking-calendar-close" />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectDateRange') ?? 'Select date range'}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={clearRange} style={styles.modalBtnGhost} testID="booking-calendar-clear">
                  <Text style={styles.modalBtnGhostText}>{t('clear') ?? 'Clear'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={applyRange} style={styles.modalBtnPrimary} testID="booking-calendar-apply">
                  <Text style={styles.modalBtnPrimaryText}>{t('apply') ?? 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSub}>
              <Text style={styles.modalSubText}>
                {rangeDraft
                  ? `${rangeDraft.from} → ${rangeDraft.to}`
                  : t('pickStartThenEnd') ?? 'Pick start date, then end date.'}
              </Text>
            </View>

            <ScrollView contentContainerStyle={styles.calendarWrap}>
              <CalendarList
                onDayPress={onPickDay}
                minDate={today}
                pastScrollRange={0}
                futureScrollRange={12}
                scrollEnabled
                showScrollIndicator={false}
                markingType="period"
                markedDates={markedDates as any}
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  createCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  createTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  rangeText: {
    marginTop: 8,
    color: Colors.text,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Courier',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  packageTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    color: Colors.textSecondary,
    marginRight: 8,
  },
  dateValue: {
    color: Colors.text,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
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
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 14,
    maxHeight: '86%',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnGhostText: {
    color: Colors.text,
    fontWeight: '800',
  },
  modalBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.tint,
  },
  modalBtnPrimaryText: {
    color: Colors.background,
    fontWeight: '900',
  },
  modalSub: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalSubText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarWrap: {
    paddingHorizontal: 10,
    paddingBottom: 14,
  },
});
