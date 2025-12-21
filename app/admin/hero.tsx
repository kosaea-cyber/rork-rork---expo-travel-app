import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Colors from '@/constants/colors';
import { Plus, Trash2, Save, Image as ImageIcon, Pencil } from 'lucide-react-native';
import LocalizedInput from '@/components/admin/LocalizedInput';
import { AsyncImage } from '@/components/AsyncImage';
import { supabase } from '@/lib/supabase/client';
import AdminGuard from '@/components/admin/AdminGuard';
import { deleteStorageObjectByPublicUrl, pickAndUploadImage } from '@/lib/supabase/storageUpload';

type HeroSlideRow = {
  id: string;
  image_url: string;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  subtitle_en: string | null;
  subtitle_ar: string | null;
  subtitle_de: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type LocalizedForm = { en: string; ar: string; de: string };

type SlideFormState = {
  id?: string;
  image_url: string;
  title: LocalizedForm;
  subtitle: LocalizedForm;
  is_active: boolean;
  sort_order: number;
};

function toForm(row: HeroSlideRow): SlideFormState {
  return {
    id: row.id,
    image_url: row.image_url,
    title: {
      en: row.title_en ?? '',
      ar: row.title_ar ?? '',
      de: row.title_de ?? '',
    },
    subtitle: {
      en: row.subtitle_en ?? '',
      ar: row.subtitle_ar ?? '',
      de: row.subtitle_de ?? '',
    },
    is_active: row.is_active,
    sort_order: row.sort_order ?? 0,
  };
}

function toRowInsert(form: SlideFormState) {
  return {
    image_url: form.image_url,
    title_en: form.title.en || null,
    title_ar: form.title.ar || null,
    title_de: form.title.de || null,
    subtitle_en: form.subtitle.en || null,
    subtitle_ar: form.subtitle.ar || null,
    subtitle_de: form.subtitle.de || null,
    is_active: form.is_active,
    sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
  };
}

export default function ManageHero() {
  const [slides, setSlides] = useState<HeroSlideRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [saving, setSaving] = useState<boolean>(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const [form, setForm] = useState<SlideFormState>({
    image_url: '',
    title: { en: '', ar: '', de: '' },
    subtitle: { en: '', ar: '', de: '' },
    is_active: true,
    sort_order: 0,
  });


  const fetchSlides = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await supabase.from('hero_slides').select('*').order('sort_order', { ascending: true });
      console.log('[admin/hero] hero_slides list', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });
      if (res.error) {
        setSlides([]);
        setErrorMessage(res.error.message);
        return;
      }
      setSlides((res.data ?? []) as HeroSlideRow[]);
    } catch (e) {
      console.error('[admin/hero] fetchSlides unexpected error', e);
      setSlides([]);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load slides');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  const nextSortOrder = useMemo(() => {
    if (slides.length === 0) return 0;
    const max = slides.reduce((acc, s) => Math.max(acc, s.sort_order ?? 0), 0);
    return max + 1;
  }, [slides]);

  const handleCreate = () => {
    setEditingId('new');
    setForm({
      image_url: '',
      title: { en: '', ar: '', de: '' },
      subtitle: { en: '', ar: '', de: '' },
      is_active: true,
      sort_order: nextSortOrder,
    });
  };

  const handleEdit = (row: HeroSlideRow) => {
    setEditingId(row.id);
    setForm(toForm(row));
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleDelete = async (slide: HeroSlideRow) => {
    Alert.alert('Delete Slide', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            const res = await supabase.from('hero_slides').delete().eq('id', slide.id);
            console.log('[admin/hero] delete slide', { id: slide.id, error: res.error?.message ?? null });
            if (res.error) {
              Alert.alert('Error', res.error.message);
              return;
            }

            if (slide.image_url?.trim()) {
              try {
                await deleteStorageObjectByPublicUrl({ bucket: 'app-media', publicUrl: slide.image_url });
              } catch (e) {
                console.error('[admin/hero] orphan cleanup failed (non-blocking)', e);
              }
            }

            await fetchSlides();
          } catch (e) {
            console.error('[admin/hero] delete slide unexpected error', e);
            Alert.alert('Error', 'Failed to delete');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!form.image_url) {
      Alert.alert('Error', 'Image is required');
      return;
    }

    if (!form.title.en) {
      Alert.alert('Error', 'English title is required');
      return;
    }

    setSaving(true);
    try {
      if (editingId === 'new') {
        const res = await supabase.from('hero_slides').insert(toRowInsert(form));
        console.log('[admin/hero] insert slide', { error: res.error?.message ?? null });
        if (res.error) {
          Alert.alert('Error', res.error.message);
          return;
        }
      } else if (editingId) {
        const res = await supabase.from('hero_slides').update(toRowInsert(form)).eq('id', editingId);
        console.log('[admin/hero] update slide', { id: editingId, error: res.error?.message ?? null });
        if (res.error) {
          Alert.alert('Error', res.error.message);
          return;
        }
      }

      setEditingId(null);
      await fetchSlides();
      Alert.alert('Success', 'Hero slides updated');
    } catch (e) {
      console.error('[admin/hero] handleSave unexpected error', e);
      Alert.alert('Error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      setSaving(true);
      const res = await pickAndUploadImage({ folder: 'hero', bucket: 'app-media' });
      console.log('[admin/hero] pickAndUploadImage result', {
        hasResult: Boolean(res),
        urlPrefix: res?.publicUrl?.slice(0, 28) ?? null,
      });
      if (!res) return;
      setForm((prev) => ({ ...prev, image_url: res.publicUrl }));
    } catch (e) {
      console.error('[admin/hero] pickImage/upload failed', e);
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchSlides();
    } finally {
      setRefreshing(false);
    }
  }, [fetchSlides]);

  const content = (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      {!editingId && (
        <View>
          <View style={styles.topRow}>
            <Text style={styles.pageTitle}>Hero Slides</Text>
            <TouchableOpacity testID="admin-hero-add" style={styles.addButton} onPress={handleCreate}>
              <Plus color="white" size={20} />
              <Text style={styles.addButtonText}>Add Slide</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity testID="admin-hero-refresh" onPress={onRefresh} style={styles.refreshButton}>
            <Text style={{ color: Colors.tint, fontWeight: '800' }}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
          </TouchableOpacity>

          {slides.map((slide) => (
            <View key={slide.id} style={styles.slideCard}>
              <AsyncImage uri={slide.image_url} style={styles.thumbnail} />

              <View style={styles.slideInfo}>
                <Text style={styles.slideTitle} numberOfLines={1}>
                  {slide.title_en ?? 'Untitled'}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{slide.is_active ? 'Active' : 'Inactive'}</Text>
                  </View>

                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Order</Text>
                    <TextInput
                      testID={`admin-hero-sort-${slide.id}`}
                      style={styles.orderInput}
                      keyboardType="number-pad"
                      value={String(slide.sort_order ?? 0)}
                      onChangeText={(t) => {
                        const next = Number.parseInt(t || '0', 10) || 0;
                        setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, sort_order: next } : s)));
                      }}
                    />
                    <TouchableOpacity
                      testID={`admin-hero-sort-save-${slide.id}`}
                      onPress={async () => {
                        try {
                          setRowSavingId(slide.id);
                          const res = await supabase
                            .from('hero_slides')
                            .update({ sort_order: slide.sort_order ?? 0 })
                            .eq('id', slide.id);

                          console.log('[admin/hero] update sort_order', {
                            id: slide.id,
                            sort_order: slide.sort_order ?? 0,
                            error: res.error?.message ?? null,
                          });

                          if (res.error) {
                            Alert.alert('Error', res.error.message);
                            await fetchSlides();
                            return;
                          }

                          await fetchSlides();
                        } catch (e) {
                          console.error('[admin/hero] update sort_order unexpected error', e);
                          Alert.alert('Error', 'Failed to update sort order');
                          await fetchSlides();
                        } finally {
                          setRowSavingId(null);
                        }
                      }}
                      disabled={saving || rowSavingId === slide.id}
                      style={styles.miniButton}
                    >
                      {rowSavingId === slide.id ? (
                        <ActivityIndicator color={Colors.tint} />
                      ) : (
                        <Save size={16} color={Colors.tint} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Show</Text>
                  <Switch
                    testID={`admin-hero-toggle-${slide.id}`}
                    value={slide.is_active}
                    onValueChange={async (v) => {
                      setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, is_active: v } : s)));
                      try {
                        setRowSavingId(slide.id);
                        const res = await supabase.from('hero_slides').update({ is_active: v }).eq('id', slide.id);
                        console.log('[admin/hero] toggle is_active', { id: slide.id, is_active: v, error: res.error?.message ?? null });
                        if (res.error) {
                          Alert.alert('Error', res.error.message);
                          await fetchSlides();
                          return;
                        }
                      } catch (e) {
                        console.error('[admin/hero] toggle is_active unexpected error', e);
                        Alert.alert('Error', 'Failed to update');
                        await fetchSlides();
                      } finally {
                        setRowSavingId(null);
                      }
                    }}
                  />
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity testID={`admin-hero-edit-${slide.id}`} onPress={() => handleEdit(slide)} disabled={saving || rowSavingId === slide.id}>
                  <Pencil size={18} color={Colors.tint} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`admin-hero-delete-${slide.id}`}
                  onPress={() => handleDelete(slide)}
                  disabled={saving || rowSavingId === slide.id}
                >
                  <Trash2 size={18} color={Colors.error} style={{ marginLeft: 10 }} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {slides.length === 0 ? (
            <View style={{ paddingTop: 24 }}>
              <Text style={{ color: Colors.textSecondary }}>No slides yet. Add your first one.</Text>
            </View>
          ) : null}
        </View>
      )}

      {editingId && (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>{editingId === 'new' ? 'New Slide' : 'Edit Slide'}</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Image</Text>
            {form.image_url ? <AsyncImage uri={form.image_url} style={styles.previewImage} /> : <View style={styles.placeholderImage} />}

            <TouchableOpacity testID="admin-hero-upload" style={styles.uploadButton} onPress={pickImage} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <ImageIcon color="white" size={18} />}
              <Text style={{ color: 'white', marginLeft: 8, fontWeight: '800' }}>Upload</Text>
            </TouchableOpacity>

            <TextInput
              testID="admin-hero-image-url"
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Or paste image URL…"
              value={form.image_url}
              onChangeText={(t) => setForm((p) => ({ ...p, image_url: t }))}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <LocalizedInput
              label="Title"
              value={form.title}
              onChange={(val) => setForm((p) => ({ ...p, title: val }))}
              placeholder="Title"
            />
          </View>

          <View style={styles.section}>
            <LocalizedInput
              label="Subtitle"
              value={form.subtitle}
              onChange={(val) => setForm((p) => ({ ...p, subtitle: val }))}
              placeholder="Subtitle"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Sort order</Text>
            <TextInput
              testID="admin-hero-sort-order"
              style={styles.input}
              keyboardType="number-pad"
              value={String(form.sort_order)}
              onChangeText={(t) => setForm((p) => ({ ...p, sort_order: Number.parseInt(t || '0', 10) || 0 }))}
              placeholder="0"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Active</Text>
            <Switch testID="admin-hero-is-active" value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity testID="admin-hero-cancel" style={[styles.button, styles.cancelButton]} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="admin-hero-save" style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Save color="white" size={18} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <AdminGuard>
      {loading ? (
        <ActivityIndicator testID="admin-hero-loading" size="large" color={Colors.tint} style={{ marginTop: 50 }} />
      ) : errorMessage ? (
        <View style={styles.stateWrap} testID="admin-hero-error">
          <Text style={styles.stateTitle}>Couldn’t load hero slides</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <TouchableOpacity testID="admin-hero-retry" onPress={fetchSlides} style={styles.stateButton}>
            <Text style={styles.stateButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        content
      )}
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background,
  },
  stateWrap: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  stateTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  stateButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
  },
  stateButtonText: {
    color: Colors.background,
    fontWeight: '900',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  refreshButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  addButton: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  slideCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnail: {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#101826',
  },
  slideInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  orderInput: {
    width: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: Colors.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  miniButton: {
    width: 36,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  slideTitle: {
    fontWeight: '900',
    fontSize: 14,
    color: Colors.text,
  },
  slideMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editor: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
    color: Colors.tint,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: Colors.text,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: '#101826',
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: '#101826',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadButton: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.tint,
  },
  cancelText: {
    color: Colors.text,
    fontWeight: '800',
  },
  saveText: {
    color: 'white',
    fontWeight: '900',
  },
});
