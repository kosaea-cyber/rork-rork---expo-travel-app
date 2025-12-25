import { supabase } from '@/lib/supabase/client';
import type { Language } from '@/store/i18nStore';

export type AiSettingsMode = 'off' | 'auto_reply' | 'human_handoff';

export type AiSettings = {
  enabled: boolean;
  mode: AiSettingsMode;
  allow_public: boolean;
  allow_private: boolean;

  // ما عندك عمود بالـ DB لهذا حالياً، نخليه true افتراضياً
  realtime_enabled: boolean;

  // prompts لكل لغة
  prompts: Record<string, string>;
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  mode: 'off',
  allow_public: true,
  allow_private: true,
  realtime_enabled: true,
  prompts: {},
};

type AiSettingsRow = {
  id: string;
  is_enabled: boolean | null;
  mode: string | null;
  public_chat_enabled: boolean | null;
  private_chat_enabled: boolean | null;

  // أعمدة اللغات الجديدة
  system_prompt_en: string | null;
  system_prompt_ar: string | null;
  system_prompt_de: string | null;

  // القديم (لو موجود)
  system_prompt?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type AiSettingsCacheState = {
  updatedAtMs: number;
  value: AiSettings;
};

const CACHE_TTL_MS = 60_000;

let cache: AiSettingsCacheState | null = null;
let inFlight: Promise<AiSettings> | null = null;

function isCacheValid(state: AiSettingsCacheState | null): state is AiSettingsCacheState {
  if (!state) return false;
  return Date.now() - state.updatedAtMs < CACHE_TTL_MS;
}

function normalizeMode(input: unknown): AiSettingsMode {
  if (input === 'off' || input === 'auto_reply' || input === 'human_handoff') return input;
  return 'off';
}

function normalizeLanguage(input: unknown): Language {
  if (input === 'en' || input === 'ar' || input === 'de') return input;
  return 'en';
}

function safeText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeAiSettingsRow(row: AiSettingsRow): AiSettings {
  const enabled = typeof row.is_enabled === 'boolean' ? row.is_enabled : DEFAULT_AI_SETTINGS.enabled;
  const allow_public =
    typeof row.public_chat_enabled === 'boolean' ? row.public_chat_enabled : DEFAULT_AI_SETTINGS.allow_public;
  const allow_private =
    typeof row.private_chat_enabled === 'boolean' ? row.private_chat_enabled : DEFAULT_AI_SETTINGS.allow_private;

  // نقرأ لكل لغة، وإذا فاضي نرجع لـ system_prompt القديم، وإذا فاضي نعمل fallback للإنجليزي
  const legacy = safeText(row.system_prompt);

  const en = safeText(row.system_prompt_en) || legacy;
  const ar = safeText(row.system_prompt_ar) || legacy || en;
  const de = safeText(row.system_prompt_de) || legacy || en;

  const prompts: Record<string, string> = {};
  if (en) prompts.en = en;
  if (ar) prompts.ar = ar;
  if (de) prompts.de = de;

  return {
    enabled,
    mode: normalizeMode(row.mode),
    allow_public,
    allow_private,
    realtime_enabled: DEFAULT_AI_SETTINGS.realtime_enabled,
    prompts,
  };
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    console.log('[ai][settings] getAiSettings');

    const res = await supabase
      .from('ai_settings')
      .select(
        'id,is_enabled,mode,public_chat_enabled,private_chat_enabled,system_prompt_en,system_prompt_ar,system_prompt_de,system_prompt,created_at,updated_at'
      )
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<AiSettingsRow>();

    if (res.error) {
      console.error('[ai][settings] load failed', {
        message: res.error.message,
        code: (res.error as { code?: string }).code ?? null,
      });
      return DEFAULT_AI_SETTINGS;
    }

    if (!res.data) return DEFAULT_AI_SETTINGS;
    return normalizeAiSettingsRow(res.data);
  } catch (e) {
    console.error('[ai][settings] unexpected error', e);
    return DEFAULT_AI_SETTINGS;
  }
}

export async function getAiSettingsCached(): Promise<AiSettings> {
  try {
    if (isCacheValid(cache)) return cache.value;

    if (inFlight) return await inFlight;

    inFlight = (async () => {
      const value = await getAiSettings();
      cache = { updatedAtMs: Date.now(), value };
      return value;
    })();

    return await inFlight;
  } catch {
    return DEFAULT_AI_SETTINGS;
  } finally {
    inFlight = null;
  }
}

export function pickPrompt(settings: AiSettings, lang: Language): string {
  const normalized = normalizeLanguage(lang);
  return settings.prompts?.[normalized] ?? settings.prompts?.en ?? '';
}
