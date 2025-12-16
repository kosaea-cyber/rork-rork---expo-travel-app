import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useAppImagesStore } from '@/store/appImagesStore';

export default function HeaderLogo() {
  const router = useRouter();
  const logoUrl = useAppImagesStore((s) => s.imagesByKey.logoUrl);

  return (
    <TouchableOpacity onPress={() => router.navigate('/(tabs)/home')} style={styles.container}>
      <Image
        source={logoUrl ? { uri: logoUrl } : { uri: 'https://images.unsplash.com/photo-1520975682031-a64d645746b4?auto=format&fit=crop&w=128&q=80' }}
        style={styles.logo}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 5,
    marginRight: 10,
  },
  logo: {
    width: 32,
    height: 32,
  },
});
