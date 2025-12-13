import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

export type AdminGuardState =
  | { status: 'checking' }
  | { status: 'allowed'; userId: string }
  | { status: 'denied' };

type AdminGuardProps = {
  children: React.ReactNode;
};

export function useAdminGuard(): AdminGuardState {
  const router = useRouter();
  const [state, setState] = useState<AdminGuardState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      console.log('[AdminGuard] checking session + role');

      const { data, error } = await supabase.auth.getSession();
      console.log('[AdminGuard] auth.getSession result', {
        hasSession: Boolean(data.session),
        error: error?.message ?? null,
      });

      if (cancelled) return;

      const session = data.session;
      if (!session || error) {
        setState({ status: 'denied' });
        router.replace('/auth/login');
        return;
      }

      const userId = session.user.id;

      const profileRes = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      console.log('[AdminGuard] profiles role check', {
        userId,
        role: profileRes.data?.role ?? null,
        error: profileRes.error?.message ?? null,
      });

      if (cancelled) return;

      if (profileRes.error) {
        setState({ status: 'denied' });
        Alert.alert('Not authorized', 'Unable to verify admin access. Please try again.');
        router.replace('/(tabs)/home');
        return;
      }

      if (profileRes.data?.role === 'admin') {
        setState({ status: 'allowed', userId });
        return;
      }

      setState({ status: 'denied' });
      Alert.alert('Not authorized', 'You do not have access to the admin panel.');
      router.replace('/(tabs)/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const state = useAdminGuard();

  const content = useMemo(() => {
    if (state.status === 'allowed') return children;

    return (
      <View style={styles.container} testID="admin-guard-loading">
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }, [children, state.status]);

  return <>{content}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
