import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const { services, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);
  
  const service = services.find(s => s.id === id);

  if (!service) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>Service not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Image source={{ uri: service.image }} style={styles.image} />
      
      <View style={styles.content}>
        <Text style={styles.title}>{getLocalized(service.title, language)}</Text>
        <Text style={styles.description}>
           {/* Detailed description would be here. For now duplicating short desc or using generic text */}
           {getLocalized(service.description, language)}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          <View style={styles.bulletPoint}>
             <View style={styles.dot} />
             <Text style={styles.bulletText}>Exclusive Access</Text>
          </View>
          <View style={styles.bulletPoint}>
             <View style={styles.dot} />
             <Text style={styles.bulletText}>VIP Transport</Text>
          </View>
          <View style={styles.bulletPoint}>
             <View style={styles.dot} />
             <Text style={styles.bulletText}>24/7 Support</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push({ pathname: '/(tabs)/services/packages', params: { category: service.id } })}
        >
          <Text style={styles.buttonText}>{t('viewPackages')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  image: {
    width: '100%',
    height: 250,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.tint,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tint,
    marginRight: 10,
  },
  bulletText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
