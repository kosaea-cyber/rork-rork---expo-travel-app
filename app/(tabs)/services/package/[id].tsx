import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';

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

export default function PackageDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as PreferredLanguage;

  const { user } = useAuthStore();

  const { data: pkgData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['package', { id: id ?? null }],
    enabled: Boolean(id),
    queryFn: async (): Promise<PackageRow> => {
      console.log('[package] fetching', { id });

      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, category_id, is_active, sort_order, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type',
        )
        .eq('id', id as string)
        .maybeSingle();

      if (error) {
        console.log('[package] fetch error', error);
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error('Package not found');
      }

      console.log('[package] fetched', { id: data.id });
      return data as PackageRow;
    },
  });

  const onRetry = useCallback(() => {
    console.log('[package] retry');
    refetch();
  }, [refetch]);

  const title = useMemo(() => {
    if (!pkgData) return '';
    return getLocalizedText(pkgData, 'title', language);
  }, [language, pkgData]);

  const description = useMemo(() => {
    if (!pkgData) return '';
    return getLocalizedText(pkgData, 'description', language);
  }, [language, pkgData]);

  const price = useMemo(() => {
    if (!pkgData) return null;
    return formatPrice(pkgData, language);
  }, [language, pkgData]);

  const handleBook = useCallback(() => {
    if (!pkgData) return;

    if (user) {
      router.push({ pathname: '/(tabs)/services/book', params: { packageId: pkgData.id } });
    } else {
      router.push('/auth/login');
    }
  }, [pkgData, router, user]);

  if (!id) {
    return (
      <View style={styles.container} testID="package-details-missing-id">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>Missing package id</Text>
          <TouchableOpacity testID="package-details-back" style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container} testID="package-details-loading">
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
      <View style={styles.container} testID="package-details-error">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>{t('somethingWentWrong') ?? 'Something went wrong'}</Text>
          <Text style={styles.stateSubtitle}>{message}</Text>
          <TouchableOpacity testID="package-details-retry" style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pkg = pkgData;

  return (
    <View style={styles.container} testID="package-details">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {pkg?.image_url ? (
          <Image testID="package-details-image" source={{ uri: pkg.image_url }} style={styles.image} />
        ) : null}

        <View style={styles.header}>
          <Text style={styles.title} testID="package-details-title">
            {title || (t('package') ?? 'Package')}
          </Text>
          {price ? (
            <Text style={styles.price} testID="package-details-price">
              {price}
            </Text>
          ) : null}
        </View>

        {description ? (
          <Text style={styles.description} testID="package-details-description">
            {description}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity testID="package-details-book" style={styles.button} onPress={handleBook}>
          <Text style={styles.buttonText}>{user ? t('requestBooking') ?? 'Request booking' : t('loginToBook') ?? 'Login to book'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    marginTop: 16,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  infoBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
