import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { formatPrice } from '@/lib/utils/formatPrice';

type PackageRow = {
  id: string;
  category_id: string | null;
  is_active: boolean | null;
  sort_order: number | null;
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


export default function PackagesListScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);

  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const { data: packagesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['packages', { category: category ?? null }],
    queryFn: async (): Promise<PackageRow[]> => {
      console.log('[packages] fetching', { category: category ?? null });

      let q = supabase
        .from('packages')
        .select(
          'id, category_id, is_active, sort_order, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type',
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (category) {
        q = q.eq('category_id', category);
      }

      const { data, error } = await q;
      if (error) {
        console.log('[packages] fetch error', error);
        throw new Error(error.message);
      }

      console.log('[packages] fetched', { count: data?.length ?? 0 });
      return (data ?? []) as PackageRow[];
    },
  });

  const data = useMemo<PackageRow[]>(() => packagesData ?? [], [packagesData]);

  const onRetry = useCallback(() => {
    console.log('[packages] retry');
    refetch();
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: PackageRow }) => {
      const price = formatPrice(item, language);
      const title = getLocalizedText(item, 'title', language);
      const description = getLocalizedText(item, 'description', language);

      return (
        <TouchableOpacity
          testID={`package-card-${item.id}`}
          style={styles.card}
          onPress={() =>
            router.push({ pathname: '/(tabs)/services/package/[id]' as any, params: { id: item.id } })
          }
        >
          <View style={styles.row}>
            {item.image_url ? (
              <Image testID={`package-image-${item.id}`} source={{ uri: item.image_url }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbPlaceholder} />
            )}

            <View style={styles.main}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {title || (t('package') ?? 'Package')}
                </Text>
                {price ? <Text style={styles.price}>{price}</Text> : null}
              </View>

              {description ? (
                <Text style={styles.description} numberOfLines={3}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [language, router, t],
  );

  if (isLoading) {
    return (
      <View style={styles.container} testID="packages-loading">
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
      <View style={styles.container} testID="packages-error">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>{t('somethingWentWrong') ?? 'Something went wrong'}</Text>
          <Text style={styles.stateSubtitle}>{message}</Text>
          <TouchableOpacity testID="packages-retry" style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        testID="packages-list"
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="packages-empty">
            <Text style={styles.emptyText}>{t('noPackagesFound') ?? 'No packages found.'}</Text>
            <TouchableOpacity testID="packages-empty-retry" style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: Colors.border,
  },
  thumbPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: Colors.border,
    opacity: 0.4,
  },
  main: {
    flex: 1,
    paddingLeft: 12,
    minHeight: 84,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
    letterSpacing: -0.2,
  },

  description: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  price: {
    color: Colors.tint,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 12,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
});
