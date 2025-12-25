import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

console.log('[supabase] env check', {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
});

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  if (!supabaseUrl || !supabaseAnonKey) {
    // مهم: لا نعمل createClient نهائيًا
    throw new Error(
      '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Check your .env and restart Expo with -c.'
    );
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return _supabase;
}

// للتوافق مع الكود القديم اللي يستورد supabase مباشرة
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    // @ts-expect-error dynamic proxy
    return client[prop];
  },
});

export async function supabaseConnectionCheck(): Promise<{
  ok: boolean;
  details: Record<string, unknown>;
}> {
  try {
    const client = getSupabase();
    const { data, error } = await client.auth.getSession();

    const details: Record<string, unknown> = {
      hasSession: Boolean(data.session),
      error: error?.message ?? null,
    };

    const ok = !error;
    console.log('[supabase] connection check (auth.getSession)', { ok, ...details });
    return { ok, details };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[supabase] connection check failed', msg);
    return { ok: false, details: { error: msg } };
  }
}
