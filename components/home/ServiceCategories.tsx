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
import { LinearGradient } from 'expo-linear-gradient';

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

function getLocalizedDbField(
  row: ServiceCategoryRow,
  field: 'title' | 'description',
  lang: Language
): string {
  const localizedKey = `${field}_${lang}` as keyof ServiceCategoryRow;
  const fallbackKey = `${field}_en` as keyof ServiceCategoryRow;

  const localized = row[localizedKey];
  if (typeof localized === 'string' && localized.length > 0) return localized;

  const fallback = row[fallbackKey];
  if (typeof fallback === 'string' && fallback.length > 0) return fallback;

  return '';
}

export default function ServiceCategories() {
  const router = useRouter();
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language = (preferredLanguage ?? 'en') as Language;

  const [categories, setCategories] = useState<ServiceCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        setCategories([]);
        setError(error.message);
        return;
      }

      setCategories((data ?? []) as ServiceCategoryRow[]);
    } catch (e) {
      console.error('[ServiceCategories] load error', e);
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
          activeOpacity={0.9}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/services',
              params: { category: item.id },
            })
          }
        >
          <ImageBackground
            source={imageUrl ? { uri: imageUrl } : undefined}
            style={styles.cardBg}
            imageStyle={styles.cardBgImg}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(10,25,47,0.95)']}
              locations={[0.25, 1]}
              style={styles.cardOverlay}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {description}
              </Text>
            </LinearGradient>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={Colors.textSecondary} />
            <Text style={styles.stateText}>Couldn’t load categories.</Text>
          </View>

          <TouchableOpacity style={styles.retryBtn} onPress={loadCategories}>
            <RefreshCcw size={16} color={Colors.background} />
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
  }, [error, loading, loadCategories]);

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
    paddingHorizontal: 14,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 4,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
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
