import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { user, isGuest } = useAuthStore();
  
  if (user || isGuest) {
    return <Redirect href="/(tabs)/home" />;
  }
  
  return <Redirect href="/auth/welcome" />;
}
