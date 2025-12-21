import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useProfileStore, type PreferredLanguage } from '@/store/profileStore';
import { supabase } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

type FaqRow = {
  id: string;
  is_active: boolean;
  sort_order: number | null;
  question_en: string | null;
  question_ar: string | null;
  question_de: string | null;
  answer_en: string | null;
  answer_ar: string | null;
  answer_de: string | null;
};

function pickQuestion(row: FaqRow, lang: PreferredLanguage): string {
  const v = lang === 'ar' ? row.question_ar : lang === 'de' ? row.question_de : row.question_en;
  return v ?? row.question_en ?? row.question_de ?? row.question_ar ?? '';
}

function pickAnswer(row: FaqRow, lang: PreferredLanguage): string {
  const v = lang === 'ar' ? row.answer_ar : lang === 'de' ? row.answer_de : row.answer_en;
  return v ?? row.answer_en ?? row.answer_de ?? row.answer_ar ?? '';
}

function Accordion({ item, lang }: { item: FaqRow; lang: PreferredLanguage }) {
  const [expanded, setExpanded] = React.useState<boolean>(false);

  const question = useMemo(() => pickQuestion(item, lang), [item, lang]);
  const answer = useMemo(() => pickAnswer(item, lang), [item, lang]);

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        testID={`faq-item-${item.id}`}
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.question}>{question}</Text>
        </View>
        {expanded ? <ChevronUp color={Colors.tint} size={20} /> : <ChevronDown color={Colors.textSecondary} size={20} />}
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.answer}>{answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FAQScreen() {
  const i18nLanguage = useI18nStore((state) => state.language);
  const preferredLanguage = useProfileStore((s) => s.preferredLanguage);

  const lang = useMemo<PreferredLanguage>(() => {
    const v = preferredLanguage ?? i18nLanguage;
    return v === 'ar' || v === 'de' ? v : 'en';
  }, [preferredLanguage, i18nLanguage]);

  const faqQuery = useQuery({
    queryKey: ['faq_items', { isActive: true }],
    queryFn: async (): Promise<FaqRow[]> => {
      console.log('[faq] fetching faq_items');
      const { data, error } = await supabase
        .from('faq_items')
        .select(
          'id,is_active,sort_order,question_en,question_ar,question_de,answer_en,answer_ar,answer_de'
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('[faq] faq_items error', error);
        throw new Error(error.message);
      }

      return (data ?? []) as FaqRow[];
    },
  });

  const { refetch } = faqQuery;

  const onRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  if (faqQuery.isLoading) {
    return (
      <View style={styles.stateContainer} testID="faq-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading…</Text>
      </View>
    );
  }

  if (faqQuery.isError) {
    return (
      <View style={styles.stateContainer} testID="faq-error">
        <Text style={styles.stateTitle}>Couldn’t load FAQ</Text>
        <Text style={styles.stateText}>{(faqQuery.error as Error)?.message ?? 'Unknown error'}</Text>
        <Pressable testID="faq-retry" onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const items = faqQuery.data ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        testID="faq-list"
        data={items}
        renderItem={({ item }) => <Accordion item={item} lang={lang} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.empty} testID="faq-empty">
            <Text style={styles.emptyTitle}>No FAQs yet</Text>
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
  accordionContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  question: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  answer: {
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
