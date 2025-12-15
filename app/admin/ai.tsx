import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { Save, Sparkles } from 'lucide-react-native';

import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

type AiMode = 'off' | 'auto_reply' | 'human_handoff';

type AiSettingsRow = {
  id: string;
  is_enabled: boolean;
  mode: AiMode;
  public_chat_enabled: boolean;
  private_chat_enabled: boolean;
  system_prompt: string | null;
};

type UiState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'saving' }
  | { status: 'error'; message: string };

function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  Alert.alert('Success', message);
}

function normalizeMode(value: unknown): AiMode {
  if (value === 'off' || value === 'auto_reply' || value === 'human_handoff') return value;
  return 'off';
}

export default function AdminAiSettingsPage() {
  const [ui, setUi] = useState<UiState>({ status: 'loading' });
  const [rowId, setRowId] = useState<string | null>(null);

  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [mode, setMode] = useState<AiMode>('off');
  const [publicChatEnabled, setPublicChatEnabled] = useState<boolean>(true);
  const [privateChatEnabled, setPrivateChatEnabled] = useState<boolean>(true);
  const [systemPrompt, setSystemPrompt] = useState<string>('');

  const mountedRef = useRef<boolean>(true);

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      console.log('[admin/ai] load ai_settings');
      const res = await supabase.from('ai_settings').select('*').limit(1).maybeSingle();

      console.log('[admin/ai] select result', {
        hasRow: Boolean(res.data),
        error: res.error?.message ?? null,
      });

      if (res.error) throw new Error(res.error.message);

      let settings = res.data as Partial<AiSettingsRow> | null;

      if (!settings) {
        console.log('[admin/ai] no ai_settings row found; inserting defaults');

        const insertRes = await supabase
          .from('ai_settings')
          .insert({
            is_enabled: false,
            mode: 'off',
            public_chat_enabled: true,
            private_chat_enabled: true,
            system_prompt: '',
          })
          .select('*')
          .single();

        console.log('[admin/ai] insert default result', {
          hasRow: Boolean(insertRes.data),
          error: insertRes.error?.message ?? null,
        });

        if (insertRes.error) throw new Error(insertRes.error.message);
        settings = insertRes.data as Partial<AiSettingsRow>;
      }

      if (!mountedRef.current) return;

      const id = typeof settings.id === 'string' ? settings.id : null;
      setRowId(id);

      setIsEnabled(Boolean(settings.is_enabled));
      setMode(normalizeMode(settings.mode));
      setPublicChatEnabled(settings.public_chat_enabled ?? true);
      setPrivateChatEnabled(settings.private_chat_enabled ?? true);
      setSystemPrompt((settings.system_prompt ?? '') as string);

      setUi({ status: 'ready' });
    } catch (e) {
      console.error('[admin/ai] load failed', e);
      setUi({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load AI settings. Please try again.',
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const canSave = useMemo(() => ui.status !== 'loading' && ui.status !== 'saving', [ui.status]);

  const save = useCallback(async () => {
    if (!rowId) {
      Alert.alert('Error', 'AI settings row is missing an id. Please reload and try again.');
      return;
    }

    setUi({ status: 'saving' });

    try {
      const payload: Omit<AiSettingsRow, 'id'> = {
        is_enabled: isEnabled,
        mode,
        public_chat_enabled: publicChatEnabled,
        private_chat_enabled: privateChatEnabled,
        system_prompt: systemPrompt,
      };

      console.log('[admin/ai] saving ai_settings', { rowId, payload });

      const res = await supabase
        .from('ai_settings')
        .update(payload)
        .eq('id', rowId)
        .select('*')
        .single();

      console.log('[admin/ai] update result', {
        error: res.error?.message ?? null,
        hasRow: Boolean(res.data),
      });

      if (res.error) throw new Error(res.error.message);

      showToast('AI settings saved');
      setUi({ status: 'ready' });
    } catch (e) {
      console.error('[admin/ai] save failed', e);
      setUi({ status: 'ready' });
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save AI settings');
    }
  }, [isEnabled, mode, privateChatEnabled, publicChatEnabled, rowId, systemPrompt]);

  const header = useMemo(() => {
    return (
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Sparkles size={20} color={colors.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} testID="adminAi.title">
            AI Settings
          </Text>
          <Text style={styles.subtitle} testID="adminAi.subtitle">
            Control when AI can respond, and how it behaves in chat.
          </Text>
        </View>
      </View>
    );
  }, []);

  if (ui.status === 'loading') {
    return (
      <View style={styles.loadingWrap} testID="adminAi.loading">
        <ActivityIndicator color={colors.tint} />
        <Text style={styles.loadingText}>Loading AI settings…</Text>
      </View>
    );
  }

  if (ui.status === 'error') {
    return (
      <View style={styles.stateWrap} testID="adminAi.error">
        <Text style={styles.stateTitle}>Couldn’t load AI settings</Text>
        <Text style={styles.stateText}>{ui.message}</Text>
        <Pressable testID="adminAi.retry" style={styles.primaryBtn} onPress={load}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="adminAi.scroll">
      {header}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>AI Enabled</Text>
            <Text style={styles.rowHint}>Master switch for all AI chat behavior.</Text>
          </View>
          <Switch
            testID="adminAi.isEnabled"
            value={isEnabled}
            onValueChange={setIsEnabled}
            trackColor={{ false: '#233554', true: colors.tint }}
            thumbColor={Platform.OS === 'android' ? colors.background : undefined}
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Mode</Text>
        <View style={styles.segmented} testID="adminAi.mode.segmented">
          {(
            [
              { key: 'off' as const, label: 'Off' },
              { key: 'auto_reply' as const, label: 'Auto reply' },
              { key: 'human_handoff' as const, label: 'Human handoff' },
            ] satisfies { key: AiMode; label: string }[]
          ).map((opt) => {
            const selected = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                testID={`adminAi.mode.${opt.key}`}
                onPress={() => setMode(opt.key)}
                style={({ pressed }) => [
                  styles.segment,
                  selected && styles.segmentSelected,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.modeNote}>
          <Text style={styles.modeNoteText} testID="adminAi.mode.note">
            {mode === 'off'
              ? 'AI will never send messages.'
              : mode === 'auto_reply'
                ? 'AI may reply automatically when enabled.'
                : 'AI will assist in routing, but expects a human admin to reply.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Chat availability</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Public chat</Text>
            <Text style={styles.rowHint}>Controls AI behavior in the public chat widget.</Text>
          </View>
          <Switch
            testID="adminAi.publicChatEnabled"
            value={publicChatEnabled}
            onValueChange={setPublicChatEnabled}
            trackColor={{ false: '#233554', true: colors.tint }}
            thumbColor={Platform.OS === 'android' ? colors.background : undefined}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Private chat</Text>
            <Text style={styles.rowHint}>Controls AI behavior in customer↔admin private chats.</Text>
          </View>
          <Switch
            testID="adminAi.privateChatEnabled"
            value={privateChatEnabled}
            onValueChange={setPrivateChatEnabled}
            trackColor={{ false: '#233554', true: colors.tint }}
            thumbColor={Platform.OS === 'android' ? colors.background : undefined}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>System prompt</Text>
        <Text style={styles.helperText}>
          This prompt guides how the AI should behave (tone, policies, product knowledge).
        </Text>

        <TextInput
          testID="adminAi.systemPrompt"
          style={styles.textArea}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="You are a helpful assistant for our airport services..."
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
        />
      </View>

      <Pressable
        testID="adminAi.save"
        onPress={save}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveBtn,
          !canSave && { opacity: 0.6 },
          pressed && canSave && { transform: [{ scale: 0.99 }] },
        ]}
      >
        {ui.status === 'saving' ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <View style={styles.saveBtnContent}>
            <Save size={18} color={colors.background} />
            <Text style={styles.saveBtnText}>Save changes</Text>
          </View>
        )}
      </Pressable>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  hero: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#D4AF3722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  card: {
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  rowHint: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#0A192F',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.tint,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextSelected: {
    color: colors.background,
  },
  modeNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#112240',
  },
  modeNoteText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    backgroundColor: '#0A192F',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 10,
    padding: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
    gap: 10,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
});
