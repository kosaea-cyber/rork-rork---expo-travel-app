import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react-native';
import { Check, ChevronDown, Edit2, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { deleteStorageObjectByPublicUrl, pickAndUploadImage } from '@/lib/supabase/storageUpload';

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

type CategoryInsert = {
  slug: string;
  title_en: string;
  title_ar: string;
  title_de: string;
  description_en: string;
  description_ar: string;
  description_de: string;
  icon: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
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

type IconName = keyof typeof LucideIcons;

const DEFAULT_ICON = 'Grid3X3' as const;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 64;
}

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
    icon: row?.icon ?? DEFAULT_ICON,
    image_url: row?.image_url ?? '',
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
  };
}

function getLucideIconComponent(iconName: string | null | undefined) {
  const name = (iconName?.trim() || DEFAULT_ICON) as IconName;
  const maybe = (LucideIcons as Record<string, unknown>)[name];
  if (typeof maybe === 'function') return maybe as React.ComponentType<{ size?: number; color?: string }>;
  return LucideIcons.Grid3X3;
}

const ICON_PRESETS: IconName[] = [
  'Grid3X3',
  'Sparkles',
  'Plane',
  'Car',
  'Hotel',
  'ShieldCheck',
  'Stethoscope',
  'HeartHandshake',
  'Waves',
  'Sun',
  'Moon',
  'Palmtree',
  'ShoppingBag',
  'Crown',
  'Gem',
  'ConciergeBell',
  'MapPin',
  'Camera',
  'Flower2',
  'Leaf',
  'Utensils',
  'GraduationCap',
  'Baby',
  'Users',
];

export default function AdminServices() {
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [iconPickerVisible, setIconPickerVisible] = useState<boolean>(false);
  const [iconSearch, setIconSearch] = useState<string>('');

  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugDirty, setSlugDirty] = useState<boolean>(false);

  const lastAutoSlugRef = useRef<string>('');

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

      const insertRow: CategoryInsert = {
        slug: payload.slug,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        icon: payload.icon,
        image_url: payload.image_url ? payload.image_url : null,
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

      const updateRow: CategoryInsert & { updated_at: string } = {
        slug: payload.slug,
        title_en: payload.title_en,
        title_ar: payload.title_ar,
        title_de: payload.title_de,
        description_en: payload.description_en,
        description_ar: payload.description_ar,
        description_de: payload.description_de,
        icon: payload.icon,
        image_url: payload.image_url ? payload.image_url : null,
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

  const updateActiveMutation = useMutation({
    mutationFn: async (params: { id: string; is_active: boolean }): Promise<void> => {
      console.log('[admin/services] update active', params);
      const { error } = await supabase
        .from('service_categories')
        .update({ is_active: params.is_active, updated_at: new Date().toISOString() })
        .eq('id', params.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'service_categories'] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (params: { id: string; imageUrl?: string | null }): Promise<void> => {
      console.log('[admin/services] delete category', { id: params.id });
      const { error } = await supabase.from('service_categories').delete().eq('id', params.id);
      if (error) {
        console.log('[admin/services] delete error', error);
        throw new Error(error.message);
      }

      if (params.imageUrl?.trim()) {
        try {
          await deleteStorageObjectByPublicUrl({ bucket: 'app-media', publicUrl: params.imageUrl });
        } catch (e) {
          console.error('[admin/services] orphan cleanup failed (non-blocking)', e);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'service_categories'] });
    },
  });

  const openNew = useCallback(() => {
    setFormError(null);
    setSlugDirty(false);
    lastAutoSlugRef.current = '';
    setEditing(normalizeEditable(null));
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((row: ServiceCategoryRow) => {
    setFormError(null);
    setSlugDirty(true);
    lastAutoSlugRef.current = '';
    setEditing(normalizeEditable(row));
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setIconPickerVisible(false);
    setIconSearch('');
    setEditing(null);
    setFormError(null);
    setSlugDirty(false);
    lastAutoSlugRef.current = '';
  }, []);

  const createCategory = createCategoryMutation.mutateAsync;
  const updateCategory = updateCategoryMutation.mutateAsync;
  const deleteCategory = deleteCategoryMutation.mutateAsync;
  const updateActive = updateActiveMutation.mutateAsync;

  const uploadImageMutation = useMutation({
    mutationFn: async (): Promise<{ publicUrl: string; path: string } | null> => {
      if (!editing) throw new Error('No category in edit mode');
      const base = editing.slug.trim() ? editing.slug.trim() : slugify(editing.title_en || 'category');
      const safe = base || 'category';
      console.log('[admin/services] uploading category image', { folder: `categories/${safe}` });
      return pickAndUploadImage({ folder: `categories/${safe}`, bucket: 'app-media' });
    },
  });

  const uploadImage = uploadImageMutation.mutateAsync;

  const saving = createCategoryMutation.isPending || updateCategoryMutation.isPending;
  const uploadingImage = uploadImageMutation.isPending;

  const onSave = useCallback(async () => {
    if (!editing) return;

    const trimmedSlug = editing.slug.trim();
    if (!trimmedSlug) {
      setFormError('Slug is required.');
      return;
    }
    if (!isValidSlug(trimmedSlug)) {
      setFormError('Slug must be 2–64 chars (a-z, 0-9, hyphens).');
      return;
    }

    const payload: EditableCategory = {
      ...editing,
      slug: trimmedSlug,
      sort_order: Number.isFinite(editing.sort_order) ? editing.sort_order : 0,
      icon: (editing.icon?.trim() || DEFAULT_ICON) as string,
    };

    if (!payload.title_en.trim()) {
      setFormError('Title (EN) is required.');
      return;
    }

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

  const getPackageCount = useCallback(async (categoryId: string): Promise<number | null> => {
    try {
      const { count, error } = await supabase
        .from('packages')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      if (error) {
        console.log('[admin/services] package count error', error);
        return null;
      }
      return typeof count === 'number' ? count : 0;
    } catch (e) {
      console.log('[admin/services] package count unexpected error', e);
      return null;
    }
  }, []);

  const onDelete = useCallback(
    async (row: ServiceCategoryRow) => {
      const pkgCount = await getPackageCount(row.id);
      const warning =
        typeof pkgCount === 'number' && pkgCount > 0
          ? `\n\nWarning: this category has ${pkgCount} package(s). Deleting may break related records.`
          : '';

      Alert.alert('Delete category?', `This cannot be undone.${warning}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory({ id: row.id, imageUrl: row.image_url });
            } catch (e) {
              console.error('[admin/services] delete failed', e);
              Alert.alert('Delete failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]);
    },
    [deleteCategory, getPackageCount],
  );

  const listData = useMemo<ServiceCategoryRow[]>(() => categories ?? [], [categories]);

  const filteredIcons = useMemo<IconName[]>(() => {
    const q = iconSearch.trim().toLowerCase();
    const base = q
      ? (Object.keys(LucideIcons) as IconName[]).filter((k) => k.toLowerCase().includes(q))
      : ICON_PRESETS;

    const uniq = Array.from(new Set(base));
    return uniq.slice(0, 60);
  }, [iconSearch]);

  const onToggleActive = useCallback(
    async (row: ServiceCategoryRow) => {
      const next = !(row.is_active ?? false);
      try {
        await updateActive({ id: row.id, is_active: next });
      } catch (e) {
        console.error('[admin/services] active toggle failed', e);
        Alert.alert('Update failed', e instanceof Error ? e.message : 'Unknown error');
      }
    },
    [updateActive],
  );

  const renderItem = useCallback(
    ({ item }: { item: ServiceCategoryRow }) => {
      const IconComp = getLucideIconComponent(item.icon);
      const active = item.is_active ?? false;

      return (
        <View style={styles.card} testID={`admin-category-card-${item.id}`}>
          <View style={styles.cardTop}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]} />
            )}

            <View style={styles.cardMain}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.nameWrap}>
                  <View style={styles.titleRow}>
                    <View style={styles.iconBadge}>
                      <IconComp size={16} color={active ? '#0F172A' : '#6B7280'} />
                    </View>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title_en?.trim() || '(Untitled)'}
                    </Text>
                  </View>

                  <Text style={styles.meta} numberOfLines={1}>
                    /{item.slug ?? '—'} • sort {item.sort_order ?? 0}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    testID={`admin-category-active-${item.id}`}
                    onPress={() => onToggleActive(item)}
                    style={[styles.activePill, active ? styles.activePillOn : styles.activePillOff]}
                  >
                    <Text style={[styles.activePillText, active ? styles.activePillTextOn : styles.activePillTextOff]}>
                      {active ? 'Active' : 'Inactive'}
                    </Text>
                  </Pressable>

                  <Pressable
                    testID={`admin-category-edit-${item.id}`}
                    onPress={() => openEdit(item)}
                    style={styles.iconBtn}
                  >
                    <Edit2 size={18} color={'#0F172A'} />
                  </Pressable>
                  <Pressable
                    testID={`admin-category-delete-${item.id}`}
                    onPress={() => onDelete(item)}
                    style={styles.iconBtn}
                  >
                    <Trash2 size={18} color={Colors.error} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.micro} numberOfLines={1}>
                id: {item.id}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [onDelete, onToggleActive, openEdit],
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
      <View style={styles.topBar} testID="admin-categories-topbar">
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Service Categories</Text>
          <Text style={styles.pageSubtitle}>Create, organize, and publish your categories.</Text>
        </View>
        <Pressable testID="admin-categories-add" style={styles.addBtn} onPress={openNew}>
          <Plus size={18} color={'#0B1220'} />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

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
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{editing?.id ? 'Edit Category' : 'New Category'}</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {editing?.id ? `/${editing?.slug || ''}` : 'Create a new service category'}
              </Text>
            </View>
            <Pressable testID="admin-categories-modal-close" onPress={closeModal} style={styles.iconBtn}>
              <X size={20} color={'#0F172A'} />
            </Pressable>
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 44 }}>
            {editing ? (
              <>
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Basics</Text>

                  <Text style={styles.label}>Title (EN)</Text>
                  <TextInput
                    testID="admin-category-title-en"
                    style={styles.input}
                    value={editing.title_en}
                    onChangeText={(t) => {
                      const nextTitle = t;
                      const nextAuto = slugify(nextTitle);
                      setEditing((prev) => {
                        if (!prev) return prev;
                        const shouldAuto = !slugDirty || prev.slug.trim() === lastAutoSlugRef.current;
                        const nextSlug = shouldAuto ? nextAuto : prev.slug;
                        if (shouldAuto) lastAutoSlugRef.current = nextAuto;
                        return { ...prev, title_en: nextTitle, slug: nextSlug };
                      });
                    }}
                    placeholder="e.g. Wellness"
                  />

                  <View style={styles.slugRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Slug (unique)</Text>
                      <TextInput
                        testID="admin-category-slug"
                        style={[styles.input, !isValidSlug(editing.slug.trim()) && styles.inputInvalid]}
                        value={editing.slug}
                        onChangeText={(t) => {
                          setSlugDirty(true);
                          setEditing({ ...editing, slug: t });
                        }}
                        placeholder="e.g. wellness"
                        autoCapitalize="none"
                      />
                      <Text style={styles.helpText}>
                        {isValidSlug(editing.slug.trim()) ? 'Lowercase, hyphen-separated.' : 'Use: a-z, 0-9, hyphens.'}
                      </Text>
                    </View>

                    <Pressable
                      testID="admin-category-slug-reset"
                      style={styles.ghostBtn}
                      onPress={() => {
                        const next = slugify(editing.title_en);
                        lastAutoSlugRef.current = next;
                        setSlugDirty(false);
                        setEditing({ ...editing, slug: next });
                      }}
                    >
                      <Text style={styles.ghostBtnText}>Auto</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Title (AR)</Text>
                  <TextInput
                    testID="admin-category-title-ar"
                    style={[styles.input, { textAlign: 'right' }]}
                    value={editing.title_ar}
                    onChangeText={(t) => setEditing({ ...editing, title_ar: t })}
                    placeholder="العنوان"
                  />

                  <Text style={styles.label}>Title (DE)</Text>
                  <TextInput
                    testID="admin-category-title-de"
                    style={styles.input}
                    value={editing.title_de}
                    onChangeText={(t) => setEditing({ ...editing, title_de: t })}
                    placeholder="Titel"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Descriptions</Text>

                  <Text style={styles.label}>Description (EN)</Text>
                  <TextInput
                    testID="admin-category-desc-en"
                    style={[styles.input, styles.textArea]}
                    value={editing.description_en}
                    onChangeText={(t) => setEditing({ ...editing, description_en: t })}
                    multiline
                    placeholder="What is this category about?"
                  />

                  <Text style={styles.label}>Description (AR)</Text>
                  <TextInput
                    testID="admin-category-desc-ar"
                    style={[styles.input, styles.textArea, { textAlign: 'right' }]}
                    value={editing.description_ar}
                    onChangeText={(t) => setEditing({ ...editing, description_ar: t })}
                    multiline
                    placeholder="الوصف"
                  />

                  <Text style={styles.label}>Description (DE)</Text>
                  <TextInput
                    testID="admin-category-desc-de"
                    style={[styles.input, styles.textArea]}
                    value={editing.description_de}
                    onChangeText={(t) => setEditing({ ...editing, description_de: t })}
                    multiline
                    placeholder="Beschreibung"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Media & Icon</Text>

                  <Text style={styles.label}>Icon</Text>
                  <Pressable
                    testID="admin-category-icon-picker"
                    style={styles.pickerBtn}
                    onPress={() => setIconPickerVisible(true)}
                  >
                    <View style={styles.pickerLeft}>
                      {(() => {
                        const IconComp = getLucideIconComponent(editing.icon);
                        return (
                          <View style={styles.iconPreview}>
                            <IconComp size={18} color={'#0F172A'} />
                          </View>
                        );
                      })()}
                      <Text style={styles.pickerText} numberOfLines={1}>
                        {editing.icon || DEFAULT_ICON}
                      </Text>
                    </View>
                    <ChevronDown size={18} color={'#0F172A'} />
                  </Pressable>

                  <Text style={styles.label}>Image</Text>
                  <View style={styles.imageRow}>
                    {editing.image_url ? (
                      <Image source={{ uri: editing.image_url }} style={styles.formImage} />
                    ) : (
                      <View style={[styles.formImage, styles.formImagePlaceholder]} />
                    )}

                    <View style={{ flex: 1, gap: 10 }}>
                      <Pressable
                        testID="admin-category-image-upload"
                        style={[styles.primaryBtn, uploadingImage && styles.primaryBtnDisabled]}
                        onPress={async () => {
                          try {
                            const res = await uploadImage();
                            if (res?.publicUrl) {
                              setEditing((prev) => (prev ? { ...prev, image_url: res.publicUrl } : prev));
                            }
                          } catch (e) {
                            Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error');
                          }
                        }}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <ActivityIndicator color={'#0B1220'} />
                        ) : (
                          <ImagePlus size={18} color={'#0B1220'} />
                        )}
                        <Text style={styles.primaryBtnText}>{uploadingImage ? 'Uploading…' : 'Upload image'}</Text>
                      </Pressable>

                      {editing.image_url ? (
                        <Pressable
                          testID="admin-category-image-clear"
                          style={styles.ghostDangerBtn}
                          onPress={() => setEditing({ ...editing, image_url: '' })}
                        >
                          <Text style={styles.ghostDangerBtnText}>Remove</Text>
                        </Pressable>
                      ) : null}

                      {Platform.OS === 'web' ? (
                        <Text style={styles.helpText}>On web, image picking uses browser file picker.</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Publishing</Text>

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
                          {editing.is_active ? 'Published' : 'Hidden'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Pressable testID="admin-category-save" style={styles.saveBtn} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="white" /> : <Save size={18} color="white" />}
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
          <Modal
            visible={iconPickerVisible}
            animationType="fade"
            transparent
            onRequestClose={() => setIconPickerVisible(false)}
          >
            <Pressable
              testID="admin-category-icon-picker-overlay"
              style={styles.overlay}
              onPress={() => setIconPickerVisible(false)}
            >
              <Pressable style={styles.iconSheet} testID="admin-category-icon-picker-sheet">
                <View style={styles.iconSheetHeader}>
                  <Text style={styles.iconSheetTitle}>Pick an icon</Text>
                  <Pressable testID="admin-category-icon-picker-close" onPress={() => setIconPickerVisible(false)}>
                    <X size={18} color={'#0F172A'} />
                  </Pressable>
                </View>

                <TextInput
                  testID="admin-category-icon-search"
                  style={styles.searchInput}
                  value={iconSearch}
                  onChangeText={setIconSearch}
                  placeholder="Search (e.g. Plane, PalmTree…)"
                  autoCapitalize="none"
                />

                <ScrollView contentContainerStyle={styles.iconGrid}>
                  {filteredIcons.map((iconName: IconName) => {
                    const IconComp = getLucideIconComponent(iconName);
                    const isSelected = editing?.icon === iconName;
                    return (
                      <Pressable
                        key={iconName}
                        testID={`admin-category-icon-${iconName}`}
                        style={[styles.iconCell, isSelected && styles.iconCellSelected]}
                        onPress={() => {
                          setEditing((prev) => (prev ? { ...prev, icon: iconName } : prev));
                          setIconPickerVisible(false);
                        }}
                      >
                        <View style={styles.iconCellTop}>
                          <IconComp size={18} color={'#0F172A'} />
                          {isSelected ? (
                            <View style={styles.checkBadge}>
                              <Check size={12} color={'#0B1220'} />
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.iconCellText} numberOfLines={1}>
                          {iconName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  pageSubtitle: {
    marginTop: 4,
    color: 'rgba(248, 250, 252, 0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E7C77B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: {
    color: '#0B1220',
    fontSize: 13,
    fontWeight: '900',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  thumb: {
    width: 86,
    height: 86,
    borderRadius: 14,
    margin: 12,
  },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cardMain: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(231, 199, 123, 0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
    flex: 1,
  },
  meta: {
    marginTop: 6,
    color: 'rgba(248, 250, 252, 0.70)',
    fontSize: 12,
    fontWeight: '700',
  },
  micro: {
    marginTop: 10,
    color: 'rgba(248, 250, 252, 0.52)',
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  activePill: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  activePillOn: {
    backgroundColor: 'rgba(231, 199, 123, 0.92)',
    borderColor: 'rgba(231, 199, 123, 0.92)',
  },
  activePillOff: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  activePillTextOn: {
    color: '#0B1220',
  },
  activePillTextOff: {
    color: 'rgba(248, 250, 252, 0.70)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 4,
    color: 'rgba(15, 23, 42, 0.55)',
    fontSize: 12,
    fontWeight: '800',
  },
  form: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(15, 23, 42, 0.70)',
    marginBottom: 8,
    marginTop: 12,
  },
  helpText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.55)',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: '#FBFBFA',
    color: '#0F172A',
    fontWeight: '700',
  },
  inputInvalid: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  slugRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  ghostBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  pickerBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    backgroundColor: '#FBFBFA',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  pickerText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },
  iconPreview: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(231, 199, 123, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  formImage: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  formImagePlaceholder: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  primaryBtn: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E7C77B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#0B1220',
    fontSize: 13,
    fontWeight: '900',
  },
  ghostDangerBtn: {
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostDangerBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
  },
  toggle: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    backgroundColor: '#FBFBFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    borderColor: 'rgba(231, 199, 123, 0.75)',
    backgroundColor: 'rgba(231, 199, 123, 0.18)',
  },
  toggleText: {
    color: 'rgba(15, 23, 42, 0.65)',
    fontWeight: '900',
    fontSize: 12,
  },
  toggleTextOn: {
    color: '#0F172A',
  },
  formError: {
    color: '#B91C1C',
    fontWeight: '900',
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 10,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  stateWrap: {
    flex: 1,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  stateText: {
    color: 'rgba(248, 250, 252, 0.86)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#E7C77B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#0B1220',
    fontSize: 14,
    fontWeight: '900',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  iconSheet: {
    backgroundColor: '#F7F6F2',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    maxHeight: '80%',
  },
  iconSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  iconSheetTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
  },
  searchInput: {
    height: 42,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontWeight: '800',
  },
  iconGrid: {
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconCell: {
    width: '31%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 14,
    padding: 10,
  },
  iconCellSelected: {
    borderColor: 'rgba(231, 199, 123, 0.90)',
    backgroundColor: 'rgba(231, 199, 123, 0.16)',
  },
  iconCellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(231, 199, 123, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCellText: {
    marginTop: 8,
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '900',
  },
});
