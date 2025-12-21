import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { log } from '@/lib/utils/log';

type CheckState = {
  status: 'idle' | 'running' | 'ok' | 'error';
  detail: string | null;
};

function statusColor(status: CheckState['status']) {
  if (status === 'ok') return '#16a34a';
  if (status === 'error') return '#dc2626';
  if (status === 'running') return '#f59e0b';
  return Colors.textSecondary;
}

export default function HealthCheckScreen() {
  const authMutation = useMutation({
    mutationFn: async () => {
      log.info('[health] auth.getSession start');
      const res = await supabase.auth.getSession();
      if (res.error) throw res.error;
      const hasSession = Boolean(res.data.session);
      return { hasSession, userId: res.data.session?.user?.id ?? null };
    },
  });

  const heroMutation = useMutation({
    mutationFn: async () => {
      log.info('[health] hero_slides select start');
      const res = await supabase.from('hero_slides').select('id').limit(1);
      if (res.error) throw res.error;
      return { rows: res.data?.length ?? 0 };
    },
  });

  const storageMutation = useMutation({
    mutationFn: async () => {
      log.info('[health] storage public url test start');
      const bucket = 'app-media';
      const path = 'healthcheck.txt';
      const res = supabase.storage.from(bucket).getPublicUrl(path);
      const url = res.data.publicUrl;
      if (!url) throw new Error('No publicUrl returned');
      return { url };
    },
  });

  const checks = useMemo(() => {
    const authState: CheckState = authMutation.isPending
      ? { status: 'running', detail: null }
      : authMutation.isError
        ? { status: 'error', detail: String(authMutation.error) }
        : authMutation.isSuccess
          ? {
              status: 'ok',
              detail: `session=${String(authMutation.data.hasSession)} user=${authMutation.data.userId ?? 'null'}`,
            }
          : { status: 'idle', detail: null };

    const heroState: CheckState = heroMutation.isPending
      ? { status: 'running', detail: null }
      : heroMutation.isError
        ? { status: 'error', detail: String(heroMutation.error) }
        : heroMutation.isSuccess
          ? { status: 'ok', detail: `rows=${String(heroMutation.data.rows)}` }
          : { status: 'idle', detail: null };

    const storageState: CheckState = storageMutation.isPending
      ? { status: 'running', detail: null }
      : storageMutation.isError
        ? { status: 'error', detail: String(storageMutation.error) }
        : storageMutation.isSuccess
          ? { status: 'ok', detail: storageMutation.data.url }
          : { status: 'idle', detail: null };

    return [
      { key: 'auth', title: 'Auth session', state: authState, run: authMutation.mutateAsync },
      { key: 'hero', title: 'DB read (hero_slides)', state: heroState, run: heroMutation.mutateAsync },
      { key: 'storage', title: 'Storage public URL', state: storageState, run: storageMutation.mutateAsync },
    ] as const;
  }, [
    authMutation.data,
    authMutation.error,
    authMutation.isError,
    authMutation.isPending,
    authMutation.isSuccess,
    authMutation.mutateAsync,
    heroMutation.data,
    heroMutation.error,
    heroMutation.isError,
    heroMutation.isPending,
    heroMutation.isSuccess,
    heroMutation.mutateAsync,
    storageMutation.data,
    storageMutation.error,
    storageMutation.isError,
    storageMutation.isPending,
    storageMutation.isSuccess,
    storageMutation.mutateAsync,
  ]);

  const runAll = useCallback(async () => {
    log.info('[health] run all');
    for (const c of checks) {
      try {
        await c.run();
      } catch (e) {
        log.warn('[health] check failed', { key: c.key, error: String(e) });
      }
    }
  }, [checks]);

  return (
    <View style={styles.container} testID="healthCheckRoot">
      <Stack.Screen options={{ title: 'Health Check' }} />

      <ScrollView contentContainerStyle={styles.content} testID="healthCheckScroll">
        <View style={styles.hero}>
          <Text style={styles.title} testID="healthCheckTitle">Diagnostics</Text>
          <Text style={styles.subtitle} testID="healthCheckSubtitle">
            Runs quick production-safe checks (no writes).
          </Text>

          <TouchableOpacity style={styles.runAllButton} onPress={runAll} testID="healthCheckRunAll">
            <Text style={styles.runAllText}>Run all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {checks.map((c, idx) => (
            <View key={c.key}>
              <View style={styles.row} testID={`healthCheckRow-${c.key}`}>
                <View style={styles.rowLeft}>
                  <View
                    style={[styles.dot, { backgroundColor: statusColor(c.state.status) }]}
                    testID={`healthCheckDot-${c.key}`}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} testID={`healthCheckRowTitle-${c.key}`}>
                      {c.title}
                    </Text>
                    {c.state.detail ? (
                      <Text style={styles.rowDetail} testID={`healthCheckRowDetail-${c.key}`}>
                        {c.state.detail}
                      </Text>
                    ) : (
                      <Text style={styles.rowDetailMuted} testID={`healthCheckRowDetailMuted-${c.key}`}>
                        {c.state.status === 'idle' ? 'Not run yet' : c.state.status}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.smallButton, c.state.status === 'running' ? styles.smallButtonDisabled : null]}
                  disabled={c.state.status === 'running'}
                  onPress={() => c.run()}
                  testID={`healthCheckRun-${c.key}`}
                >
                  <Text style={styles.smallButtonText}>Run</Text>
                </TouchableOpacity>
              </View>

              {idx !== checks.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  hero: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  runAllButton: {
    marginTop: 12,
    backgroundColor: Colors.tint,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  runAllText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rowDetail: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  rowDetailMuted: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
    opacity: 0.8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smallButtonDisabled: {
    opacity: 0.6,
  },
  smallButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 14,
  },
});
