import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

type ServiceCategoryRow = {
  id: string;
  slug: string | null;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_de: string | null;
  icon: string | null;
  image_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string | null;
};

type EditableCategory = {
  id?: string;
  slug: string;
  title_en: string;
  title_ar: string;
  title_de: string;
  description_en: string;
  description_ar: string;
  description_de: string;
  icon: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
};

function normalizeEditable(row?: ServiceCategoryRow | null): EditableCategory {
  return {
    id: row?.id,
    slug: row?.slug ?? '',
    title_en: row?.title_en ?? '',
    title_ar: row?.title_ar ?? '',
    title_de: row?.title_de ?? '',
    description_en: row?.description_en ?? '',
    description_ar: row?.description_ar ?? '',
    description_de: row?.description_de ?? '',
    icon: row?.icon ?? 'HelpCircle',
    image_url: row?.image_url ?? '',
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
  };
}

export default function AdminServices() {
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: categories,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'service_categories'],
    queryFn: async (): Promise<ServiceCategoryRow[]> => {
      console.log('[admin/services] fetching service_categories');
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.log('[admin/services] fetch error', error);
        throw new Error(error.message);
      }

      console.log('[admin/services] fetched', { count: data?.length ?? 0 });
      return (data ?? []) as ServiceCategoryRow[];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: EditableCategory): Promise<void> => {
      console.log('[admin/services] create category', { slug: payload.slug });

      const insertRow = {
        slug: payload.slug,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        icon: payload.icon,
        image_url: payload.image_url || null,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      };

      const { error } = await supabase.from('service_categories').insert(insertRow);
      if (error) {
        console.log('[admin/services] create error', error);
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'service_categories'] });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (payload: EditableCategory): Promise<void> => {
      if (!payload.id) throw new Error('Missing category id');
      console.log('[admin/services] update category', { id: payload.id, slug: payload.slug });

      const updateRow = {
        slug: payload.slug,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        icon: payload.icon,
        image_url: payload.image_url || null,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('service_categories').update(updateRow).eq('id', payload.id);
      if (error) {
        console.log('[admin/services] update error', error);
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'service_categories'] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      console.log('[admin/services] delete category', { id });
      const { error } = await supabase.from('service_categories').delete().eq('id', id);
      if (error) {
        console.log('[admin/services] delete error', error);
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'service_categories'] });
    },
  });

  const openNew = useCallback(() => {
    setFormError(null);
    setEditing(normalizeEditable(null));
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((row: ServiceCategoryRow) => {
    setFormError(null);
    setEditing(normalizeEditable(row));
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditing(null);
    setFormError(null);
  }, []);

  const createCategory = createCategoryMutation.mutateAsync;
  const updateCategory = updateCategoryMutation.mutateAsync;
  const deleteCategory = deleteCategoryMutation.mutateAsync;

  const saving = createCategoryMutation.isPending || updateCategoryMutation.isPending;

  const onSave = useCallback(async () => {
    if (!editing) return;

    const trimmedSlug = editing.slug.trim();
    if (!trimmedSlug) {
      setFormError('Slug is required.');
      return;
    }

    const payload: EditableCategory = {
      ...editing,
      slug: trimmedSlug,
      sort_order: Number.isFinite(editing.sort_order) ? editing.sort_order : 0,
    };

    setFormError(null);

    try {
      if (payload.id) {
        await updateCategory(payload);
      } else {
        await createCategory(payload);
      }
      closeModal();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save.';
      setFormError(message);
    }
  }, [closeModal, createCategory, editing, updateCategory]);

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCategory(id);
      } catch (e) {
        console.error('[admin/services] delete failed', e);
      }
    },
    [deleteCategory],
  );

  const listData = useMemo<ServiceCategoryRow[]>(() => categories ?? [], [categories]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceCategoryRow }) => {
      return (
        <View style={styles.card} testID={`admin-category-card-${item.id}`}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, { backgroundColor: '#ddd' }]} />
          )}

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {(item.title_en ?? '').toUpperCase() || '(UNTITLED)'}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  slug: {item.slug ?? '—'} • active: {String(item.is_active ?? false)} • order: {item.sort_order ?? 0}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  testID={`admin-category-edit-${item.id}`}
                  onPress={() => openEdit(item)}
                  style={styles.actionBtn}
                >
                  <Edit2 size={20} color={Colors.tint} />
                </Pressable>
                <Pressable
                  testID={`admin-category-delete-${item.id}`}
                  onPress={() => onDelete(item.id)}
                  style={styles.actionBtn}
                >
                  <Trash2 size={20} color={Colors.error} />
                </Pressable>
              </View>
            </View>

            <Text style={styles.meta} numberOfLines={2}>
              ID: {item.id}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              icon: {item.icon ?? '—'}
            </Text>
          </View>
        </View>
      );
    },
    [onDelete, openEdit],
  );

  if (isLoading) {
    return (
      <View style={styles.stateWrap} testID="admin-categories-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading categories…</Text>
      </View>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <View style={styles.stateWrap} testID="admin-categories-error">
        <Text style={styles.stateText}>Couldn’t load categories.</Text>
        <Text style={[styles.stateText, { fontWeight: '600' }]}>{message}</Text>
        <Pressable testID="admin-categories-retry" style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="admin-categories">
      <Pressable testID="admin-categories-add" style={styles.addBtn} onPress={openNew}>
        <Plus size={22} color="white" />
        <Text style={styles.addBtnText}>Add Category</Text>
      </Pressable>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.stateWrap} testID="admin-categories-empty">
            <Text style={styles.stateText}>No categories yet.</Text>
            <Pressable testID="admin-categories-empty-retry" style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryText}>Refresh</Text>
            </Pressable>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modalContainer} testID="admin-categories-modal">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing?.id ? 'Edit Category' : 'New Category'}</Text>
            <Pressable testID="admin-categories-modal-close" onPress={closeModal}>
              <X size={24} color="#333" />
            </Pressable>
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 30 }}>
            {editing ? (
              <>
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <Text style={styles.label}>Slug (unique)</Text>
                <TextInput
                  testID="admin-category-slug"
                  style={styles.input}
                  value={editing.slug}
                  onChangeText={(t) => setEditing({ ...editing, slug: t })}
                  placeholder="e.g. wellness"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Title (EN)</Text>
                <TextInput
                  testID="admin-category-title-en"
                  style={styles.input}
                  value={editing.title_en}
                  onChangeText={(t) => setEditing({ ...editing, title_en: t })}
                />

                <Text style={styles.label}>Title (AR)</Text>
                <TextInput
                  testID="admin-category-title-ar"
                  style={styles.input}
                  value={editing.title_ar}
                  onChangeText={(t) => setEditing({ ...editing, title_ar: t })}
                />

                <Text style={styles.label}>Title (DE)</Text>
                <TextInput
                  testID="admin-category-title-de"
                  style={styles.input}
                  value={editing.title_de}
                  onChangeText={(t) => setEditing({ ...editing, title_de: t })}
                />

                <Text style={styles.label}>Description (EN)</Text>
                <TextInput
                  testID="admin-category-desc-en"
                  style={[styles.input, styles.textArea]}
                  value={editing.description_en}
                  onChangeText={(t) => setEditing({ ...editing, description_en: t })}
                  multiline
                />

                <Text style={styles.label}>Description (AR)</Text>
                <TextInput
                  testID="admin-category-desc-ar"
                  style={[styles.input, styles.textArea]}
                  value={editing.description_ar}
                  onChangeText={(t) => setEditing({ ...editing, description_ar: t })}
                  multiline
                />

                <Text style={styles.label}>Description (DE)</Text>
                <TextInput
                  testID="admin-category-desc-de"
                  style={[styles.input, styles.textArea]}
                  value={editing.description_de}
                  onChangeText={(t) => setEditing({ ...editing, description_de: t })}
                  multiline
                />

                <Text style={styles.label}>Icon (Lucide name)</Text>
                <TextInput
                  testID="admin-category-icon"
                  style={styles.input}
                  value={editing.icon}
                  onChangeText={(t) => setEditing({ ...editing, icon: t })}
                  placeholder="e.g. Sunset"
                />

                <Text style={styles.label}>Image URL</Text>
                <TextInput
                  testID="admin-category-image-url"
                  style={styles.input}
                  value={editing.image_url}
                  onChangeText={(t) => setEditing({ ...editing, image_url: t })}
                  placeholder="https://..."
                  autoCapitalize="none"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Sort Order</Text>
                    <TextInput
                      testID="admin-category-sort"
                      style={styles.input}
                      value={String(editing.sort_order)}
                      onChangeText={(t) => {
                        const n = Number(t);
                        setEditing({ ...editing, sort_order: Number.isFinite(n) ? n : 0 });
                      }}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Active</Text>
                    <Pressable
                      testID="admin-category-is-active"
                      style={[styles.toggle, editing.is_active && styles.toggleOn]}
                      onPress={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    >
                      <Text style={[styles.toggleText, editing.is_active && styles.toggleTextOn]}>
                        {editing.is_active ? 'Yes' : 'No'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable testID="admin-category-save" style={styles.saveBtn} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="white" /> : <Save size={18} color="white" />}
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.tint,
    margin: 16,
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  toggle: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    borderColor: Colors.tint,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  toggleText: {
    color: '#666',
    fontWeight: '800',
  },
  toggleTextOn: {
    color: Colors.tint,
  },
  formError: {
    color: Colors.error,
    fontWeight: '700',
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    gap: 10,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stateWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  stateText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
});
