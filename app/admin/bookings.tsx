import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { type BookingStatus } from '@/store/bookingStore';
import { useI18nStore } from '@/constants/i18n';
import { type PreferredLanguage } from '@/store/profileStore';

type Filter = 'all' | 'pending' | 'confirmed' | 'cancelled';

type AdminBookingListRow = {
  id: string;
  user_id: string | null;
  status: BookingStatus;
  created_at: string | null;

  package_id: string | null;
  preferred_start_date: string | null; // YYYY-MM-DD
  preferred_end_date: string | null; // YYYY-MM-DD
  travelers: number;
  customer_notes: string | null;

  profiles: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    preferred_language: PreferredLanguage | null;
  } | null;

  packages: {
    id: string;
    title_en: string | null;
    title_ar: string | null;
    title_de: string | null;
  } | null;
};

function getStatusColor(status: string) {
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

function getLocalizedTitle(
  pkg: NonNullable<AdminBookingListRow['packages']>,
  lang: PreferredLanguage,
) {
  const v = lang === 'ar' ? pkg.title_ar : lang === 'de' ? pkg.title_de : pkg.title_en;
  return (v ?? pkg.title_en ?? pkg.title_de ?? pkg.title_ar ?? '').trim();
}

export default function BookingsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const t = useI18nStore((s) => s.t);
  const fallbackLanguage = useI18nStore((s) => s.language) as PreferredLanguage;

  const [rows, setRows] = useState<AdminBookingListRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          id,
          user_id,
          status,
          created_at,
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
            preferred_language
          ),

          packages:packages!bookings_package_id_fkey (
            id,
            title_en,
            title_ar,
            title_de
          )
        `,
        )
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      setRows((data ?? []) as AdminBookingListRow[]);
      setIsLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((b) => (filter === 'all' ? true : b.status === filter));
  }, [rows, filter]);

  const formatDateRange = (b: AdminBookingListRow) => {
    const from = b.preferred_start_date;
    const to = b.preferred_end_date;
    if (!from && !to) return '—';
    if (from && to) return `${from} → ${to}`;
    return from ?? to ?? '—';
  };

  const renderItem = ({ item }: { item: AdminBookingListRow }) => {
    const name = item.profiles?.full_name?.trim() || '—';
    const email = item.profiles?.email?.trim() || '—';
    const phone = item.profiles?.phone?.trim() || '—';

    const customerLang = (item.profiles?.preferred_language ?? fallbackLanguage ?? 'en') as PreferredLanguage;
    const pkgTitle = item.packages ? getLocalizedTitle(item.packages, customerLang) : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/admin/booking/${item.id}`)}
        testID={`admin-booking-${item.id}`}
      >
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.ref}>#{item.id.slice(0, 8)}</Text>

            <Text style={styles.meta}>
              {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
            </Text>

            <Text style={styles.titleLine} numberOfLines={1}>
              {pkgTitle || item.package_id || (t('package') ?? 'Package')}
            </Text>

            <View style={styles.inlinePills}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{formatDateRange(item)}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {(t('travelers') ?? 'Travelers')}: {String(item.travelers ?? 1)}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {(t('lang') ?? 'Lang')}: {customerLang.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.customerBox}>
              <Text style={styles.customerLine} numberOfLines={1}>
                {(t('customer') ?? 'Customer')}: {name}
              </Text>
              <Text style={styles.customerSub} numberOfLines={1}>
                {email} • {phone}
              </Text>

              {item.customer_notes?.trim() ? (
                <Text style={styles.noteLine} numberOfLines={2}>
                  {item.customer_notes.trim()}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.activeTab]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.activeTabText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} testID="adminBookingsLoading" />
      ) : error ? (
        <View style={styles.empty} testID="adminBookingsError">
          <Text style={styles.emptyText}>Failed to load bookings.</Text>
          <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>{error}</Text>
          <TouchableOpacity style={[styles.tab, { marginTop: 16 }]} onPress={load} testID="adminBookingsRetry">
            <Text style={styles.tabText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={Colors.tint} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="adminBookingsEmpty">
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    padding: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: Colors.tint },

  tabs: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: Colors.card,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeTab: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  tabText: { color: Colors.textSecondary, fontWeight: '700' },
  activeTabText: { color: Colors.background },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  ref: { fontSize: 16, fontWeight: '900', color: Colors.text },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, fontWeight: '700' },

  titleLine: { marginTop: 10, fontSize: 16, fontWeight: '900', color: Colors.text },

  inlinePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: { fontSize: 12, color: Colors.text, fontWeight: '800' },

  customerBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  customerLine: { fontSize: 12, color: Colors.text, fontWeight: '900' },
  customerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, fontWeight: '700' },
  noteLine: { fontSize: 12, color: Colors.text, marginTop: 8, fontWeight: '700' },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontWeight: '700', textAlign: 'center' },
});
