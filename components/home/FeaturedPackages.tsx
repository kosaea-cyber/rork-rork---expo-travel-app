import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';

type PackageRow = {
  id: string;
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

function getStartingFromLabel(lang: PreferredLanguage): string {
  if (lang === 'ar') return 'ابتداءً من';
  if (lang === 'de') return 'Ab';
  return 'Starting from';
}

function formatPrice(row: PackageRow, lang: PreferredLanguage): string | null {
  if (row.price_amount == null || !row.price_currency) return null;
  let formatted = '';
  try {
    formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: row.price_currency,
      maximumFractionDigits: 2,
    }).format(row.price_amount);
  } catch {
    formatted = `${row.price_amount} ${row.price_currency}`;
  }

  if (row.price_type === 'starting_from') {
    return `${getStartingFromLabel(lang)} ${formatted}`;
  }

  return formatted;
}

export default function FeaturedPackages() {
  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const router = useRouter();

  const {
    data: packagesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['packages', { featured: true }],
    queryFn: async (): Promise<PackageRow[]> => {
      console.log('[featuredPackages] fetching');
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, is_active, sort_order, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type',
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(3);

      if (error) {
        console.log('[featuredPackages] fetch error', error);
        throw new Error(error.message);
      }

      console.log('[featuredPackages] fetched', { count: data?.length ?? 0 });
      return (data ?? []) as PackageRow[];
    },
  });

  const data = useMemo<PackageRow[]>(() => packagesData ?? [], [packagesData]);

  const renderItem = useCallback(
    ({ item }: { item: PackageRow }) => {
      const title = getLocalizedText(item, 'title', language);
      const price = formatPrice(item, language);

      return (
        <TouchableOpacity
          testID={`featured-package-${item.id}`}
          style={styles.card}
          onPress={() => router.push({ pathname: '/(tabs)/services/package/[id]', params: { id: item.id } })}
          activeOpacity={0.9}
        >
          <View style={styles.imageContainer}>
            {item.image_url ? (
              <Image testID={`featured-package-image-${item.id}`} source={{ uri: item.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imageFallback} />
            )}

            {price ? (
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText} numberOfLines={1}>
                  {price}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {title || (t('package') ?? 'Package')}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [language, router, t],
  );

  return (
    <View style={styles.container} testID="featured-packages">
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('featuredPackages') ?? 'Featured packages'}</Text>
        {isLoading ? <ActivityIndicator testID="featured-packages-loading" color={Colors.tint} /> : null}
      </View>

      {isError ? (
        <TouchableOpacity testID="featured-packages-retry" style={styles.retryInline} onPress={() => refetch()}>
          <Text style={styles.retryInlineText}>{t('retry') ?? 'Retry'}</Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        testID="featured-packages-list"
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <View style={styles.empty} testID="featured-packages-empty">
              <Text style={styles.emptyText}>{t('noPackagesFound') ?? 'No packages found.'}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  retryInline: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  retryInlineText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  empty: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    width: 220,
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    height: 130,
    backgroundColor: '#0f1624',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
  },
  pricePill: {
    position: 'absolute',
    right: 10,
    top: 10,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 22, 36, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  pricePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  content: {
    padding: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
