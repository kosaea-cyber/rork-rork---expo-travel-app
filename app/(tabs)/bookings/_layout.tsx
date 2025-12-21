import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import HeaderLogo from '@/components/HeaderLogo';

export default function BookingsLayout() {
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
      <Stack.Screen name="index" options={{ title: t('tabBookings'), headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: t('myBookings') }} />
    </Stack>
  );
}
