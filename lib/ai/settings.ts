import { supabase } from '@/lib/supabase/client';

export type AiSettingsMode = 'off' | 'auto_reply' | 'human_handoff';

export type AiSettings = {
  is_enabled: boolean;
  mode: AiSettingsMode;
  public_chat_enabled: boolean;
  private_chat_enabled: boolean;
  system_prompt: string | null;
};

const SAFE_DEFAULT_SETTINGS: AiSettings = {
  is_enabled: false,
  mode: 'off',
  public_chat_enabled: true,
  private_chat_enabled: true,
  system_prompt: null,
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

function normalizeAiSettingsRow(row: unknown): AiSettings {
  const r = row as Partial<Record<keyof AiSettings, unknown>>;

  const mode = (r.mode as AiSettingsMode | undefined) ?? SAFE_DEFAULT_SETTINGS.mode;
  const normalizedMode: AiSettingsMode =
    mode === 'off' || mode === 'auto_reply' || mode === 'human_handoff' ? mode : 'off';

  return {
    is_enabled: typeof r.is_enabled === 'boolean' ? r.is_enabled : SAFE_DEFAULT_SETTINGS.is_enabled,
    mode: normalizedMode,
    public_chat_enabled:
      typeof r.public_chat_enabled === 'boolean'
        ? r.public_chat_enabled
        : SAFE_DEFAULT_SETTINGS.public_chat_enabled,
    private_chat_enabled:
      typeof r.private_chat_enabled === 'boolean'
        ? r.private_chat_enabled
        : SAFE_DEFAULT_SETTINGS.private_chat_enabled,
    system_prompt: typeof r.system_prompt === 'string' ? r.system_prompt : null,
  };
}

export async function getAiSettingsCached(): Promise<AiSettings> {
  try {
    if (isCacheValid(cache)) {
      console.log('[ai][settings] cache hit', {
        ageMs: Date.now() - cache.updatedAtMs,
      });
      return cache.value;
    }

    if (inFlight) {
      console.log('[ai][settings] awaiting in-flight request');
      return await inFlight;
    }

    inFlight = (async () => {
      console.log('[ai][settings] fetching from supabase');

      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ai][settings] fetch failed', {
          message: error.message,
          code: (error as { code?: string }).code ?? null,
        });
        return SAFE_DEFAULT_SETTINGS;
      }

      const value = data ? normalizeAiSettingsRow(data) : SAFE_DEFAULT_SETTINGS;
      cache = { updatedAtMs: Date.now(), value };
      console.log('[ai][settings] cached', { hasRow: Boolean(data) });
      return value;
    })();

    const res = await inFlight;
    return res;
  } catch (e) {
    console.error('[ai][settings] unexpected error', e);
    return SAFE_DEFAULT_SETTINGS;
  } finally {
    inFlight = null;
  }
}
