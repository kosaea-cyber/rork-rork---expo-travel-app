import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { type Language } from '@/constants/i18n';
import { useProfileStore } from '@/store/profileStore';
import { supabase } from '@/lib/supabase/client';

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

export default function ServiceCategories() {
  const router = useRouter();
  const preferredLanguage = useProfileStore((state) => state.preferredLanguage);
  const language = (preferredLanguage ?? 'en') as Language;

  const [categories, setCategories] = useState<ServiceCategoryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    console.log('[categories] loadCategories start');
    setLoading(true);
    setError(null);

    try {
      const res = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      console.log('[categories] service_categories query', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });

      if (res.error) {
        setCategories([]);
        setError(res.error.message);
        return;
      }

      setCategories((res.data ?? []) as ServiceCategoryRow[]);
    } catch (e) {
      console.error('[categories] service_categories query unexpected error', e);
      setCategories([]);
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceCategoryRow }) => {
      const title = getLocalizedDbField(item, 'title', language);
      const description = getLocalizedDbField(item, 'description', language);
      const imageUrl = item.image_url ?? undefined;

      return (
        <TouchableOpacity
          testID={`home-category-${item.id}`}
          style={styles.card}
          onPress={() => router.push({ pathname: '/(tabs)/services', params: { category: item.id } })}
          activeOpacity={0.9}
        >
          <ImageBackground
            source={imageUrl ? { uri: imageUrl } : undefined}
            style={styles.cardBg}
            imageStyle={styles.cardBgImg}
          >
            <View style={styles.cardOverlay}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {description}
              </Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      );
    },
    [language, router]
  );

  const emptyState = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateText}>Loading categories…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AlertTriangle color={Colors.textSecondary} size={18} />
            <Text style={styles.stateText} numberOfLines={2}>
              Couldn’t load categories.
            </Text>
          </View>

          <TouchableOpacity testID="home-categories-retry" style={styles.retryBtn} onPress={loadCategories}>
            <RefreshCcw color={Colors.background} size={16} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>No categories available.</Text>
      </View>
    );
  }, [error, loadCategories, loading]);

  return (
    <View style={styles.container} testID="home-categories">
      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        ListEmptyComponent={emptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  card: {
    width: 170,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardBg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardBgImg: {
    borderRadius: 16,
  },
  cardOverlay: {
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(10, 25, 47, 0.78)',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  stateWrap: {
    minWidth: 220,
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.tint,
  },
  retryText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
});
