import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import HeaderLogo from '@/components/HeaderLogo';

type IconName = keyof typeof Ionicons.glyphMap;

export default function AccountScreen() {
  const t = useI18nStore((state) => state.t);
  const router = useRouter();
  const { user, isGuest, logout, isAdmin } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to logout?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/welcome');
        },
      },
    ]);
  };

  const menuItems: {
    title: string;
    icon: IconName;
    route: string;
    authRequired: boolean;
  }[] = [
    {
      title: t('myProfile'),
      icon: 'person-outline',
      route: '/(tabs)/account/profile',
      authRequired: true,
    },
    {
      title: t('myMessages'),
      icon: 'chatbubble-ellipses-outline',
      route: '/chat',
      authRequired: true,
    },
    {
      title: t('settings'),
      icon: 'settings-outline',
      route: '/(tabs)/account/settings',
      authRequired: false,
    },
    {
      title: t('about'),
      icon: 'information-circle-outline',
      route: '/(tabs)/account/about',
      authRequired: false,
    },
    {
      title: t('faq'),
      icon: 'help-circle-outline',
      route: '/(tabs)/account/faq',
      authRequired: false,
    },
    {
      title: t('blog'),
      icon: 'document-text-outline',
      route: '/(tabs)/account/blog',
      authRequired: false,
    },
  ];

  const handlePress = (item: typeof menuItems[number]) => {
    if (item.authRequired && (isGuest || !user)) {
      router.push('/auth/login');
    } else {
      router.push(item.route as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabAccount')}</Text>
        <HeaderLogo />
      </View>

      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user ? user.name.charAt(0).toUpperCase() : 'G'}
          </Text>
        </View>
        <Text style={styles.userName}>{user ? user.name : 'Guest'}</Text>
        <Text style={styles.userEmail}>
          {user ? user.email : 'Welcome to Ruwasi Elite'}
        </Text>

        {!user && isGuest && (
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>{t('login')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => handlePress(item)}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={24} color={Colors.tint} />
            </View>
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}

        {user && isAdmin && (
          <TouchableOpacity
            style={[
              styles.menuItem,
              { borderColor: Colors.tint, backgroundColor: Colors.tint + '10' },
            ]}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="grid-outline"
                size={24}
                color={Colors.tint}
              />
            </View>
            <Text
              style={[
                styles.menuText,
                { color: Colors.tint, fontWeight: 'bold' },
              ]}
            >
              Admin Dashboard
            </Text>
          </TouchableOpacity>
        )}

        {user && (
          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={handleLogout}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="log-out-outline"
                size={24}
                color={Colors.error}
              />
            </View>
            <Text style={[styles.menuText, { color: Colors.error }]}>
              {t('logout')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.tint,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loginButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
  menuContainer: {
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuIcon: {
    marginRight: 16,
    width: 32,
    alignItems: 'center',
  },
  menuText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  logoutItem: {
    borderColor: Colors.error + '50',
    backgroundColor: Colors.error + '10',
    marginTop: 20,
  },
});
