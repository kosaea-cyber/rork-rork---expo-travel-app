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

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

type AiMode = 'off' | 'auto_reply' | 'human_handoff';

type AiSettingsRow = {
  id?: string;
  key?: string | null; // قد لا تكون موجودة فعلياً بجدولك
  is_enabled: boolean | null;
  mode: AiMode | string | null;
  public_chat_enabled: boolean | null;
  private_chat_enabled: boolean | null;
  system_prompt: string | null; // موجود بجدولك
  prompts?: Record<string, string> | null; // إذا كان موجود (json/jsonb)
  updated_at?: string | null;
};

type UiState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'saving' }
  | { status: 'error'; message: string };

const DEFAULTS = {
  is_enabled: false,
  mode: 'off' as AiMode,
  public_chat_enabled: true,
  private_chat_enabled: true,
  prompts: {} as Record<string, string>,
};

const MODE_OPTIONS: { value: AiMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No automated behavior. Chat stays fully manual.' },
  { value: 'auto_reply', label: 'Auto reply', description: 'Send a system reply automatically (if enabled).' },
  { value: 'human_handoff', label: 'Human handoff', description: 'Queue for human follow-up (no auto replies).' },
];

function normalizeMode(input: unknown): AiMode {
  if (input === 'off' || input === 'auto_reply' || input === 'human_handoff') return input;
  return 'off';
}

function isMissingColumnError(msg: string | null | undefined) {
  const m = (msg ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('unknown column');
}

function boolFromPrompt(v: string | null | undefined): boolean {
  const x = (v ?? '').trim().toLowerCase();
  if (x === '0' || x === 'false' || x === 'off' || x === 'no') return false;
  if (x === '1' || x === 'true' || x === 'on' || x === 'yes') return true;
  return true;
}

async function fetchAiSettingsRow(): Promise<AiSettingsRow | null> {
  console.log('[admin/ai] fetch');

  // 1) محاولة key=default (إذا العمود موجود)
  const byKeyRes = await supabase.from('ai_settings').select('*').eq('key', 'default').maybeSingle();

  console.log('[admin/ai] select key=default', {
    hasData: Boolean(byKeyRes.data),
    error: byKeyRes.error?.message ?? null,
  });

  if (byKeyRes.error && isMissingColumnError(byKeyRes.error.message)) {
    // 2) fallback: أول صف
    console.log('[admin/ai] key column missing; fallback first row');
    const fallbackRes = await supabase
      .from('ai_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackRes.error) throw new Error(fallbackRes.error.message);
    return (fallbackRes.data as AiSettingsRow) ?? null;
  }

  if (byKeyRes.error) throw new Error(byKeyRes.error.message);
  return (byKeyRes.data as AiSettingsRow) ?? null;
}

export default function AdminAiSettingsPage() {
  const mountedRef = useRef(true);

  const [ui, setUi] = useState<UiState>({ status: 'loading' });

  const [isEnabled, setIsEnabled] = useState<boolean>(DEFAULTS.is_enabled);
  const [mode, setMode] = useState<AiMode>(DEFAULTS.mode);
  const [publicChatEnabled, setPublicChatEnabled] = useState<boolean>(DEFAULTS.public_chat_enabled);
  const [privateChatEnabled, setPrivateChatEnabled] = useState<boolean>(DEFAULTS.private_chat_enabled);

  // ✅ 3 لغات
  const [promptEn, setPromptEn] = useState<string>('');
  const [promptAr, setPromptAr] = useState<string>('');
  const [promptDe, setPromptDe] = useState<string>('');

  // realtime ضمن prompts (كما عندك)
  const [realtimeEnabled, setRealtimeEnabled] = useState<boolean>(true);

  const isBusy = ui.status === 'loading' || ui.status === 'saving';

  const load = useCallback(async () => {
    setUi({ status: 'loading' });

    try {
      const row = await fetchAiSettingsRow();
      if (!mountedRef.current) return;

      if (!row) {
        setIsEnabled(DEFAULTS.is_enabled);
        setMode(DEFAULTS.mode);
        setPublicChatEnabled(DEFAULTS.public_chat_enabled);
        setPrivateChatEnabled(DEFAULTS.private_chat_enabled);
        setPromptEn('');
        setPromptAr('');
        setPromptDe('');
        setRealtimeEnabled(true);
        setUi({ status: 'ready' });
        return;
      }

      const prompts = (row.prompts ?? {}) as Record<string, string>;

      // ✅ نقرأ من prompts أولاً، وإذا مش موجودة نعمل fallback على system_prompt للإنجليزي
      setPromptEn((prompts.en ?? row.system_prompt ?? '').toString());
      setPromptAr((prompts.ar ?? '').toString());
      setPromptDe((prompts.de ?? '').toString());

      setIsEnabled(Boolean(row.is_enabled));
      setMode(normalizeMode(row.mode));
      setPublicChatEnabled(Boolean(row.public_chat_enabled));
      setPrivateChatEnabled(Boolean(row.private_chat_enabled));

      setRealtimeEnabled(boolFromPrompt(prompts.__realtime_enabled));

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
      // ✅ نخزن اللغات داخل prompts
      const promptsPayload: Record<string, string> = {
        en: promptEn.trim(),
        ar: promptAr.trim(),
        de: promptDe.trim(),
        __realtime_enabled: realtimeEnabled ? '1' : '0',
      };

      // ✅ نخلي system_prompt = EN كـ fallback (لأن عمود system_prompt موجود)
      const payload: Omit<AiSettingsRow, 'id'> = {
        key: 'default', // إذا عمود key غير موجود رح يعطي خطأ → لكن upsert below يحاول onConflict key
        is_enabled: isEnabled,
        mode,
        public_chat_enabled: publicChatEnabled,
        private_chat_enabled: privateChatEnabled,
        system_prompt: promptsPayload.en.length ? promptsPayload.en : null,
        prompts: promptsPayload,
        updated_at: new Date().toISOString(),
      };

      console.log('[admin/ai] upserting ai_settings', {
        is_enabled: payload.is_enabled,
        mode: payload.mode,
        public_chat_enabled: payload.public_chat_enabled,
        private_chat_enabled: payload.private_chat_enabled,
        promptsKeys: Object.keys(promptsPayload),
      });

      // ✅ إذا key column غير موجود، هذا الـ upsert سيفشل.
      // لذلك: نجرب upsert على key، وإذا فشل بسبب العمود نجرب update/insert بدون key
      let res = await supabase.from('ai_settings').upsert(payload, { onConflict: 'key' }).select('*').maybeSingle();

      if (res.error && isMissingColumnError(res.error.message)) {
        console.log('[admin/ai] key missing on upsert; fallback to update/insert without key');

        // نحاول نجيب أول row ونحدثه، وإذا ما فيه ننشئ row جديدة (بدون key)
        const existing = await fetchAiSettingsRow();
        if (existing?.id) {
          res = await supabase
            .from('ai_settings')
            .update({
              is_enabled: payload.is_enabled,
              mode: payload.mode,
              public_chat_enabled: payload.public_chat_enabled,
              private_chat_enabled: payload.private_chat_enabled,
              system_prompt: payload.system_prompt,
              prompts: payload.prompts,
              updated_at: payload.updated_at,
            })
            .eq('id', existing.id)
            .select('*')
            .maybeSingle();
        } else {
          res = await supabase
            .from('ai_settings')
            .insert({
              is_enabled: payload.is_enabled,
              mode: payload.mode,
              public_chat_enabled: payload.public_chat_enabled,
              private_chat_enabled: payload.private_chat_enabled,
              system_prompt: payload.system_prompt,
              prompts: payload.prompts,
              updated_at: payload.updated_at,
            })
            .select('*')
            .maybeSingle();
        }
      }

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
  }, [isEnabled, mode, privateChatEnabled, publicChatEnabled, promptAr, promptDe, promptEn, realtimeEnabled]);

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
        <ActivityIndicator color={Colors.tint} />
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
              thumbColor={Platform.OS === 'android' ? Colors.background : undefined}
              trackColor={{ false: Colors.border, true: Colors.tint }}
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
          <Text style={styles.sectionTitle}>Chat delivery</Text>
          <Text style={styles.sectionSubtitle}>Realtime subscriptions can be disabled if they cause performance issues</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Realtime updates</Text>
              <Text style={styles.help}>If off, chat uses polling every ~7 seconds</Text>
            </View>
            <Switch
              testID="adminAi.realtimeEnabled"
              value={realtimeEnabled}
              onValueChange={setRealtimeEnabled}
              thumbColor={Platform.OS === 'android' ? Colors.background : undefined}
              trackColor={{ false: Colors.border, true: Colors.tint }}
              disabled={isBusy}
            />
          </View>
        </View>

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
              thumbColor={Platform.OS === 'android' ? Colors.background : undefined}
              trackColor={{ false: Colors.border, true: Colors.tint }}
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
              thumbColor={Platform.OS === 'android' ? Colors.background : undefined}
              trackColor={{ false: Colors.border, true: Colors.tint }}
              disabled={isBusy}
            />
          </View>
        </View>

        {/* ✅ 3 TextInputs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System prompt (per language)</Text>
          <Text style={styles.sectionSubtitle}>Saved into prompts.en / prompts.ar / prompts.de</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.langLabel}>English (EN)</Text>
          <TextInput
            testID="adminAi.promptEn"
            value={promptEn}
            onChangeText={setPromptEn}
            placeholder="e.g. Be concise, helpful, and confirm booking details."
            placeholderTextColor={Colors.textSecondary}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            editable={!isBusy}
          />

          <View style={{ height: 12 }} />

          <Text style={styles.langLabel}>Arabic (AR)</Text>
          <TextInput
            testID="adminAi.promptAr"
            value={promptAr}
            onChangeText={setPromptAr}
            placeholder="مثال: كن مختصرًا ومفيدًا وتأكد من تفاصيل الحجز قبل المتابعة."
            placeholderTextColor={Colors.textSecondary}
            style={[styles.textArea, styles.textAreaAr]}
            multiline
            textAlignVertical="top"
            editable={!isBusy}
          />

          <View style={{ height: 12 }} />

          <Text style={styles.langLabel}>German (DE)</Text>
          <TextInput
            testID="adminAi.promptDe"
            value={promptDe}
            onChangeText={setPromptDe}
            placeholder="z.B. Sei kurz, hilfreich und bestätige die Buchungsdetails."
            placeholderTextColor={Colors.textSecondary}
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
          {ui.status === 'saving' ? <ActivityIndicator color={Colors.background} /> : null}
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 24 },

  hero: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  heroSubtitle: { marginTop: 8, color: Colors.textSecondary, fontSize: 13, fontWeight: '700', lineHeight: 18 },

  sectionHeader: { marginTop: 18, marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtitle: { marginTop: 6, color: Colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '900' },
  help: { marginTop: 6, color: Colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  modeGrid: { gap: 10 },
  modeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  modeCardSelected: { borderColor: Colors.tint, backgroundColor: '#D4AF3715' },
  modeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: Colors.textSecondary },
  radioSelected: { borderColor: Colors.tint, backgroundColor: Colors.tint },
  modeTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  modeTitleSelected: { color: Colors.tint },
  modeDesc: { marginTop: 8, color: Colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  langLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },

  textArea: {
    minHeight: 120,
    maxHeight: 320,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },

  // ✅ RTL كامل للعربي
  textAreaAr: {
    textAlign: 'right',
    writingDirection: 'rtl',
    ...(Platform.OS === 'web' ? ({ direction: 'rtl' } as any) : null),
  },

  saveBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  saveText: { color: Colors.background, fontSize: 14, fontWeight: '900' },

  secondaryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: { color: Colors.text, fontSize: 13, fontWeight: '900' },

  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    gap: 12,
  },
  stateTitle: { color: Colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  stateText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
});
