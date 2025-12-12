import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import * as LucideIcons from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function ServiceCategories() {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const router = useRouter();
  const { services, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);

  const renderItem = ({ item }: { item: typeof services[0] }) => {
    // @ts-ignore
    const Icon = LucideIcons[item.icon] || LucideIcons.HelpCircle;
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/(tabs)/services', params: { category: item.id } })}
      >
        <View style={styles.iconContainer}>
          {Icon && <Icon color={Colors.tint} size={28} />}
        </View>
        <Text style={styles.cardTitle}>{getLocalized(item.title, language)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
