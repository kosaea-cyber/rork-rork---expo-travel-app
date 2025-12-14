import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

export type AdminGuardState =
  | { status: 'checking' }
  | { status: 'allowed'; userId: string }
  | { status: 'denied' }
  | { status: 'error'; message: string };

type AdminGuardProps = {
  children: React.ReactNode;
};

export function useAdminGuard(): { state: AdminGuardState; retry: () => Promise<void> } {
  const router = useRouter();
  const [state, setState] = useState<AdminGuardState>({ status: 'checking' });

  const check = React.useCallback(async () => {
    setState({ status: 'checking' });
    console.log('[AdminGuard] checking session + role');

    const { data, error } = await supabase.auth.getSession();
    console.log('[AdminGuard] auth.getSession result', {
      hasSession: Boolean(data.session),
      error: error?.message ?? null,
    });

    const session = data.session;
    if (!session || error) {
      setState({ status: 'denied' });
      router.replace('/auth/login');
      return;
    }

    const userId = session.user.id;

    const profileRes = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();

    console.log('[AdminGuard] profiles role check', {
      userId,
      role: profileRes.data?.role ?? null,
      error: profileRes.error?.message ?? null,
    });

    if (profileRes.error) {
      setState({ status: 'error', message: 'Unable to verify admin access. Please try again.' });
      return;
    }

    if (profileRes.data?.role === 'admin') {
      setState({ status: 'allowed', userId });
      return;
    }

    setState({ status: 'denied' });
    router.replace('/(tabs)/home');
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    check()
      .catch((e) => {
        console.error('[AdminGuard] unexpected error', e);
        if (!cancelled) setState({ status: 'error', message: 'Something went wrong. Please try again.' });
      });

    return () => {
      cancelled = true;
    };
  }, [check]);

  return { state, retry: check };
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { state, retry } = useAdminGuard();

  const content = useMemo(() => {
    if (state.status === 'allowed') return children;

    if (state.status === 'error') {
      return (
        <View style={styles.container} testID="admin-guard-error">
          <Text style={styles.title}>Couldn’t open admin</Text>
          <Text style={styles.subtitle}>{state.message}</Text>
          <Pressable
            testID="admin-guard-retry"
            style={styles.retryBtn}
            onPress={() => {
              retry().catch((e: unknown) => {
                console.error('[AdminGuard] retry error', e);
              });
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container} testID="admin-guard-loading">
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }, [children, retry, state]);

  return <>{content}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.tint,
    justifyContent: 'center',
  },
  retryText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
});
