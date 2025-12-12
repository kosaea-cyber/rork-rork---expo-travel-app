import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function BlogListScreen() {
  const router = useRouter();
  const { blogs, initData } = useDataStore();
  const language = useI18nStore((state) => state.language);

  useEffect(() => {
    initData();
  }, []);

  const renderItem = ({ item }: { item: typeof blogs[0] }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/account/blog/${item.id}`)}
    >
      <Text style={styles.date}>{item.createdAt}</Text>
      <Text style={styles.title}>{getLocalized(item.title, language)}</Text>
      <Text style={styles.excerpt}>{getLocalized(item.excerpt, language)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={blogs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  date: {
    color: Colors.tint,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  excerpt: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
