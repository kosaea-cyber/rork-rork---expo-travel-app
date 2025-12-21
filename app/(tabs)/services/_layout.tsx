import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import HeaderLogo from '@/components/HeaderLogo';

export default function ServicesLayout() {
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
      <Stack.Screen name="index" options={{ title: t('tabServices'), headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="packages/index" options={{ title: t('viewPackages') }} />
      <Stack.Screen name="package/[id]" options={{ title: '' }} />
      <Stack.Screen name="book" options={{ title: t('requestBooking') }} />
    </Stack>
  );
}
