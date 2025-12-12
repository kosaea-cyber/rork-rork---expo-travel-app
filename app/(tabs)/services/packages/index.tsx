import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function PackagesListScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const { packages, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);

  const filteredPackages = category 
    ? packages.filter(p => p.categoryId === category)
    : packages;

  const renderItem = ({ item }: { item: typeof packages[0] }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(tabs)/services/package/[id]', params: { id: item.id } })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{getLocalized(item.title, language)}</Text>
        <Text style={styles.duration}>{getLocalized(item.duration, language)}</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>{getLocalized(item.description, language)}</Text>
      <Text style={styles.price}>{item.price ? getLocalized(item.price, language) : ''}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPackages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No packages found for this category.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  duration: {
    color: Colors.textSecondary,
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  price: {
    color: Colors.tint,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
});
