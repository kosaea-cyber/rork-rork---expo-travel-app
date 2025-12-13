import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import Colors from '@/constants/colors';
import HeaderLogo from '@/components/HeaderLogo';
import { useProfileStore } from '@/store/profileStore';

export default function AdminLayout() {
  const role = useProfileStore((s) => s.role);
  const router = useRouter();

  useEffect(() => {
    if (role !== 'admin') {
      router.replace('/auth/login');
    }
  }, [role, router]);

  if (role !== 'admin') return null;

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
