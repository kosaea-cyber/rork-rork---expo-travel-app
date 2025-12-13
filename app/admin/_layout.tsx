import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Colors from '@/constants/colors';
import HeaderLogo from '@/components/HeaderLogo';
import { supabase } from '@/lib/supabase/client';

type AdminGateState =
  | { status: 'checking' }
  | { status: 'allowed'; userId: string }
  | { status: 'denied' };

export default function AdminLayout() {
  const router = useRouter();
  const [gate, setGate] = useState<AdminGateState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      console.log('[admin/_layout] gate check: start');

      const { data, error } = await supabase.auth.getSession();
      console.log('[admin/_layout] auth.getSession result', {
        hasSession: Boolean(data.session),
        error: error?.message ?? null,
      });

      if (cancelled) return;

      const session = data.session;
      if (!session || error) {
        setGate({ status: 'denied' });
        router.replace('/auth/login');
        return;
      }

      const userId = session.user.id;

      const profileRes = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      console.log('[admin/_layout] profiles role check', {
        userId,
        role: profileRes.data?.role ?? null,
        error: profileRes.error?.message ?? null,
      });

      if (cancelled) return;

      if (profileRes.error) {
        setGate({ status: 'denied' });
        Alert.alert('Not authorized', 'Unable to verify admin access. Please try again.');
        router.replace('/(tabs)/home');
        return;
      }

      if (profileRes.data?.role === 'admin') {
        setGate({ status: 'allowed', userId });
        return;
      }

      setGate({ status: 'denied' });
      Alert.alert('Not authorized', 'You do not have access to the admin panel.');
      router.replace('/(tabs)/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (gate.status !== 'allowed') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator testID="admin-gate-loading" color={Colors.tint} />
      </View>
    );
  }

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
        headerRight: () => <HeaderLogo />
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="customers" options={{ title: 'Customers' }} />
      <Stack.Screen name="customer/[id]" options={{ title: 'Customer Profile' }} />
      <Stack.Screen name="messages" options={{ title: 'Messages' }} />
      <Stack.Screen name="message/[id]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="services" options={{ title: 'Manage Services' }} />
      <Stack.Screen name="packages" options={{ title: 'Manage Packages' }} />
      <Stack.Screen name="bookings" options={{ title: 'Manage Bookings' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking Details' }} />
      <Stack.Screen name="blogs" options={{ title: 'Manage Blogs' }} />
      <Stack.Screen name="blog/[id]" options={{ title: 'Edit Blog' }} />
      <Stack.Screen name="content" options={{ title: 'Manage Content' }} />
      <Stack.Screen name="hero" options={{ title: 'Hero Slider' }} />
      <Stack.Screen name="images" options={{ title: 'App Images' }} />
    </Stack>
  );
}
