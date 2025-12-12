import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trash2, Edit } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';

export default function AdminBlogs() {
  const router = useRouter();
  const { blogs, initData, deleteBlog } = useDataStore();

  useEffect(() => {
    initData();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Blog',
      'Are you sure you want to delete this blog post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => await deleteBlog(id)
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: typeof blogs[0] }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.title.en}</Text>
        <Text style={styles.date}>{item.createdAt}</Text>
        <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt.en}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: Colors.primary }]}
          onPress={() => router.push(`/admin/blog/${item.id}`)}
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

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => router.push('/admin/blog/new')}
      >
        <Plus size={24} color="white" />
        <Text style={styles.addButtonText}>New Blog Post</Text>
      </TouchableOpacity>

      <FlatList
        data={blogs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
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
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  excerpt: {
    fontSize: 14,
    color: '#444',
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
