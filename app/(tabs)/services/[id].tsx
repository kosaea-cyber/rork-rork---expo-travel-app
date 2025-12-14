import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useI18nStore, type Language } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore } from '@/store/profileStore';

type ServiceCategoryRow = {
  id: string;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_de: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

function getLocalizedDbField(row: ServiceCategoryRow, field: 'title' | 'description', lang: Language): string {
  const key = `${field}_${lang}` as const;
  const fallbackEn = `${field}_en` as const;
  const value = row[key as keyof ServiceCategoryRow];
  if (typeof value === 'string' && value.length > 0) return value;
  const en = row[fallbackEn as keyof ServiceCategoryRow];
  if (typeof en === 'string' && en.length > 0) return en;
  return '';
}

export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const t = useI18nStore((state) => state.t);
  const fallbackLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? fallbackLanguage ?? 'en') as Language;

  const {
    data: category,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['service_category', { id: id ?? null }],
    enabled: Boolean(id),
    queryFn: async (): Promise<ServiceCategoryRow> => {
      console.log('[serviceDetails] fetching service_categories', { id });

      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('id', id as string)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.log('[serviceDetails] fetch error', error);
        throw new Error(error.message);
      }
      if (!data) throw new Error('Service not found');

      console.log('[serviceDetails] fetched', { id: data.id });
      return data as ServiceCategoryRow;
    },
  });

  const title = useMemo(() => {
    if (!category) return '';
    return getLocalizedDbField(category, 'title', language);
  }, [category, language]);

  const description = useMemo(() => {
    if (!category) return '';
    return getLocalizedDbField(category, 'description', language);
  }, [category, language]);

  const onRetry = useCallback(() => {
    console.log('[serviceDetails] retry');
    refetch();
  }, [refetch]);

  if (!id) {
    return (
      <View style={styles.container} testID="service-details-missing-id">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>Missing service id</Text>
          <TouchableOpacity testID="service-details-back" style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container} testID="service-details-loading">
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
      <View style={styles.container} testID="service-details-error">
        <View style={styles.stateCenter}>
          <Text style={styles.stateTitle}>{t('somethingWentWrong') ?? 'Something went wrong'}</Text>
          <Text style={styles.stateSubtitle}>{message}</Text>
          <TouchableOpacity testID="service-details-retry" style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>{t('retry') ?? 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} testID="service-details">
      {category?.image_url ? <Image source={{ uri: category.image_url }} style={styles.image} /> : <View style={styles.imageFallback} />}

      <View style={styles.content}>
        <Text style={styles.title} testID="service-details-title">
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} testID="service-details-description">
            {description}
          </Text>
        ) : null}

        {category ? (
          <TouchableOpacity
            testID="service-details-view-packages"
            style={styles.button}
            onPress={() => router.push({ pathname: '/(tabs)/services/packages', params: { category: category.id } })}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>{t('viewPackages') ?? 'View packages'}</Text>
          </TouchableOpacity>
        ) : null}
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
  image: {
    width: '100%',
    height: 260,
  },
  imageFallback: {
    width: '100%',
    height: 260,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: Colors.text,
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
