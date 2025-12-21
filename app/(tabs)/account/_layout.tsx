import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import HeaderLogo from '@/components/HeaderLogo';

export default function AccountLayout() {
  const t = useI18nStore((state) => state.t);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.tint,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: Colors.background,
        },
        headerBackTitle: "", 
        headerRight: () => <HeaderLogo />,
      }}
    >
      <Stack.Screen name="index" options={{ title: t('tabAccount'), headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: t('myProfile') }} />
      <Stack.Screen name="settings" options={{ title: t('settings') }} />
      <Stack.Screen name="about" options={{ title: t('about') }} />
      <Stack.Screen name="terms" options={{ title: t('terms') }} />
      <Stack.Screen name="privacy" options={{ title: t('terms') }} />
      <Stack.Screen name="faq" options={{ title: t('faq') }} />
      <Stack.Screen name="blog/index" options={{ title: t('blog') }} />
      <Stack.Screen name="blog/[id]" options={{ title: '' }} />
    </Stack>
  );
}
