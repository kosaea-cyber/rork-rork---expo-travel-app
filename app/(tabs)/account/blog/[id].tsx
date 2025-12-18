import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { supabase } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AsyncImage } from '@/components/AsyncImage';

type BlogPostDetailsRow = {
  id: string;
  is_active: boolean;
  created_at: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  body_en: string | null;
  body_ar: string | null;
  body_de: string | null;
};

function pickTitle(row: BlogPostDetailsRow, lang: PreferredLanguage): string {
  const v = lang === 'ar' ? row.title_ar : lang === 'de' ? row.title_de : row.title_en;
  return v ?? row.title_en ?? row.title_de ?? row.title_ar ?? '';
}

function pickBody(row: BlogPostDetailsRow, lang: PreferredLanguage): string {
  const v = lang === 'ar' ? row.body_ar : lang === 'de' ? row.body_de : row.body_en;
  return v ?? row.body_en ?? row.body_de ?? row.body_ar ?? '';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
}

export default function BlogPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = params.id ?? '';

  const i18nLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);

  const lang = useMemo<PreferredLanguage>(() => {
    const v = preferredLanguage ?? i18nLanguage;
    return v === 'ar' || v === 'de' ? v : 'en';
  }, [preferredLanguage, i18nLanguage]);

  const postQuery = useQuery({
    queryKey: ['blog_posts', { id: postId }],
    enabled: Boolean(postId),
    queryFn: async (): Promise<BlogPostDetailsRow> => {
      console.log('[blog] fetching blog_posts details', { postId });
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id,is_active,created_at,published_at,cover_image_url,title_en,title_ar,title_de,body_en,body_ar,body_de'
        )
        .eq('id', postId)
        .eq('is_active', true)
        .not('published_at', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('[blog] blog_posts details error', error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('Post not found');
      }


      return data as BlogPostDetailsRow;
    },
  });

  const { refetch } = postQuery;

  const onRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/account/blog');
  }, [router]);

  if (!postId) {
    return (
      <View style={styles.stateContainer} testID="blog-details-missing-id">
        <Text style={styles.stateTitle}>Missing post id</Text>
        <Pressable testID="blog-details-back" onPress={goBack} style={styles.retryBtn}>
          <Text style={styles.retryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (postQuery.isLoading) {
    return (
      <View style={styles.stateContainer} testID="blog-details-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading…</Text>
      </View>
    );
  }

  if (postQuery.isError) {
    return (
      <View style={styles.stateContainer} testID="blog-details-error">
        <Text style={styles.stateTitle}>Couldn’t load post</Text>
        <Text style={styles.stateText}>{(postQuery.error as Error)?.message ?? 'Unknown error'}</Text>
        <View style={styles.errorActions}>
          <Pressable testID="blog-details-retry" onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable testID="blog-details-back" onPress={goBack} style={[styles.retryBtn, styles.secondaryBtn]}>
            <Text style={[styles.retryText, styles.secondaryText]}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const post = postQuery.data;

  if (!post) {
    return (
      <View style={styles.stateContainer} testID="blog-details-empty">
        <Text style={styles.stateTitle}>Post not found</Text>
        <Pressable testID="blog-details-back" onPress={goBack} style={styles.retryBtn}>
          <Text style={styles.retryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const title = pickTitle(post, lang);
  const body = pickBody(post, lang);
  const dateLabel = formatDate(post.published_at ?? post.created_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="blog-details">
      {post.cover_image_url ? (
        <AsyncImage testID="blog-details-cover" uri={post.cover_image_url} style={styles.cover} resizeMode="cover" />
      ) : null}

      {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.divider} />
      <Text style={styles.body}>{body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  cover: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: Colors.border,
  },
  date: {
    color: Colors.tint,
    fontSize: 13,
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 18,
    letterSpacing: -0.4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 18,
  },
  body: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 16,
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
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  retryBtn: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.background,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: {
    color: Colors.text,
  },
});
