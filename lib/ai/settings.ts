import { supabase } from '@/lib/supabase/client';
import type { Language } from '@/store/i18nStore';

export type AiSettingsMode = 'off' | 'auto_reply' | 'human_handoff';

export type AiSettings = {
  enabled: boolean;
  mode: AiSettingsMode;
  allow_public: boolean;
  allow_private: boolean;
  realtime_enabled: boolean;
  prompts: Record<string, string>;
  system_prompt?: string;
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  mode: 'off',
  allow_public: true,
  allow_private: true,
  realtime_enabled: true,
  prompts: {},
  system_prompt: '',
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

/**
 * Table schema (confirmed):
 * ai_settings:
 *  - is_enabled (bool)
 *  - mode (text)
 *  - public_chat_enabled (bool)
 *  - private_chat_enabled (bool)
 *  - system_prompt (text, nullable)
 *  - created_at / updated_at
 *
 * No "key", no "prompts", no "realtime_enabled".
 */
function normalizeAiSettingsRow(row: unknown): AiSettings {
  const r = row as Record<string, unknown>;

  const enabledRaw = r.is_enabled ?? r.enabled;
  const allowPublicRaw = r.public_chat_enabled ?? r.allow_public ?? r.public_chat;
  const allowPrivateRaw = r.private_chat_enabled ?? r.allow_private ?? r.private_chat;
  const systemPromptRaw = r.system_prompt ?? r.systemPrompt;

  const systemPrompt = typeof systemPromptRaw === 'string' ? systemPromptRaw : '';

  return {
    enabled: typeof enabledRaw === 'boolean' ? enabledRaw : DEFAULT_AI_SETTINGS.enabled,
    mode: normalizeMode(r.mode),
    allow_public: typeof allowPublicRaw === 'boolean' ? allowPublicRaw : DEFAULT_AI_SETTINGS.allow_public,
    allow_private: typeof allowPrivateRaw === 'boolean' ? allowPrivateRaw : DEFAULT_AI_SETTINGS.allow_private,
    realtime_enabled: DEFAULT_AI_SETTINGS.realtime_enabled,
    prompts: systemPrompt
      ? {
          en: systemPrompt,
          ar: systemPrompt,
          de: systemPrompt,
        }
      : {},
    system_prompt: systemPrompt,
  };
}

export function pickPrompt(settings: AiSettings, lang: Language): string {
  const normalized = normalizeLanguage(lang);
  // Since prompts table/column not present, fallback to system_prompt
  return settings.prompts?.[normalized] ?? settings.prompts?.en ?? settings.system_prompt ?? '';
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    console.log('[ai][settings] getAiSettings');

    const base = supabase.from('ai_settings').select('*');

    // Load the most recent row.
    // Do NOT filter by key (some deployments don't have a "key" column).
    // Prefer updated_at if present; otherwise fall back to created_at.
    let res = await base.order('updated_at', { ascending: false }).limit(1).maybeSingle();

    if (res.error) {
      console.warn('[ai][settings] load failed ordering by updated_at; falling back to created_at', {
        message: res.error.message,
        code: (res.error as { code?: string }).code ?? null,
      });

      res = await base.order('created_at', { ascending: false }).limit(1).maybeSingle();
    }

    if (res.error) {
      console.error('[ai][settings] load failed', {
        message: res.error.message,
        code: (res.error as { code?: string }).code ?? null,
      });
      return DEFAULT_AI_SETTINGS;
    }

    return res.data ? normalizeAiSettingsRow(res.data) : DEFAULT_AI_SETTINGS;
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
