import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/dataStore';
import { useEffect } from 'react';

export default function PackageDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const { user } = useAuthStore();
  const { packages, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);
  
  const pkg = packages.find(p => p.id === id);

  if (!pkg) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.text }}>Package not found</Text>
      </View>
    );
  }

  const handleBook = () => {
    if (user) {
      router.push({ pathname: '/(tabs)/services/book', params: { packageId: pkg.id } });
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {pkg.imageUrl ? (
          <Image source={{ uri: pkg.imageUrl }} style={styles.image} />
        ) : null}
        <View style={styles.header}>
           <Text style={styles.title}>{getLocalized(pkg.title, language)}</Text>
           <Text style={styles.price}>{pkg.price ? getLocalized(pkg.price, language) : ''}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBadge}>
            <Text style={styles.infoText}>{getLocalized(pkg.duration, language)}</Text>
          </View>
        </View>

        <Text style={styles.description}>{getLocalized(pkg.description, language)}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Included in this package</Text>
          {pkg.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Check color={Colors.tint} size={20} />
              <Text style={styles.featureText}>{getLocalized(feature, language)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleBook}>
          <Text style={styles.buttonText}>
            {user ? t('requestBooking') : t('loginToBook')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    marginTop: 16,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  infoBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
