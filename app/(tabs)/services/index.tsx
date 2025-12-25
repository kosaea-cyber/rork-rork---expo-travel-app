import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import HeaderLogo from '@/components/HeaderLogo';
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
  const key = `${field}_${lang}` as const;
  const fallbackEn = `${field}_en` as const;

  const value = row[key as keyof ServiceCategoryRow];
  if (typeof value === 'string' && value.length > 0) return value;

  const en = row[fallbackEn as keyof ServiceCategoryRow];
  if (typeof en === 'string' && en.length > 0) return en;

  return '';
}

type Chip = { id: string; label: string };

export default function ServicesScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams<{ category: string }>();

  const preferredLanguage = useProfileStore((state) => state.preferredLanguage);
  const language = (preferredLanguage ?? 'en') as Language;

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [categories, setCategories] = useState<ServiceCategoryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (res.error) {
        setError(res.error.message);
        setCategories([]);
        return;
      }

      setCategories((res.data ?? []) as ServiceCategoryRow[]);
    } catch {
      setError('Failed to load services.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const chips: Chip[] = useMemo(() => {
    const allLabel =
      language === 'ar' ? 'الكل' : language === 'de' ? 'Alle' : 'All';

    return [{ id: 'all', label: allLabel }].concat(
      categories.map((c) => ({
        id: c.id,
        label: getLocalizedDbField(c, 'title', language),
      }))
    );
  }, [categories, language]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories.filter((c) => {
      const matchesCategory = selectedCategory === 'all' || c.id === selectedCategory;
      const title = getLocalizedDbField(c, 'title', language).toLowerCase();
      const desc = getLocalizedDbField(c, 'description', language).toLowerCase();
      const matchesSearch = !q || title.includes(q) || desc.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [categories, language, searchQuery, selectedCategory]);

  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceCategoryRow }) => {
      const title = getLocalizedDbField(item, 'title', language);
      const description = getLocalizedDbField(item, 'description', language);

      return (
        <TouchableOpacity
          style={styles.serviceCard}
          onPress={() => router.push(`/(tabs)/services/${item.id}`)}
          activeOpacity={0.9}
        >
          <View style={styles.thumbWrap}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbFallback} />
            )}
          </View>

          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.serviceDesc} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [language, router]
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.stateText}>Loading…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.stateText}>Couldn’t load services.</Text>
          </View>

          <TouchableOpacity style={styles.retryBtn} onPress={loadCategories}>
            <Ionicons name="refresh" size={16} color={Colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>No services found.</Text>
      </View>
    );
  }, [error, loading, loadCategories]);

  const headerTitle =
    language === 'ar' ? 'الخدمات' : language === 'de' ? 'Services' : 'Services';

  const searchPlaceholder =
    language === 'ar' ? 'ابحث…' : language === 'de' ? 'Suchen…' : 'Search…';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <HeaderLogo />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={Colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={chips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoriesContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item.id && styles.categoryTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredCategories}
        renderItem={renderServiceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={listEmpty}
        refreshing={loading}
        onRefresh={loadCategories}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.tint },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, marginLeft: 8, color: Colors.text, fontWeight: '600' },
  categoriesContainer: { marginBottom: 16 },
  categoriesContent: { paddingHorizontal: 20, gap: 10 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  categoryText: { color: Colors.textSecondary, fontWeight: '700' },
  categoryTextActive: { color: Colors.background },
  listContent: { padding: 20, paddingBottom: 40 },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 66,
    height: 66,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, backgroundColor: 'rgba(212,175,55,0.14)' },
  serviceInfo: { flex: 1, gap: 4 },
  serviceTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  serviceDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  stateWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
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
  retryText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
});
