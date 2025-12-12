import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function FeaturedPackages() {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const router = useRouter();
  const { packages, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);

  const renderItem = ({ item }: { item: typeof packages[0] }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(tabs)/services/package/[id]', params: { id: item.id } })}
    >
      <View style={styles.imageContainer}>
        {/* Placeholder for package image, using a gradient view or service image */}
        <View style={styles.placeholderImage}>
           <Text style={styles.durationBadge}>{getLocalized(item.duration, language)}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{getLocalized(item.title, language)}</Text>
        <Text style={styles.price}>{getLocalized(item.price, language)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('featuredPackages')}</Text>
      </View>
      <FlatList
        data={packages.slice(0, 3)}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    width: 200,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    height: 120,
    backgroundColor: '#233554', // Dark blue placeholder
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 8,
  },
  durationBadge: {
    backgroundColor: Colors.tint,
    color: Colors.background,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  content: {
    padding: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  price: {
    color: Colors.tint,
    fontSize: 14,
    fontWeight: '600',
  },
});
