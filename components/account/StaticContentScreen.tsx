import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';

type ContentKey = 'about' | 'terms' | 'privacy';

type SiteContentRow = {
  id: string;
  key: string;
  is_active: boolean;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  body_en: string | null;
  body_ar: string | null;
  body_de: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function pickLocalized(
  row: Pick<SiteContentRow, 'title_en' | 'title_ar' | 'title_de'>,
  lang: PreferredLanguage,
): string {
  const byLang =
    lang === 'ar'
      ? row.title_ar
      : lang === 'de'
        ? row.title_de
        : row.title_en;

  return (byLang ?? row.title_en ?? row.title_ar ?? row.title_de ?? '').trim();
}

function pickLocalizedBody(
  row: Pick<SiteContentRow, 'body_en' | 'body_ar' | 'body_de'>,
  lang: PreferredLanguage,
): string {
  const byLang =
    lang === 'ar'
      ? row.body_ar
      : lang === 'de'
        ? row.body_de
        : row.body_en;

  return (byLang ?? row.body_en ?? row.body_ar ?? row.body_de ?? '').trim();
}

export default function StaticContentScreen({
  contentKey,
  testIDPrefix,
}: {
  contentKey: ContentKey;
  testIDPrefix: string;
}) {
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);
  const language: PreferredLanguage = preferredLanguage ?? 'en';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [row, setRow] = useState<SiteContentRow | null>(null);

  const title = useMemo(() => {
    if (!row) return '';
    return pickLocalized(
      {
        title_en: row.title_en,
        title_ar: row.title_ar,
        title_de: row.title_de,
      },
      language,
    );
  }, [language, row]);

  const body = useMemo(() => {
    if (!row) return '';
    return pickLocalizedBody(
      {
        body_en: row.body_en,
        body_ar: row.body_ar,
        body_de: row.body_de,
      },
      language,
    );
  }, [language, row]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) setIsLoading(true);
      setErrorMessage(null);

      try {
        console.log('[site_content] load', { contentKey, language });

        const { data, error } = await supabase
          .from('site_content')
          .select(
            'id,key,is_active,title_en,title_ar,title_de,body_en,body_ar,body_de,updated_at,created_at',
          )
          .eq('key', contentKey)
          .eq('is_active', true)
          .maybeSingle<SiteContentRow>();

        if (error) {
          console.error('[site_content] load error', {
            contentKey,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          setRow(null);
          setErrorMessage(error.message);
          return;
        }

        if (!data) {
          console.warn('[site_content] no active row found', { contentKey });
          setRow(null);
          setErrorMessage('Content is not available right now.');
          return;
        }

        console.log('[site_content] loaded', {
          contentKey,
          id: data.id,
          hasTitle: Boolean(data.title_en || data.title_ar || data.title_de),
          hasBody: Boolean(data.body_en || data.body_ar || data.body_de),
        });
        setRow(data);
      } catch (e) {
        console.error('[site_content] unexpected load error', e);
        setRow(null);
        setErrorMessage('Something went wrong. Please try again.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [contentKey, language],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRetry = useCallback(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const showEmptyTitle = useMemo(() => {
    if (isLoading) return false;
    if (errorMessage) return false;
    if (!row) return true;
    return title.length === 0 && body.length === 0;
  }, [body.length, errorMessage, isLoading, row, title.length]);

  if (isLoading) {
    return (
      <View style={styles.loadingWrap} testID={`${testIDPrefix}-loading`}>
        <ActivityIndicator size="large" color={Colors.tint} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.errorWrap} testID={`${testIDPrefix}-error`}>
        <View style={styles.errorIcon}>
          <AlertTriangle color={Colors.error} size={22} />
        </View>
        <Text style={styles.errorTitle}>Couldn’t load this page</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>

        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryButton}
          activeOpacity={0.85}
          testID={`${testIDPrefix}-retry`}
        >
          <RotateCcw color={Colors.background} size={18} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showEmptyTitle) {
    return (
      <View style={styles.errorWrap} testID={`${testIDPrefix}-empty`}>
        <Text style={styles.errorTitle}>This page is empty</Text>
        <Text style={styles.errorMessage}>Please try again later.</Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Not available', 'This content is not available right now.');
          }}
          style={[styles.retryButton, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}
          activeOpacity={0.85}
          testID={`${testIDPrefix}-empty-cta`}
        >
          <Text style={[styles.retryText, { color: Colors.text }]}>OK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.tint} />}
      testID={`${testIDPrefix}-scroll`}
    >
      <View style={styles.header} testID={`${testIDPrefix}-header`}>
        <Text style={styles.title} testID={`${testIDPrefix}-title`}>
          {title}
        </Text>
        <View style={styles.headerRule} />
      </View>

      <Text style={styles.body} testID={`${testIDPrefix}-body`}>
        {body}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerRule: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 14,
    opacity: 0.8,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 25,
  },

  loadingWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  errorWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.error + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.error + '2A',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
