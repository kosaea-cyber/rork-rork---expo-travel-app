import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useEffect } from 'react';

export default function BlogPostScreen() {
  const { id } = useLocalSearchParams();
  const { blogs, initData } = useDataStore();
  const language = useI18nStore((state) => state.language);

  useEffect(() => {
    initData();
  }, []);

  const post = blogs.find(b => b.id === id);

  if (!post) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{post.createdAt}</Text>
      <Text style={styles.title}>{getLocalized(post.title, language)}</Text>
      <View style={styles.divider} />
      <Text style={styles.body}>{getLocalized(post.content, language)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  date: {
    color: Colors.tint,
    fontSize: 14,
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 24,
  },
  body: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 16,
  },
});
