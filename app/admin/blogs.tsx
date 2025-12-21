import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trash2, Edit } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

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
};

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

export default function AdminBlogs() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const blogsQuery = useQuery({
    queryKey: ['admin', 'blog_posts'],
    queryFn: async (): Promise<BlogRow[]> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id, is_active, created_at, published_at, cover_image_url, title_en, title_ar, title_de, excerpt_en, excerpt_ar, excerpt_de',
        )
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as BlogRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'blog_posts'] });
    },
  });

  const blogs = useMemo(() => blogsQuery.data ?? [], [blogsQuery.data]);

  const goNew = useCallback(() => {
    // uses the existing route app/admin/blog/[id].tsx with id="new"
    router.push({ pathname: '/admin/blog/[id]', params: { id: 'new' } });
  }, [router]);

  const goEdit = useCallback(
    (id: string) => {
      router.push({ pathname: '/admin/blog/[id]', params: { id } });
    },
    [router],
  );

  const onDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Blog', 'Are you sure you want to delete this blog post?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Delete failed.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]);
    },
    [deleteMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: BlogRow }) => {
      const title = (item.title_en ?? '').trim() || '(UNTITLED)';
      const excerpt = (item.excerpt_en ?? '').trim();
      const date = formatDate(item.published_at ?? item.created_at);
      const active = item.is_active ?? true;

      return (
        <View style={styles.card} testID={`admin-blog-card-${item.id}`}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={styles.cover} />
          ) : (
            <View style={styles.coverFallback} />
          )}

          <View style={styles.cardContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {date} • {active ? 'Published' : 'Hidden'}
              </Text>

              {excerpt ? (
                <Text style={styles.excerpt} numberOfLines={2}>
                  {excerpt}
                </Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.primary }]}
                onPress={() => goEdit(item.id)}
                testID={`admin-blog-edit-${item.id}`}
              >
                <Edit size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.error }]}
                onPress={() => onDelete(item.id)}
                testID={`admin-blog-delete-${item.id}`}
              >
                <Trash2 size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [goEdit, onDelete],
  );

  if (blogsQuery.isLoading) {
    return (
      <View style={styles.stateWrap} testID="admin-blogs-loading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading blog posts…</Text>
      </View>
    );
  }

  if (blogsQuery.isError) {
    const msg = blogsQuery.error instanceof Error ? blogsQuery.error.message : 'Unknown error';
    return (
      <View style={styles.stateWrap} testID="admin-blogs-error">
        <Text style={styles.stateText}>Couldn’t load blog posts.</Text>
        <Text style={[styles.stateText, { fontWeight: '700' }]}>{msg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => blogsQuery.refetch()} testID="admin-blogs-retry">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="admin-blogs">
      <TouchableOpacity style={styles.addButton} onPress={goNew} testID="admin-blogs-new">
        <Plus size={24} color="white" />
        <Text style={styles.addButtonText}>New Blog Post</Text>
      </TouchableOpacity>

      <FlatList
        data={blogs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.stateWrap} testID="admin-blogs-empty">
            <Text style={styles.stateText}>No blog posts yet.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => blogsQuery.refetch()}>
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },

  addButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cover: { width: '100%', height: 140, backgroundColor: '#eee' },
  coverFallback: { width: '100%', height: 140, backgroundColor: 'rgba(212,175,55,0.12)' },

  cardContent: {
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  title: { fontSize: 16, fontWeight: '900', color: '#111' },
  meta: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '700' },
  excerpt: { fontSize: 13, color: '#444', marginTop: 8, fontWeight: '600', lineHeight: 18 },

  actions: { flexDirection: 'column', gap: 10 },
  actionButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  stateWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  stateText: { color: Colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
});
