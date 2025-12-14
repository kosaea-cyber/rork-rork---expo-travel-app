import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { supabase } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AsyncImage } from '@/components/AsyncImage';

type BlogPostRow = {
  id: string;
  is_active: boolean;
  created_at: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  excerpt_en: string | null;
  excerpt_ar: string | null;
  excerpt_de: string | null;
};

function pickLocalized(
  row: Pick<BlogPostRow, 'title_en' | 'title_ar' | 'title_de'>,
  lang: PreferredLanguage
): string {
  const v = lang === 'ar' ? row.title_ar : lang === 'de' ? row.title_de : row.title_en;
  return v ?? row.title_en ?? row.title_de ?? row.title_ar ?? '';
}

function pickLocalizedExcerpt(
  row: Pick<BlogPostRow, 'excerpt_en' | 'excerpt_ar' | 'excerpt_de'>,
  lang: PreferredLanguage
): string {
  const v = lang === 'ar' ? row.excerpt_ar : lang === 'de' ? row.excerpt_de : row.excerpt_en;
  return v ?? row.excerpt_en ?? row.excerpt_de ?? row.excerpt_ar ?? '';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function BlogListScreen() {
  const router = useRouter();
  const i18nLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);

  const lang = useMemo<PreferredLanguage>(() => {
    const v = preferredLanguage ?? i18nLanguage;
    return v === 'ar' || v === 'de' ? v : 'en';
  }, [preferredLanguage, i18nLanguage]);

  const blogQuery = useQuery({
    queryKey: ['blog_posts', { isActive: true }],
    queryFn: async (): Promise<BlogPostRow[]> => {
      console.log('[blog] fetching blog_posts list');
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id,is_active,created_at,published_at,cover_image_url,title_en,title_ar,title_de,excerpt_en,excerpt_ar,excerpt_de'
        )
        .eq('is_active', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[blog] blog_posts list error', error);
        throw new Error(error.message);
      }

      return (data ?? []) as BlogPostRow[];
    },
  });

  const { refetch } = blogQuery;

  const onRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: BlogPostRow }) => {
      const title = pickLocalized(item, lang);
      const excerpt = pickLocalizedExcerpt(item, lang);
      const dateLabel = formatDate(item.published_at ?? item.created_at);

      return (
        <TouchableOpacity
          testID={`blog-card-${item.id}`}
          style={styles.card}
          onPress={() => router.push(`/(tabs)/account/blog/${item.id}`)}
          activeOpacity={0.85}
        >
          {item.cover_image_url ? (
            <AsyncImage
              testID={`blog-cover-${item.id}`}
              uri={item.cover_image_url}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.cardBody}>
            {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.excerpt} numberOfLines={3}>
              {excerpt}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [lang, router]
  );

  if (blogQuery.isLoading) {
    return (
      <View style={styles.stateContainer} testID="blog-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading posts…</Text>
      </View>
    );
  }

  if (blogQuery.isError) {
    return (
      <View style={styles.stateContainer} testID="blog-error">
        <Text style={styles.stateTitle}>Couldn’t load blog posts</Text>
        <Text style={styles.stateText}>{(blogQuery.error as Error)?.message ?? 'Unknown error'}</Text>
        <Pressable testID="blog-retry" onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const posts = blogQuery.data ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        testID="blog-list"
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="blog-empty">
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Check back soon.</Text>
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
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cover: {
    height: 160,
    width: '100%',
    backgroundColor: Colors.border,
  },
  cardBody: {
    padding: 18,
  },
  date: {
    color: Colors.tint,
    fontSize: 12,
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  excerpt: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  stateTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.background,
    fontWeight: '800',
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
