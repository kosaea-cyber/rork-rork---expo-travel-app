import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/dataStore';
import HeaderLogo from '@/components/HeaderLogo';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const setGuest = useAuthStore((state) => state.setGuest);
  const { appContent } = useDataStore();

  const handleGuest = () => {
    setGuest();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={{ uri: appContent.images?.welcomeBackground || 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80' }} // Damascus or generic luxury travel
        style={styles.background}
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
             <View style={styles.topBar}>
               <HeaderLogo />
             </View>
             <View style={styles.content}>
               <View style={styles.header}>
                 <Text style={styles.appName}>{t('appName')}</Text>
                 <Text style={styles.tagline}>{t('tagline')}</Text>
               </View>
   
               <View style={styles.buttons}>
                 <TouchableOpacity
                   style={[styles.button, styles.primaryButton]}
                   onPress={() => router.push('/auth/login')}
                 >
                   <Text style={styles.primaryButtonText}>{t('login')}</Text>
                 </TouchableOpacity>
   
                 <TouchableOpacity
                   style={[styles.button, styles.secondaryButton]}
                   onPress={() => router.push('/auth/register')}
                 >
                   <Text style={styles.secondaryButtonText}>{t('register')}</Text>
                 </TouchableOpacity>
   
                 <TouchableOpacity style={styles.guestButton} onPress={handleGuest}>
                   <Text style={styles.guestButtonText}>{t('guest')}</Text>
                 </TouchableOpacity>
               </View>
             </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  background: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 25, 47, 0.7)', // Dark overlay
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 30,
    paddingBottom: 60,
  },
  header: {
    marginTop: 100,
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.tint,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
    fontFamily: 'Georgia', // Or system serif if available, but staying safe
  },
  tagline: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  buttons: {
    gap: 16,
    width: '100%',
  },
  button: {
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.tint,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.tint,
  },
  secondaryButtonText: {
    color: Colors.tint,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  guestButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  guestButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
