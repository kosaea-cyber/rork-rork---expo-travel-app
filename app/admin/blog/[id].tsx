import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { BlogPost } from '@/lib/db/types';
import LocalizedInput from '@/components/admin/LocalizedInput';

export default function EditBlog() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { blogs, addBlog, updateBlog } = useDataStore();
  const isNew = id === 'new';

  const [form, setForm] = useState<Partial<BlogPost>>({
    title: { en: '', ar: '', de: '' },
    createdAt: new Date().toISOString().split('T')[0],
    excerpt: { en: '', ar: '', de: '' },
    content: { en: '', ar: '', de: '' },
    imageUrl: '',
    author: 'Admin',
    category: 'General'
  });

  useEffect(() => {
    if (!isNew && typeof id === 'string') {
      const blog = blogs.find(b => b.id === id);
      if (blog) {
        setForm(blog);
      }
    }
  }, [id, blogs, isNew]);

  const handleSave = async () => {
    if (!form.title?.en || !form.content?.en) {
      Alert.alert('Error', 'Please fill in at least English title and content');
      return;
    }

    try {
      if (isNew) {
        await addBlog({
          ...form,
          id: Math.random().toString(36).substr(2, 9),
        } as BlogPost);
      } else {
        await updateBlog(form as BlogPost);
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save blog post');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LocalizedInput
        label="Title"
        value={form.title as any}
        onChange={(val) => setForm({ ...form, title: val })}
      />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={form.createdAt}
          onChangeText={(text) => setForm({ ...form, createdAt: text })}
          placeholder="e.g. 2025-10-12"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Image URL</Text>
        <TextInput
          style={styles.input}
          value={form.imageUrl}
          onChangeText={(text) => setForm({ ...form, imageUrl: text })}
          placeholder="https://..."
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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>
          {isNew ? 'Create Post' : 'Update Post'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  contentArea: {
    minHeight: 200,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
