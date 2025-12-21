import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import LocalizedInput from '@/components/admin/LocalizedInput';
import { supabase } from '@/lib/supabase/client';

type Localized = { en: string; ar: string; de: string };

type BlogRow = {
  id: string;
  is_active: boolean | null;
  created_at: string;
  published_at: string | null;
  cover_image_url: string | null;

  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;

  excerpt_en: string | null;
  excerpt_ar: string | null;
  excerpt_de: string | null;

  body_en: string | null;
  body_ar: string | null;
  body_de: string | null;
};

type FormState = {
  title: Localized;
  date: string; // YYYY-MM-DD
  imageUrl: string;
  excerpt: Localized;
  content: Localized;
  is_active: boolean;
};

function isoFromDateOrNull(date: string): string | null {
  const v = date.trim();
  if (!v) return null;
  // Expect YYYY-MM-DD
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!ok) return null;
  return `${v}T00:00:00.000Z`;
}

function dateFromIso(iso?: string | null): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  // iso may be "2025-12-18T00:00:00Z"
  return String(iso).slice(0, 10);
}

function rowToForm(row: BlogRow): FormState {
  return {
    title: {
      en: (row.title_en ?? '').trim(),
      ar: (row.title_ar ?? '').trim(),
      de: (row.title_de ?? '').trim(),
    },
    date: dateFromIso(row.published_at ?? row.created_at),
    imageUrl: (row.cover_image_url ?? '').trim(),
    excerpt: {
      en: (row.excerpt_en ?? '').trim(),
      ar: (row.excerpt_ar ?? '').trim(),
      de: (row.excerpt_de ?? '').trim(),
    },
    content: {
      en: (row.body_en ?? '').trim(),
      ar: (row.body_ar ?? '').trim(),
      de: (row.body_de ?? '').trim(),
    },
    is_active: row.is_active ?? true,
  };
}

export default function EditBlog() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);

  const [form, setForm] = useState<FormState>(() => ({
    title: { en: '', ar: '', de: '' },
    date: new Date().toISOString().slice(0, 10),
    imageUrl: '',
    excerpt: { en: '', ar: '', de: '' },
    content: { en: '', ar: '', de: '' },
    is_active: true,
  }));

  const pageTitle = useMemo(() => (isNew ? 'New Blog Post' : 'Edit Blog'), [isNew]);

  const load = useCallback(async () => {
    if (isNew) return;
    if (!id || typeof id !== 'string') return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id, is_active, created_at, published_at, cover_image_url, title_en, title_ar, title_de, excerpt_en, excerpt_ar, excerpt_de, body_en, body_ar, body_de',
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Blog post not found.');

      setForm(rowToForm(data as BlogRow));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load blog post.';
      Alert.alert('Error', msg, [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    const titleEn = form.title.en.trim();
    const bodyEn = form.content.en.trim();

    if (!titleEn || !bodyEn) {
      Alert.alert('Error', 'Please fill in at least English title and content.');
      return;
    }

    const publishedAt = isoFromDateOrNull(form.date);
    if (!publishedAt) {
      Alert.alert('Error', 'Date must be in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const insertRow = {
          is_active: form.is_active,
          published_at: publishedAt,
          cover_image_url: form.imageUrl.trim() || null,

          title_en: form.title.en.trim() || null,
          title_ar: form.title.ar.trim() || null,
          title_de: form.title.de.trim() || null,

          excerpt_en: form.excerpt.en.trim() || null,
          excerpt_ar: form.excerpt.ar.trim() || null,
          excerpt_de: form.excerpt.de.trim() || null,

          body_en: form.content.en.trim() || null,
          body_ar: form.content.ar.trim() || null,
          body_de: form.content.de.trim() || null,
        };

        const { error } = await supabase.from('blog_posts').insert(insertRow);
        if (error) throw new Error(error.message);
      } else {
        if (!id || typeof id !== 'string') throw new Error('Missing blog id.');

        const updateRow = {
          is_active: form.is_active,
          published_at: publishedAt,
          cover_image_url: form.imageUrl.trim() || null,

          title_en: form.title.en.trim() || null,
          title_ar: form.title.ar.trim() || null,
          title_de: form.title.de.trim() || null,

          excerpt_en: form.excerpt.en.trim() || null,
          excerpt_ar: form.excerpt.ar.trim() || null,
          excerpt_de: form.excerpt.de.trim() || null,

          body_en: form.content.en.trim() || null,
          body_ar: form.content.ar.trim() || null,
          body_de: form.content.de.trim() || null,
        };

        const { error } = await supabase.from('blog_posts').update(updateRow).eq('id', id);
        if (error) throw new Error(error.message);
      }

      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save blog post.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [form, id, isNew, router]);

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={Colors.tint ?? Colors.primary} />
        <Text style={styles.stateText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>{pageTitle}</Text>

      <LocalizedInput label="Title" value={form.title as any} onChange={(val) => setForm({ ...form, title: val })} />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={form.date}
          onChangeText={(text) => setForm({ ...form, date: text })}
          placeholder="e.g. 2025-12-18"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Image URL</Text>
        <TextInput
          style={styles.input}
          value={form.imageUrl}
          onChangeText={(text) => setForm({ ...form, imageUrl: text })}
          placeholder="https://..."
          autoCapitalize="none"
        />
      </View>

      <LocalizedInput
        label="Excerpt"
        value={form.excerpt as any}
        onChange={(val) => setForm({ ...form, excerpt: val })}
        multiline
      />

      <LocalizedInput
        label="Content"
        value={form.content as any}
        onChange={(val) => setForm({ ...form, content: val })}
        multiline
      />

      <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isNew ? 'Create Post' : 'Update Post'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  pageTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12, color: '#111' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  saveButton: {
    backgroundColor: Colors.primary ?? Colors.tint,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { color: '#666', fontSize: 13, fontWeight: '700' },
});
