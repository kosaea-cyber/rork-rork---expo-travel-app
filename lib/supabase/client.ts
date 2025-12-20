import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseProjectRefFromUrl(url: string | null | undefined): string | null {
  try {
    if (!url) return null;
    const u = new URL(url);
    const host = u.host;
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

console.log('[supabase] env check', {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  urlHost: (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).host : null;
    } catch {
      return null;
    }
  })(),
  projectRef: getSupabaseProjectRefFromUrl(supabaseUrl ?? null),
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function supabaseConnectionCheck(): Promise<{ ok: boolean; details: Record<string, unknown> }>
{
  try {
    const { data, error } = await supabase.auth.getSession();
    const details: Record<string, unknown> = {
      hasSession: Boolean(data.session),
      error: error?.message ?? null,
    };

    const ok = !error;
    console.log('[supabase] connection check (auth.getSession)', { ok, ...details });
    return { ok, details };
  } catch (e) {
    console.error('[supabase] connection check failed', e);
    return { ok: false, details: { error: 'unexpected_error' } };
  }
}
