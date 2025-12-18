import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit } from 'lucide-react-native';
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

export default function AdminBlogs() {
  const router = useRouter();
  const qc = useQueryClient();

  const blogsQuery = useQuery({
    queryKey: ['admin', 'blog_posts'],
    queryFn: async (): Promise<BlogRow[]> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, is_active, created_at, published_at, cover_image_url, title_en, title_ar, title_de, excerpt_en, excerpt_ar, excerpt_de')
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
      await qc.invalidateQueries({ queryKey: ['admin', 'blog_posts'] });
    },
  });

  const blogs = useMemo(() => blogsQuery.data ?? [], [blogsQuery.data]);

  const handleDelete = useCallback(
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
              const msg = e instanceof Error ? e.message : 'Delete failed';
              Alert.alert('Delete failed', msg);
            }
          },
        },
      ]);
    },
    [deleteMutation],
  );

  const renderItem = ({ item }: { item: BlogRow }) => {
    const title = (item.title_en ?? '').trim() || '(UNTITLED)';
    const excerpt = (item.excerpt_en ?? '').trim();

    return (
      <View style={styles.card}>
        {item.cover_image_url ? <Image source={{ uri: item.cover_image_url }} style={styles.image} /> : null}

        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.date} numberOfLines={1}>{item.created_at}</Text>
          {!!excerpt && <Text style={styles.excerpt} numberOfLines={2}>{excerpt}</Text>}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.tint }]}
            onPress={() => router.push({ pathname: '/admin/blog/[id]', params: { id: item.id } })}
          >
            <Edit size={18} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.error }]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (blogsQuery.isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading blogs…</Text>
      </View>
    );
  }

  if (blogsQuery.isError) {
    const msg = blogsQuery.error instanceof Error ? blogsQuery.error.message : 'Unknown error';
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>Couldn’t load blogs.</Text>
        <Text style={[styles.stateText, { fontWeight: '800' }]}>{msg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/admin/blog/new')}>
        <Plus size={24} color="white" />
        <Text style={styles.addButtonText}>New Blog Post</Text>
      </TouchableOpacity>

      <FlatList data={blogs} renderItem={renderItem} keyExtractor={(i) => i.id} contentContainerStyle={styles.list} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  addButton: {
    backgroundColor: Colors.tint,
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
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: { width: 90, height: 90, backgroundColor: '#eee' },
  cardContent: { flex: 1, padding: 14 },
  title: { fontSize: 16, fontWeight: '900', marginBottom: 4, color: '#222' },
  date: { fontSize: 12, color: '#666', marginBottom: 8 },
  excerpt: { fontSize: 13, color: '#444' },
  actions: { flexDirection: 'column', gap: 8, paddingRight: 12 },
  actionButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: Colors.background },
  stateText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
