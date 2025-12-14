import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { User } from '@/lib/db/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  
  login: (email: string, password?: string) => Promise<boolean>;
  register: (user: Omit<User, 'id' | 'role' | 'createdAt' | 'status'>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setGuest: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

function safeErrorDetails(error: unknown): Record<string, unknown> {
  if (!error) return { error: null };

  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    name?: string;
  };

  return {
    message: e?.message ?? String(error),
    code: e?.code ?? null,
    details: e?.details ?? null,
    hint: e?.hint ?? null,
    status: e?.status ?? null,
    name: e?.name ?? null,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isGuest: false,
  isAdmin: false,

  checkAuth: async () => {
    try {
      console.log('[authStore] checkAuth: using supabase session');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[authStore] getSession error', error);
      }

      const sessionUser = data.session?.user ?? null;
      if (!sessionUser) {
        set({ isLoading: false, user: null, isAdmin: false, isGuest: false });
        return;
      }

      const profileRes = await supabase
        .from('profiles')
        .select('id, role, preferred_language, full_name, phone')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (profileRes.error) {
        const details = safeErrorDetails(profileRes.error);

        console.error(
          '[authStore] profiles select error',
          details,
          typeof details === 'object' ? JSON.stringify(details) : String(details)
        );

        const status = (details.status as number | null) ?? null;
        const code = (details.code as string | null) ?? null;

        if (status === 401 || code === 'PGRST301') {
          console.warn('[authStore] profiles select unauthorized; signing out');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.error('[authStore] signOut after profiles error failed', e);
          }
          set({ isLoading: false, user: null, isAdmin: false, isGuest: false });
          return;
        }
      }

      const role = (profileRes.data?.role ?? 'customer') as 'admin' | 'customer';
      const preferredLanguage = (profileRes.data?.preferred_language ?? 'en') as 'en' | 'ar' | 'de';

      const mappedUser: User = {
        id: sessionUser.id,
        email: sessionUser.email ?? '',
        name: profileRes.data?.full_name ?? (sessionUser.email?.split('@')[0] ?? 'User'),
        role,
        phone: profileRes.data?.phone ?? undefined,
        preferredLanguage,
        createdAt: sessionUser.created_at ?? new Date().toISOString(),
        status: 'active',
      };

      set({ user: mappedUser, isAdmin: role === 'admin', isGuest: false, isLoading: false });
    } catch (e) {
      console.error('[authStore] checkAuth failed', e);
      set({ isLoading: false, user: null, isAdmin: false, isGuest: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });

    if (!password) {
      set({ isLoading: false });
      return false;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[authStore] signInWithPassword result', {
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        error: error?.message,
      });

      if (error || !data.user) {
        set({ isLoading: false });
        return false;
      }

      await get().checkAuth();
      return true;
    } catch (e) {
      console.error('[authStore] login failed', e);
      set({ isLoading: false });
      return false;
    }
  },

  register: async (userData, password) => {
    set({ isLoading: true });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password,
      });

      console.log('[authStore] signUp result', {
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        error: error?.message,
      });

      if (error) {
        set({ isLoading: false });
        throw error;
      }

      set({ isLoading: false });
    } catch (e) {
      console.error('[authStore] register failed', e);
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[authStore] signOut error', error);
      }
    } catch (e) {
      console.error('[authStore] signOut unexpected error', e);
    }

    set({ user: null, isAdmin: false, isGuest: false });
  },

  setGuest: async () => {
    set({ isGuest: true, user: null, isAdmin: false, isLoading: false });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;

    set({ user: { ...user, ...updates } });
  }
}));
