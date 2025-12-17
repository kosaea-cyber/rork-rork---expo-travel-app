import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ArrowUpDown, UserRound, Shield, ShieldOff, X, CalendarDays } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { paged } from '@/lib/supabase/queries';
import { normalizeSupabaseError } from '@/lib/utils/supabaseError';

type ProfileRole = 'admin' | 'customer';
type ProfileLanguage = 'en' | 'ar' | 'de';

type SortKey = 'newest' | 'oldest' | 'name_az';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: ProfileLanguage | null;
  role: ProfileRole | null;
  created_at: string | null;
  is_blocked?: boolean | null;
};

type RoleFilter = 'all' | ProfileRole;
type LanguageFilter = 'all' | ProfileLanguage;

type DateRange = {
  from: string;
  to: string;
};

const PAGE_SIZE = 20;

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${a}${b}`.toUpperCase();
}

function roleLabel(role: ProfileRole | null | undefined): string {
  if (role === 'admin') return 'Admin';
  return 'Customer';
}

function languageLabel(lang: ProfileLanguage | null | undefined): string {
  if (lang === 'ar') return 'AR';
  if (lang === 'de') return 'DE';
  return 'EN';
}

function toDateOnly(value: string): string {
  const s = value.trim();
  if (s.length === 10) return s;
  if (s.length > 10) return s.slice(0, 10);
  return s;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function dateOnlyToStartIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}

function dateOnlyToEndIso(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999Z`;
}

function sortLabel(sort: SortKey): string {
  if (sort === 'oldest') return 'Oldest';
  if (sort === 'name_az') return 'Name A→Z';
  return 'Newest';
}

function safeProfileName(p: ProfileRow): string {
  const n = (p.full_name ?? '').trim();
  if (n) return n;
  return p.id.slice(0, 8);
}

export default function CustomersPage() {
  const router = useRouter();

  const [items, setItems] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [language, setLanguage] = useState<LanguageFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });
  const [sort, setSort] = useState<SortKey>('newest');

  const [cursorValue, setCursorValue] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const queryParamsKey = useMemo(() => {
    const q = search.trim().toLowerCase();
    return JSON.stringify({ q, role, language, dateRange, sort });
  }, [dateRange, language, role, search, sort]);

  const buildQuery = useCallback(
    (cursor: string | null) => {
      const q = search.trim();

      let qb = supabase
        .from('profiles')
        .select('id, full_name, phone, preferred_language, role, created_at, is_blocked');

      if (q) {
        const escaped = q.replaceAll(',', '');
        qb = qb.or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,id.ilike.%${escaped}%`);
      }

      if (role !== 'all') {
        qb = qb.eq('role', role);
      }

      if (language !== 'all') {
        qb = qb.eq('preferred_language', language);
      }

      const fromDate = toDateOnly(dateRange.from);
      const toDate = toDateOnly(dateRange.to);

      if (fromDate && isValidDateOnly(fromDate)) {
        qb = qb.gte('created_at', dateOnlyToStartIso(fromDate));
      }
      if (toDate && isValidDateOnly(toDate)) {
        qb = qb.lte('created_at', dateOnlyToEndIso(toDate));
      }

      const cursorField: keyof ProfileRow & string = sort === 'name_az' ? 'full_name' : 'created_at';
      const direction = sort === 'oldest' || sort === 'name_az' ? 'asc' : 'desc';

      qb = paged<ProfileRow>(qb as any, {
        limit: PAGE_SIZE,
        cursorField,
        cursorValue: cursor,
        direction,
      });

      console.log('[admin/customers] buildQuery', {
        q,
        role,
        language,
        dateFrom: fromDate,
        dateTo: toDate,
        sort,
        cursorField,
        cursor,
        pageSize: PAGE_SIZE,
      });

      return qb;
    },
    [dateRange.from, dateRange.to, language, role, search, sort]
  );

  const fetchPage = useCallback(
    async (cursor: string | null, mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const res = await buildQuery(cursor);
        const { data, error: qErr } = await res;

        console.log('[admin/customers] query result', {
          mode,
          returned: data?.length ?? 0,
          cursor,
          error: qErr?.message ?? null,
        });

        if (qErr) {
          throw qErr;
        }

        const next = (data ?? []) as ProfileRow[];
        setItems((prev) => (mode === 'replace' ? next : [...prev, ...next]));

        const last = next[next.length - 1];
        const nextCursor =
          last != null
            ? String((sort === 'name_az' ? (last.full_name ?? '') : last.created_at) ?? '')
            : '';

        setCursorValue(nextCursor.length ? nextCursor : null);
        setHasMore(next.length === PAGE_SIZE);
      } catch (e) {
        console.error('[admin/customers] fetchPage error', e);
        setError(normalizeSupabaseError(e));
        if (mode === 'replace') setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery, sort]
  );

  useEffect(() => {
    setCursorValue(null);
    setHasMore(true);
    fetchPage(null, 'replace').catch((e) => {
      console.error('[admin/customers] initial fetch error', e);
    });
  }, [fetchPage, queryParamsKey]);

  const onRetry = useCallback(() => {
    setCursorValue(null);
    setHasMore(true);
    fetchPage(null, 'replace').catch((e) => {
      console.error('[admin/customers] retry fetch error', e);
    });
  }, [fetchPage]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    fetchPage(cursorValue, 'append').catch((e) => {
      console.error('[admin/customers] load more error', e);
    });
  }, [cursorValue, fetchPage, hasMore, loading, loadingMore]);

  const askAndToggleRole = useCallback(
    async (profile: ProfileRow) => {
      const currentRole = (profile.role ?? 'customer') as ProfileRole;
      const nextRole: ProfileRole = currentRole === 'admin' ? 'customer' : 'admin';

      Alert.alert(
        `${nextRole === 'admin' ? 'Promote to admin' : 'Demote to customer'}?`,
        `${safeProfileName(profile)} will become ${roleLabel(nextRole)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('[admin/customers] update role', {
                  id: profile.id,
                  from: currentRole,
                  to: nextRole,
                });
                const { error: upErr } = await supabase
                  .from('profiles')
                  .update({ role: nextRole })
                  .eq('id', profile.id);

                if (upErr) throw upErr;

                setItems((prev) =>
                  prev.map((p) => (p.id === profile.id ? { ...p, role: nextRole } : p))
                );
              } catch (e) {
                console.error('[admin/customers] update role failed', e);
                Alert.alert('Could not update role', 'Please try again.');
              }
            },
          },
        ]
      );
    },
    []
  );

  const renderRow = useCallback(
    ({ item }: { item: ProfileRow }) => {
      const name = safeProfileName(item);
      const badgeBg = item.role === 'admin' ? 'rgba(255, 211, 105, 0.14)' : 'rgba(255,255,255,0.06)';
      const badgeBorder = item.role === 'admin' ? 'rgba(255, 211, 105, 0.35)' : 'rgba(255,255,255,0.08)';
      const badgeText = item.role === 'admin' ? '#FFD369' : Colors.textSecondary;

      return (
        <View style={styles.rowCard} testID={`adminCustomersRow-${item.id}`}>
          <Pressable
            testID={`adminCustomersRowView-${item.id}`}
            onPress={() => router.push(`/admin/customer/${item.id}`)}
            style={styles.rowMain}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>

            <View style={styles.rowInfo}>
              <View style={styles.rowTopLine}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                  <Text style={[styles.roleBadgeText, { color: badgeText }]}>{roleLabel(item.role)}</Text>
                </View>
              </View>

              <View style={styles.rowMetaLine}>
                <View style={styles.metaPill}>
                  <UserRound size={14} color={Colors.textSecondary} />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {item.phone?.trim() ? item.phone : item.id.slice(0, 8)}
                  </Text>
                </View>

                <View style={styles.metaPill}>
                  <CalendarDays size={14} color={Colors.textSecondary} />
                  <Text style={styles.metaPillText}>{formatDateShort(item.created_at)}</Text>
                </View>

                <View style={styles.langChip}>
                  <Text style={styles.langChipText}>{languageLabel(item.preferred_language)}</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.rowActions}>
            <TouchableOpacity
              testID={`adminCustomersRowEdit-${item.id}`}
              style={styles.actionBtn}
              onPress={() => router.push(`/admin/customer/${item.id}`)}
            >
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`adminCustomersRowToggleRole-${item.id}`}
              style={[styles.actionBtn, styles.actionBtnAlt]}
              onPress={() => {
                askAndToggleRole(item).catch((e) => console.error('[admin/customers] toggle role err', e));
              }}
            >
              {item.role === 'admin' ? (
                <ShieldOff size={16} color={Colors.text} />
              ) : (
                <Shield size={16} color={Colors.text} />
              )}
              <Text style={styles.actionText}>{item.role === 'admin' ? 'Demote' : 'Promote'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [askAndToggleRole, router]
  );

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (role !== 'all') n += 1;
    if (language !== 'all') n += 1;
    if (toDateOnly(dateRange.from)) n += 1;
    if (toDateOnly(dateRange.to)) n += 1;
    return n;
  }, [dateRange.from, dateRange.to, language, role]);

  return (
    <View style={styles.container} testID="adminCustomersScreen">
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            testID="adminCustomersSearch"
            style={styles.searchInput}
            placeholder="Search name / phone / id"
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.trim().length > 0 ? (
            <TouchableOpacity testID="adminCustomersSearchClear" onPress={() => setSearch('')}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            testID="adminCustomersFiltersOpen"
            style={styles.controlBtn}
            onPress={() => setFiltersOpen(true)}
          >
            <Text style={styles.controlBtnText}>Filters{activeFiltersCount ? ` (${activeFiltersCount})` : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="adminCustomersSort"
            style={styles.controlBtn}
            onPress={() => {
              const order: SortKey[] = ['newest', 'oldest', 'name_az'];
              const idx = order.indexOf(sort);
              const next = order[(idx + 1) % order.length] ?? 'newest';
              setSort(next);
            }}
          >
            <ArrowUpDown size={16} color={Colors.text} />
            <Text style={styles.controlBtnText}>{sortLabel(sort)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.stateWrap} testID="adminCustomersLoading">
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateText}>Loading profiles…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap} testID="adminCustomersError">
          <Text style={styles.stateTitle}>Couldn’t load customers</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} testID="adminCustomersRetry">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="adminCustomersList"
          data={items}
          renderItem={renderRow}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            onLoadMore();
          }}
          refreshing={loading}
          onRefresh={() => {
            setCursorValue(null);
            setHasMore(true);
            fetchPage(null, 'replace').catch((e) => console.error('[admin/customers] refresh error', e));
          }}
          ListEmptyComponent={
            <View style={styles.empty} testID="adminCustomersEmpty">
              <Text style={styles.emptyText}>No profiles found</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {loadingMore ? (
                <View style={styles.footerLoading} testID="adminCustomersLoadingMore">
                  <ActivityIndicator color={Colors.tint} />
                  <Text style={styles.footerText}>Loading more…</Text>
                </View>
              ) : hasMore ? (
                <TouchableOpacity
                  testID="adminCustomersLoadMore"
                  style={styles.loadMoreBtn}
                  onPress={onLoadMore}
                >
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.footerText}>End of list</Text>
              )}
            </View>
          }
        />
      )}

      <Modal
        visible={filtersOpen}
        animationType={Platform.OS === 'web' ? 'none' : 'slide'}
        transparent
        onRequestClose={() => setFiltersOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)} testID="adminCustomersFiltersBackdrop" />
        <View style={styles.modalCard} testID="adminCustomersFiltersModal">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity testID="adminCustomersFiltersClose" onPress={() => setFiltersOpen(false)}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Role</Text>
            <View style={styles.segmentRow}>
              {(['all', 'customer', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  testID={`adminCustomersFilterRole-${r}`}
                  style={[styles.segment, role === r && styles.segmentActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>
                    {r === 'all' ? 'All' : roleLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Language</Text>
            <View style={styles.segmentRow}>
              {(['all', 'en', 'ar', 'de'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  testID={`adminCustomersFilterLang-${l}`}
                  style={[styles.segment, language === l && styles.segmentActive]}
                  onPress={() => setLanguage(l)}
                >
                  <Text style={[styles.segmentText, language === l && styles.segmentTextActive]}>
                    {l === 'all' ? 'All' : l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Created date range (YYYY-MM-DD)</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>From</Text>
                <TextInput
                  testID="adminCustomersDateFrom"
                  style={styles.dateInput}
                  value={dateRange.from}
                  onChangeText={(v) => setDateRange((p) => ({ ...p, from: v }))}
                  placeholder="2025-01-01"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>To</Text>
                <TextInput
                  testID="adminCustomersDateTo"
                  style={styles.dateInput}
                  value={dateRange.to}
                  onChangeText={(v) => setDateRange((p) => ({ ...p, to: v }))}
                  placeholder="2025-12-31"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Text style={styles.hintText}>Leave empty to disable date filtering.</Text>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              testID="adminCustomersFiltersReset"
              style={[styles.footerBtn, styles.footerBtnGhost]}
              onPress={() => {
                setRole('all');
                setLanguage('all');
                setDateRange({ from: '', to: '' });
              }}
            >
              <Text style={styles.footerBtnGhostText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="adminCustomersFiltersApply"
              style={styles.footerBtn}
              onPress={() => {
                const from = toDateOnly(dateRange.from);
                const to = toDateOnly(dateRange.to);
                if (from && !isValidDateOnly(from)) {
                  Alert.alert('Invalid date', '“From” must be YYYY-MM-DD');
                  return;
                }
                if (to && !isValidDateOnly(to)) {
                  Alert.alert('Invalid date', '“To” must be YYYY-MM-DD');
                  return;
                }
                setFiltersOpen(false);
              }}
            >
              <Text style={styles.footerBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0A0E1C',
  },
  searchWrap: {
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    padding: 14,
    paddingBottom: 20,
    gap: 12,
  },
  rowCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 211, 105, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFD369',
    fontSize: 14,
    fontWeight: '900',
  },
  rowInfo: {
    flex: 1,
    gap: 8,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowName: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  roleBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  rowMetaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  langChip: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(122, 162, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122, 162, 247, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipText: {
    color: '#7AA2F7',
    fontSize: 12,
    fontWeight: '900',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionBtnAlt: {
    flexDirection: 'row',
    gap: 8,
  },
  actionText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  footer: {
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoading: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadMoreBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  empty: {
    paddingVertical: 42,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 20,
    backgroundColor: '#0B1022',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  modalSection: {
    gap: 8,
  },
  modalLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segment: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(255, 211, 105, 0.14)',
    borderColor: 'rgba(255, 211, 105, 0.32)',
  },
  segmentText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFD369',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  dateLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  dateInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    fontSize: 14,
    fontWeight: '700',
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
  },
  footerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  footerBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  footerBtnGhostText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
