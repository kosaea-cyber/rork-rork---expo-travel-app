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
import { ChevronDown, Edit2, Plus, Save, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { deleteStorageObjectByPublicUrl } from '@/lib/supabase/storageUpload';

type ServiceCategoryRow = {
  id: string;
  title_en: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type PackageRow = {
  id: string;
  category_id: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_de: string | null;
  image_url: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_type: 'fixed' | 'starting_from' | null;
  created_at: string;
  updated_at: string | null;
};

type EditablePackage = {
  id?: string;
  category_id: string;
  is_active: boolean;
  sort_order: number;
  title_en: string;
  title_ar: string;
  title_de: string;
  description_en: string;
  description_ar: string;
  description_de: string;
  image_url: string;
  price_amount: string;
  price_currency: string;
  price_type: 'fixed' | 'starting_from';
};

function normalizePackage(row?: PackageRow | null): EditablePackage {
  return {
    id: row?.id,
    category_id: row?.category_id ?? '',
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
    title_en: row?.title_en ?? '',
    title_ar: row?.title_ar ?? '',
    title_de: row?.title_de ?? '',
    description_en: row?.description_en ?? '',
    description_ar: row?.description_ar ?? '',
    description_de: row?.description_de ?? '',
    image_url: row?.image_url ?? '',
    price_amount: row?.price_amount != null ? String(row.price_amount) : '',
    price_currency: row?.price_currency ?? 'AED',
    price_type: row?.price_type ?? 'fixed',
  };
}

export default function AdminPackages() {
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editing, setEditing] = useState<EditablePackage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState<boolean>(false);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'service_categories', 'minimal'],
    queryFn: async (): Promise<ServiceCategoryRow[]> => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, title_en, is_active, sort_order')
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ServiceCategoryRow[];
    },
  });

  const packagesQuery = useQuery({
    queryKey: ['admin', 'packages'],
    queryFn: async (): Promise<PackageRow[]> => {
      console.log('[admin/packages] fetching packages');
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, category_id, is_active, sort_order, title_en, title_ar, title_de, description_en, description_ar, description_de, image_url, price_amount, price_currency, price_type, created_at, updated_at',
        )
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.log('[admin/packages] fetch error', error);
        throw new Error(error.message);
      }

      console.log('[admin/packages] fetched', { count: data?.length ?? 0 });
      return (data ?? []) as PackageRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: EditablePackage): Promise<void> => {
      const priceAmount = payload.price_amount.trim().length ? Number(payload.price_amount) : null;
      if (payload.price_amount.trim().length && !Number.isFinite(priceAmount)) {
        throw new Error('Price amount must be a number');
      }

      const insertRow = {
        category_id: payload.category_id,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        image_url: payload.image_url || null,
        price_amount: priceAmount,
        price_currency: payload.price_currency || null,
        price_type: payload.price_type,
      };

      const { error } = await supabase.from('packages').insert(insertRow);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: EditablePackage): Promise<void> => {
      if (!payload.id) throw new Error('Missing package id');

      const priceAmount = payload.price_amount.trim().length ? Number(payload.price_amount) : null;
      if (payload.price_amount.trim().length && !Number.isFinite(priceAmount)) {
        throw new Error('Price amount must be a number');
      }

      const updateRow = {
        category_id: payload.category_id,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        image_url: payload.image_url || null,
        price_amount: priceAmount,
        price_currency: payload.price_currency || null,
        price_type: payload.price_type,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('packages').update(updateRow).eq('id', payload.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (params: { id: string; imageUrl?: string | null }): Promise<void> => {
      const { error } = await supabase.from('packages').delete().eq('id', params.id);
      if (error) throw new Error(error.message);

      if (params.imageUrl?.trim()) {
        try {
          await deleteStorageObjectByPublicUrl({ bucket: 'app-media', publicUrl: params.imageUrl });
        } catch (e) {
          console.error('[admin/packages] orphan cleanup failed (non-blocking)', e);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
    },
  });

  const categories = useMemo<ServiceCategoryRow[]>(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const packages = useMemo<PackageRow[]>(() => packagesQuery.data ?? [], [packagesQuery.data]);

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, (c.title_en ?? '').trim() || c.id);
    }
    return map;
  }, [categories]);

  const createPackage = createMutation.mutateAsync;
  const updatePackage = updateMutation.mutateAsync;
  const deletePackage = deleteMutation.mutateAsync;

  const openNew = useCallback(() => {
    setFormError(null);
    const first = categories[0];
    setEditing({
      ...normalizePackage(null),
      category_id: first?.id ?? '',
      price_type: 'fixed',
    });
    setModalVisible(true);
  }, [categories]);

  const openEdit = useCallback((row: PackageRow) => {
    setFormError(null);
    setEditing(normalizePackage(row));
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditing(null);
    setFormError(null);
    setCategoryPickerOpen(false);
  }, []);

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSave = useCallback(async () => {
    if (!editing) return;

    if (!editing.category_id.trim()) {
      setFormError('Category is required (category_id).');
      return;
    }

    const payload: EditablePackage = {
      ...editing,
      category_id: editing.category_id.trim(),
      sort_order: Number.isFinite(editing.sort_order) ? editing.sort_order : 0,
      price_type: editing.price_type ?? 'fixed',
    };

    setFormError(null);
    try {
      if (payload.id) {
        await updatePackage(payload);
      } else {
        await createPackage(payload);
      }
      closeModal();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save.';
      setFormError(message);
    }
  }, [closeModal, createPackage, editing, updatePackage]);

  const onDelete = useCallback(
    async (row: { id: string; image_url?: string | null }) => {
      try {
        await deletePackage({ id: row.id, imageUrl: row.image_url ?? null });
      } catch (e) {
        console.error('[admin/packages] delete failed', e);
      }
    },
    [deletePackage],
  );

  const renderItem = useCallback(
    ({ item }: { item: PackageRow }) => {
      const catLabel = item.category_id ? (categoryLabelById.get(item.category_id) ?? item.category_id) : '—';
      const title = (item.title_en ?? '').trim() || '(UNTITLED)';
      const pricePrefix = item.price_type === 'starting_from' ? 'Starting from ' : '';
      const priceText =
        item.price_amount != null && item.price_currency
          ? `${pricePrefix}${item.price_amount} ${item.price_currency}`
          : item.price_amount != null
            ? `${pricePrefix}${item.price_amount}`
            : '—';

      return (
        <View style={styles.card} testID={`admin-package-card-${item.id}`}>
          {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  category: {catLabel}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  price: {priceText}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable testID={`admin-package-edit-${item.id}`} onPress={() => openEdit(item)} style={styles.actionBtn}>
                  <Edit2 size={20} color={Colors.tint} />
                </Pressable>
                <Pressable
                  testID={`admin-package-delete-${item.id}`}
                  onPress={() => onDelete(item)}
                  style={styles.actionBtn}
                >
                  <Trash2 size={20} color={Colors.error} />
                </Pressable>
              </View>
            </View>

            <Text style={styles.meta} numberOfLines={2}>
              ID: {item.id}
            </Text>
          </View>
        </View>
      );
    },
    [categoryLabelById, onDelete, openEdit],
  );

  if (packagesQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <View style={styles.stateWrap} testID="admin-packages-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading packages…</Text>
      </View>
    );
  }

  if (packagesQuery.isError || categoriesQuery.isError) {
    const message =
      (packagesQuery.error instanceof Error ? packagesQuery.error.message : null) ??
      (categoriesQuery.error instanceof Error ? categoriesQuery.error.message : null) ??
      'Unknown error';

    return (
      <View style={styles.stateWrap} testID="admin-packages-error">
        <Text style={styles.stateText}>Couldn’t load packages.</Text>
        <Text style={[styles.stateText, { fontWeight: '600' }]}>{message}</Text>
        <Pressable
          testID="admin-packages-retry"
          style={styles.retryBtn}
          onPress={() => {
            packagesQuery.refetch();
            categoriesQuery.refetch();
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="admin-packages">
      <Pressable testID="admin-packages-add" style={styles.addBtn} onPress={openNew}>
        <Plus size={22} color="white" />
        <Text style={styles.addBtnText}>Add Package</Text>
      </Pressable>

      <FlatList
        data={packages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.stateWrap} testID="admin-packages-empty">
            <Text style={styles.stateText}>No packages yet.</Text>
            <Pressable
              testID="admin-packages-empty-retry"
              style={styles.retryBtn}
              onPress={() => {
                packagesQuery.refetch();
                categoriesQuery.refetch();
              }}
            >
              <Text style={styles.retryText}>Refresh</Text>
            </Pressable>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modalContainer} testID="admin-packages-modal">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing?.id ? 'Edit Package' : 'New Package'}</Text>
            <Pressable testID="admin-packages-modal-close" onPress={closeModal}>
              <X size={24} color="#333" />
            </Pressable>
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 30 }}>
            {editing ? (
              <>
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <Text style={styles.label}>Category</Text>
                <Pressable
                  testID="admin-package-category-selector"
                  style={styles.dropdownBtn}
                  onPress={() => setCategoryPickerOpen(true)}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {editing.category_id
                      ? categoryLabelById.get(editing.category_id) ?? editing.category_id
                      : 'Select a category'}
                  </Text>
                  <ChevronDown size={18} color="#333" />
                </Pressable>

                <Modal
                  visible={categoryPickerOpen}
                  animationType="fade"
                  transparent
                  onRequestClose={() => setCategoryPickerOpen(false)}
                >
                  <Pressable
                    testID="admin-package-category-picker-backdrop"
                    style={styles.pickerBackdrop}
                    onPress={() => setCategoryPickerOpen(false)}
                  >
                    <Pressable testID="admin-package-category-picker" style={styles.pickerSheet} onPress={() => null}>
                      <Text style={styles.pickerTitle}>Choose category</Text>
                      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 6 }}>
                        {categories.map((c) => {
                          const isSelected = editing.category_id === c.id;
                          const label = (c.title_en ?? '').trim() || c.id;
                          const inactive = c.is_active === false;
                          return (
                            <Pressable
                              key={c.id}
                              testID={`admin-package-category-${c.id}`}
                              style={[styles.pickerRow, isSelected && styles.pickerRowActive]}
                              onPress={() => {
                                setEditing({ ...editing, category_id: c.id });
                                setCategoryPickerOpen(false);
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pickerRowTitle} numberOfLines={1}>
                                  {label}
                                </Text>
                                {inactive ? <Text style={styles.pickerRowMeta}>Inactive</Text> : null}
                              </View>
                              {isSelected ? <Text style={styles.pickerCheck}>✓</Text> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      <Pressable
                        testID="admin-package-category-picker-close"
                        style={styles.pickerCloseBtn}
                        onPress={() => setCategoryPickerOpen(false)}
                      >
                        <Text style={styles.pickerCloseText}>Close</Text>
                      </Pressable>
                    </Pressable>
                  </Pressable>
                </Modal>

                <Text style={styles.label}>Title (EN)</Text>
                <TextInput
                  testID="admin-package-title-en"
                  style={styles.input}
                  value={editing.title_en}
                  onChangeText={(t) => setEditing({ ...editing, title_en: t })}
                />

                <Text style={styles.label}>Title (AR)</Text>
                <TextInput
                  testID="admin-package-title-ar"
                  style={styles.input}
                  value={editing.title_ar}
                  onChangeText={(t) => setEditing({ ...editing, title_ar: t })}
                />

                <Text style={styles.label}>Title (DE)</Text>
                <TextInput
                  testID="admin-package-title-de"
                  style={styles.input}
                  value={editing.title_de}
                  onChangeText={(t) => setEditing({ ...editing, title_de: t })}
                />

                <Text style={styles.label}>Description (EN)</Text>
                <TextInput
                  testID="admin-package-desc-en"
                  style={[styles.input, styles.textArea]}
                  value={editing.description_en}
                  onChangeText={(t) => setEditing({ ...editing, description_en: t })}
                  multiline
                />

                <Text style={styles.label}>Image URL</Text>
                <TextInput
                  testID="admin-package-image-url"
                  style={styles.input}
                  value={editing.image_url}
                  onChangeText={(t) => setEditing({ ...editing, image_url: t })}
                  autoCapitalize="none"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price Amount</Text>
                    <TextInput
                      testID="admin-package-price-amount"
                      style={styles.input}
                      value={editing.price_amount}
                      onChangeText={(t) => setEditing({ ...editing, price_amount: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ width: 110 }}>
                    <Text style={styles.label}>Currency</Text>
                    <TextInput
                      testID="admin-package-price-currency"
                      style={styles.input}
                      value={editing.price_currency}
                      onChangeText={(t) => setEditing({ ...editing, price_currency: t })}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Price Type</Text>
                <View style={styles.row}>
                  <Pressable
                    testID="admin-package-price-type-fixed"
                    style={[styles.chip, editing.price_type === 'fixed' && styles.chipActive]}
                    onPress={() => setEditing({ ...editing, price_type: 'fixed' })}
                  >
                    <Text style={[styles.chipText, editing.price_type === 'fixed' && styles.chipTextActive]}>
                      Fixed price
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="admin-package-price-type-starting"
                    style={[styles.chip, editing.price_type === 'starting_from' && styles.chipActive]}
                    onPress={() => setEditing({ ...editing, price_type: 'starting_from' })}
                  >
                    <Text
                      style={[styles.chipText, editing.price_type === 'starting_from' && styles.chipTextActive]}
                    >
                      Starting from
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Sort Order</Text>
                    <TextInput
                      testID="admin-package-sort"
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
                      testID="admin-package-is-active"
                      style={[styles.toggle, editing.is_active && styles.toggleOn]}
                      onPress={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    >
                      <Text style={[styles.toggleText, editing.is_active && styles.toggleTextOn]}>
                        {editing.is_active ? 'Yes' : 'No'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable testID="admin-package-save" style={styles.saveBtn} onPress={onSave} disabled={saving}>
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
    backgroundColor: '#eee',
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
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
    flex: 1,
  },
  chipActive: {
    borderColor: Colors.tint,
    backgroundColor: Colors.tint,
  },
  chipText: {
    color: '#666',
    fontWeight: '800',
  },
  chipTextActive: {
    color: 'white',
  },
  dropdownBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    color: '#222',
    fontSize: 15,
    fontWeight: '800',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  pickerRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerRowActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  pickerRowTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },
  pickerRowMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#8a8a8a',
  },
  pickerCheck: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.tint,
  },
  pickerCloseBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
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
