import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useDataStore } from '@/store/dataStore';

export default function HeaderLogo() {
  const router = useRouter();
  const { appContent } = useDataStore();

  return (
    <TouchableOpacity onPress={() => router.navigate('/(tabs)/home')} style={styles.container}>
      <Image 
        source={appContent?.images?.logoUrl ? { uri: appContent.images.logoUrl } : require('@/assets/images/icon.png')} 
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
