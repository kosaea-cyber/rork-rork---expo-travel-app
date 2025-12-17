import { supabase } from '@/lib/supabase/client';

import type { Language } from '@/store/i18nStore';

export type AiSettingsMode = 'off' | 'auto_reply' | 'human_handoff';

export type AiSettings = {
  enabled: boolean;
  mode: AiSettingsMode;
  allow_public: boolean;
  allow_private: boolean;
  prompts: Record<string, string>;
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  mode: 'off',
  allow_public: true,
  allow_private: true,
  prompts: {},
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

function normalizePrompts(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const rec = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of Object.keys(rec)) {
    const v = rec[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function normalizeAiSettingsRow(row: unknown): AiSettings {
  const r = row as Record<string, unknown>;

  const enabledRaw = r.enabled ?? r.is_enabled;
  const allowPublicRaw = r.allow_public ?? r.public_chat_enabled;
  const allowPrivateRaw = r.allow_private ?? r.private_chat_enabled;

  return {
    enabled: typeof enabledRaw === 'boolean' ? enabledRaw : DEFAULT_AI_SETTINGS.enabled,
    mode: normalizeMode(r.mode),
    allow_public: typeof allowPublicRaw === 'boolean' ? allowPublicRaw : DEFAULT_AI_SETTINGS.allow_public,
    allow_private: typeof allowPrivateRaw === 'boolean' ? allowPrivateRaw : DEFAULT_AI_SETTINGS.allow_private,
    prompts: normalizePrompts(r.prompts),
  };
}

function normalizeLanguage(input: unknown): Language {
  if (input === 'en' || input === 'ar' || input === 'de') return input;
  return 'en';
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    console.log('[ai][settings] getAiSettings');

    const primary = await supabase
      .from('ai_settings')
      .select('*')
      .eq('key', 'default')
      .maybeSingle();

    if (!primary.error) {
      return primary.data ? normalizeAiSettingsRow(primary.data) : DEFAULT_AI_SETTINGS;
    }

    console.error('[ai][settings] primary load failed; falling back', {
      message: primary.error.message,
      code: (primary.error as { code?: string }).code ?? null,
    });

    const fallback = await supabase.from('ai_settings').select('*').limit(1).maybeSingle();

    if (fallback.error) {
      console.error('[ai][settings] fallback load failed', {
        message: fallback.error.message,
        code: (fallback.error as { code?: string }).code ?? null,
      });
      return DEFAULT_AI_SETTINGS;
    }

    return fallback.data ? normalizeAiSettingsRow(fallback.data) : DEFAULT_AI_SETTINGS;
  } catch (e) {
    console.error('[ai][settings] unexpected error', e);
    return DEFAULT_AI_SETTINGS;
  }
}

export async function getAiSettingsCached(): Promise<AiSettings> {
  try {
    if (isCacheValid(cache)) {
      console.log('[ai][settings] cache hit', { ageMs: Date.now() - cache.updatedAtMs });
      return cache.value;
    }

    if (inFlight) {
      console.log('[ai][settings] awaiting in-flight request');
      return await inFlight;
    }

    inFlight = (async () => {
      const value = await getAiSettings();
      cache = { updatedAtMs: Date.now(), value };
      return value;
    })();

    return await inFlight;
  } catch (e) {
    console.error('[ai][settings] cache wrapper unexpected error', e);
    return DEFAULT_AI_SETTINGS;
  } finally {
    inFlight = null;
  }
}

export function pickPrompt(settings: AiSettings, lang: Language): string {
  const normalized = normalizeLanguage(lang);
  return settings.prompts?.[normalized] ?? settings.prompts?.en ?? '';
}
