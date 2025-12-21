import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { useI18nStore } from '@/constants/i18n';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { AsyncImage } from '@/components/AsyncImage';
import { ChevronRight } from 'lucide-react-native';

type BlogPostPreviewRow = {
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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function pickLocalized(
  row: Pick<BlogPostPreviewRow, 'title_en' | 'title_ar' | 'title_de'>,
  lang: PreferredLanguage
): string {
  const v = lang === 'ar' ? row.title_ar : lang === 'de' ? row.title_de : row.title_en;
  return v ?? row.title_en ?? row.title_de ?? row.title_ar ?? '';
}

function pickLocalizedExcerpt(
  row: Pick<BlogPostPreviewRow, 'excerpt_en' | 'excerpt_ar' | 'excerpt_de'>,
  lang: PreferredLanguage
): string {
  const v = lang === 'ar' ? row.excerpt_ar : lang === 'de' ? row.excerpt_de : row.excerpt_en;
  return v ?? row.excerpt_en ?? row.excerpt_de ?? row.excerpt_ar ?? '';
}

export default function BlogPreview() {
  const router = useRouter();
  const i18nLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);

  const lang = useMemo<PreferredLanguage>(() => {
    const v = preferredLanguage ?? i18nLanguage;
    return v === 'ar' || v === 'de' ? v : 'en';
  }, [preferredLanguage, i18nLanguage]);

  const copy = useMemo(() => {
    if (lang === 'ar') {
      return {
        title: 'أحدث المقالات',
        seeAll: 'عرض الكل',
        loading: 'جاري التحميل…',
        error: 'تعذر تحميل المقالات.',
        retry: 'إعادة المحاولة',
      };
    }
    if (lang === 'de') {
      return {
        title: 'Neueste Artikel',
        seeAll: 'Alle ansehen',
        loading: 'Wird geladen…',
        error: 'Artikel konnten nicht geladen werden.',
        retry: 'Erneut versuchen',
      };
    }
    return {
      title: 'Latest articles',
      seeAll: 'See all',
      loading: 'Loading…',
      error: 'Couldn’t load articles.',
      retry: 'Retry',
    };
  }, [lang]);

  const { data: postsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog_posts', { latest: true, limit: 3 }],
    queryFn: async (): Promise<BlogPostPreviewRow[]> => {
      console.log('[blog][preview] fetching latest blog_posts');
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id,is_active,created_at,published_at,cover_image_url,title_en,title_ar,title_de,excerpt_en,excerpt_ar,excerpt_de'
        )
        .eq('is_active', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('[blog][preview] latest blog_posts error', error);
        throw new Error(error.message);
      }

      return (data ?? []) as BlogPostPreviewRow[];
    },
  });

  const onRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  const onSeeAll = useCallback(() => {
    router.push('/(tabs)/account/blog');
  }, [router]);

  const openPost = useCallback(
    (id: string) => {
      router.push({ pathname: '/(tabs)/account/blog/[id]', params: { id } });
    },
    [router]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingWrap} testID="home-blog-preview-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.loadingText}>{copy.loading}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorWrap} testID="home-blog-preview-error">
        <Text style={styles.errorTitle}>{copy.error}</Text>
        <Pressable testID="home-blog-preview-retry" onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>{copy.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const posts = postsData ?? [];
  if (posts.length === 0) return null;

  return (
    <View style={styles.container} testID="home-blog-preview">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{copy.title}</Text>
        <Pressable testID="home-blog-preview-see-all" onPress={onSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>{copy.seeAll}</Text>
          <ChevronRight size={16} color={Colors.tint} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID="home-blog-preview-row"
      >
        {posts.map((p) => {
          const title = pickLocalized(p, lang);
          const excerpt = pickLocalizedExcerpt(p, lang);
          const dateLabel = formatDate(p.published_at ?? p.created_at);

          return (
            <Pressable
              key={p.id}
              testID={`home-blog-card-${p.id}`}
              onPress={() => openPost(p.id)}
              style={styles.card}
            >
              {p.cover_image_url ? (
                <AsyncImage
                  testID={`home-blog-card-cover-${p.id}`}
                  uri={p.cover_image_url}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.coverFallback} />
              )}

              <View style={styles.cardBody}>
                {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.excerpt} numberOfLines={2}>
                  {excerpt}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 260;

const styles = StyleSheet.create({
  container: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  headerRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  seeAllText: {
    color: Colors.tint,
    fontWeight: '800',
    fontSize: 13,
  },
  row: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cover: {
    height: 120,
    width: '100%',
    backgroundColor: Colors.border,
  },
  coverFallback: {
    height: 120,
    width: '100%',
    backgroundColor: Colors.border,
  },
  cardBody: {
    padding: 14,
  },
  date: {
    color: Colors.tint,
    fontSize: 12,
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  excerpt: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  errorTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.tint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.background,
    fontWeight: '900',
    fontSize: 13,
  },
});
