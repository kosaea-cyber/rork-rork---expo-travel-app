import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

type AiMode = 'off' | 'auto_reply' | 'human_handoff';

type AiSettingsRow = {
  id?: string;
  key: string;
  is_enabled: boolean;
  mode: AiMode;
  public_chat_enabled: boolean;
  private_chat_enabled: boolean;
  system_prompt: string | null;
  updated_at?: string | null;
};

type UiState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'saving' }
  | { status: 'error'; message: string };

const DEFAULT_SETTINGS: Omit<AiSettingsRow, 'id' | 'updated_at'> = {
  key: 'default',
  is_enabled: false,
  mode: 'off',
  public_chat_enabled: true,
  private_chat_enabled: true,
  system_prompt: null,
};

const MODE_OPTIONS: { value: AiMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No automated behavior. Chat stays fully manual.' },
  { value: 'auto_reply', label: 'Auto reply', description: 'Send a system reply automatically (if enabled).' },
  { value: 'human_handoff', label: 'Human handoff', description: 'Queue for human follow-up (no auto replies).' },
];

async function fetchAiSettingsDefaultKey(): Promise<AiSettingsRow | null> {
  console.log('[admin/ai] fetchAiSettingsDefaultKey');

  const existingRes = await supabase
    .from('ai_settings')
    .select('*')
    .eq('key', 'default')
    .maybeSingle();

  console.log('[admin/ai] select ai_settings key=default result', {
    hasData: Boolean(existingRes.data),
    error: existingRes.error?.message ?? null,
  });

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

  if (!existingRes.data) return null;

  const row = existingRes.data as AiSettingsRow;
  return {
    id: row.id,
    key: row.key ?? 'default',
    is_enabled: Boolean(row.is_enabled),
    mode: (row.mode ?? 'off') as AiMode,
    public_chat_enabled: Boolean(row.public_chat_enabled),
    private_chat_enabled: Boolean(row.private_chat_enabled),
    system_prompt: row.system_prompt ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export default function AdminAiSettingsPage() {
  const mountedRef = useRef<boolean>(true);

  const [ui, setUi] = useState<UiState>({ status: 'loading' });

  const [isEnabled, setIsEnabled] = useState<boolean>(DEFAULT_SETTINGS.is_enabled);
  const [mode, setMode] = useState<AiMode>(DEFAULT_SETTINGS.mode);
  const [publicChatEnabled, setPublicChatEnabled] = useState<boolean>(DEFAULT_SETTINGS.public_chat_enabled);
  const [privateChatEnabled, setPrivateChatEnabled] = useState<boolean>(DEFAULT_SETTINGS.private_chat_enabled);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SETTINGS.system_prompt ?? '');

  const isBusy = ui.status === 'loading' || ui.status === 'saving';

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      const s = await fetchAiSettingsDefaultKey();
      if (!mountedRef.current) return;

      if (!s) {
        console.log('[admin/ai] no ai_settings row for key=default; using local defaults');
        setIsEnabled(DEFAULT_SETTINGS.is_enabled);
        setMode(DEFAULT_SETTINGS.mode);
        setPublicChatEnabled(DEFAULT_SETTINGS.public_chat_enabled);
        setPrivateChatEnabled(DEFAULT_SETTINGS.private_chat_enabled);
        setSystemPrompt(DEFAULT_SETTINGS.system_prompt ?? '');
        setUi({ status: 'ready' });
        return;
      }

      setIsEnabled(s.is_enabled);
      setMode(s.mode);
      setPublicChatEnabled(s.public_chat_enabled);
      setPrivateChatEnabled(s.private_chat_enabled);
      setSystemPrompt(s.system_prompt ?? '');
      setUi({ status: 'ready' });
    } catch (e) {
      console.error('[admin/ai] load failed', e);
      if (!mountedRef.current) return;
      setUi({ status: 'error', message: 'Failed to load AI settings. Please try again.' });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const onSave = useCallback(async () => {
    setUi({ status: 'saving' });

    try {
      const payload: Omit<AiSettingsRow, 'id'> = {
        key: 'default',
        is_enabled: isEnabled,
        mode,
        public_chat_enabled: publicChatEnabled,
        private_chat_enabled: privateChatEnabled,
        system_prompt: systemPrompt.trim().length > 0 ? systemPrompt : null,
        updated_at: new Date().toISOString(),
      };

      console.log('[admin/ai] upserting ai_settings', {
        key: payload.key,
        is_enabled: payload.is_enabled,
        mode: payload.mode,
        public_chat_enabled: payload.public_chat_enabled,
        private_chat_enabled: payload.private_chat_enabled,
        system_prompt_len: (payload.system_prompt ?? '').length,
        updated_at: payload.updated_at,
      });

      const res = await supabase
        .from('ai_settings')
        .upsert(payload, { onConflict: 'key' })
        .select('*')
        .maybeSingle();

      console.log('[admin/ai] upsert result', {
        ok: Boolean(res.data) && !res.error,
        error: res.error?.message ?? null,
      });

      if (res.error) {
        setUi({ status: 'error', message: res.error.message });
        return;
      }


      setUi({ status: 'ready' });
      Alert.alert('Saved', 'AI settings updated successfully.');
    } catch (e) {
      console.error('[admin/ai] save failed', e);
      setUi({ status: 'error', message: 'Failed to save. Please try again.' });
    }
  }, [isEnabled, mode, privateChatEnabled, publicChatEnabled, systemPrompt]);

  const modeCards = useMemo(() => {
    return MODE_OPTIONS.map((opt) => {
      const selected = opt.value === mode;
      return (
        <Pressable
          key={opt.value}
          testID={`adminAi.mode.${opt.value}`}
          disabled={isBusy}
          onPress={() => setMode(opt.value)}
          style={({ pressed }) => [
            styles.modeCard,
            selected && styles.modeCardSelected,
            pressed && !isBusy ? { opacity: 0.9 } : null,
          ]}
        >
          <View style={styles.modeCardTop}>
            <View style={[styles.radio, selected && styles.radioSelected]} />
            <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{opt.label}</Text>
          </View>
          <Text style={styles.modeDesc}>{opt.description}</Text>
        </Pressable>
      );
    });
  }, [isBusy, mode]);

  if (ui.status === 'loading') {
    return (
      <View style={styles.stateWrap} testID="adminAi.loading">
        <Stack.Screen options={{ title: 'AI Settings' }} />
        <ActivityIndicator color={colors.tint} />
        <Text style={styles.stateTitle}>Loading AI settings…</Text>
      </View>
    );
  }

  if (ui.status === 'error') {
    return (
      <View style={styles.stateWrap} testID="adminAi.error">
        <Stack.Screen options={{ title: 'AI Settings' }} />
        <Text style={styles.stateTitle}>Couldn’t load AI settings</Text>
        <Text style={styles.stateText}>{ui.message}</Text>
        <Pressable testID="adminAi.retry" style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: 'AI Settings' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>AI behavior for chat</Text>
          <Text style={styles.heroSubtitle}>
            Configure whether the assistant is enabled and how it behaves for public and private conversations.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Enabled</Text>
              <Text style={styles.help}>Master switch for all AI behavior</Text>
            </View>
            <Switch
              testID="adminAi.isEnabled"
              value={isEnabled}
              onValueChange={setIsEnabled}
              thumbColor={Platform.OS === 'android' ? colors.background : undefined}
              trackColor={{ false: colors.border, true: colors.tint }}
              disabled={isBusy}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mode</Text>
          <Text style={styles.sectionSubtitle}>Choose the default behavior when AI is enabled</Text>
        </View>

        <View style={styles.modeGrid}>{modeCards}</View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Allowed chats</Text>
          <Text style={styles.sectionSubtitle}>Limit AI behavior to specific chat types</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Public chat</Text>
              <Text style={styles.help}>Home widget / guest messages</Text>
            </View>
            <Switch
              testID="adminAi.publicChatEnabled"
              value={publicChatEnabled}
              onValueChange={setPublicChatEnabled}
              thumbColor={Platform.OS === 'android' ? colors.background : undefined}
              trackColor={{ false: colors.border, true: colors.tint }}
              disabled={isBusy}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Private chat</Text>
              <Text style={styles.help}>Signed-in customer ↔ admin</Text>
            </View>
            <Switch
              testID="adminAi.privateChatEnabled"
              value={privateChatEnabled}
              onValueChange={setPrivateChatEnabled}
              thumbColor={Platform.OS === 'android' ? colors.background : undefined}
              trackColor={{ false: colors.border, true: colors.tint }}
              disabled={isBusy}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System prompt</Text>
          <Text style={styles.sectionSubtitle}>A short guide for the assistant’s tone and behavior</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            testID="adminAi.systemPrompt"
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="e.g. Be concise, polite, and ask clarifying questions before booking."
            placeholderTextColor={colors.textSecondary}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            editable={!isBusy}
          />
        </View>

        <Pressable
          testID="adminAi.save"
          disabled={isBusy}
          onPress={onSave}
          style={({ pressed }) => [styles.saveBtn, pressed && !isBusy ? { opacity: 0.9 } : null]}
        >
          {ui.status === 'saving' ? <ActivityIndicator color={colors.background} /> : null}
          <Text style={styles.saveText}>{ui.status === 'saving' ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>

        <Pressable testID="adminAi.reload" disabled={isBusy} onPress={load} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Reload</Text>
        </Pressable>

        <View style={{ height: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
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
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  help: {
    marginTop: 6,
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
  modeGrid: {
    gap: 10,
  },
  modeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  modeCardSelected: {
    borderColor: colors.tint,
    backgroundColor: '#D4AF3715',
  },
  modeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  radioSelected: {
    borderColor: colors.tint,
    backgroundColor: colors.tint,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  modeTitleSelected: {
    color: colors.tint,
  },
  modeDesc: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  textArea: {
    minHeight: 140,
    maxHeight: 320,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  saveBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  saveText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
    gap: 12,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 15,
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
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
});
