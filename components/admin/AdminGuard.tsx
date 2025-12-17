import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { getJwtClaimString } from '@/lib/supabase/jwt';

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
  const mountedRef = useRef<boolean>(true);
  const redirectedRef = useRef<boolean>(false);

  type ReplaceArg = Parameters<ReturnType<typeof useRouter>['replace']>[0];

  const safeReplace = React.useCallback(
    (href: ReplaceArg) => {
      if (!mountedRef.current) return;
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      console.log('[AdminGuard] router.replace', { href });
      router.replace(href);
    },
    [router]
  );

  const check = React.useCallback(async () => {
    redirectedRef.current = false;
    if (mountedRef.current) setState({ status: 'checking' });
    console.log('[AdminGuard] checking session + jwt role');

    const { data, error } = await supabase.auth.getSession();
    console.log('[AdminGuard] auth.getSession result', {
      hasSession: Boolean(data.session),
      error: error?.message ?? null,
    });

    if (!mountedRef.current) return;

    const session = data.session;
    if (!session || error) {
      setState({ status: 'denied' });
      safeReplace('/auth/welcome');
      return;
    }

    const userId = session.user.id;
    const jwtRole = getJwtClaimString(session.access_token, 'role');

    console.log('[AdminGuard] jwt role check', {
      userId,
      jwtRole: jwtRole ?? null,
    });

    if (!mountedRef.current) return;

    if (jwtRole === 'admin') {
      setState({ status: 'allowed', userId });
      return;
    }

    setState({ status: 'denied' });
    safeReplace('/(tabs)/home');
  }, [safeReplace]);

  useEffect(() => {
    mountedRef.current = true;

    check().catch((e) => {
      console.error('[AdminGuard] unexpected error', e);
      if (mountedRef.current) setState({ status: 'error', message: 'Something went wrong. Please try again.' });
    });

    return () => {
      mountedRef.current = false;
    };
  }, [check]);

  return { state, retry: check };
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { state, retry } = useAdminGuard();

  const content = useMemo(() => {
    if (state.status === 'allowed') return children;

    if (state.status === 'denied') {
      return (
        <View style={styles.container} testID="admin-guard-denied">
          <Text style={styles.title}>Admin access required</Text>
          <Text style={styles.subtitle}>You don’t have permission to view this page.</Text>
          <Pressable
            testID="admin-guard-go-home"
            style={styles.retryBtn}
            onPress={() => {
              retry().catch((e: unknown) => {
                console.error('[AdminGuard] re-check error', e);
              });
            }}
          >
            <Text style={styles.retryText}>Re-check access</Text>
          </Pressable>
        </View>
      );
    }

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
