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
        const err = profileRes.error as unknown as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
          status?: number;
          name?: string;
        };

        console.error('[authStore] profiles select error', {
          message: err?.message ?? String(profileRes.error),
          code: err?.code ?? null,
          details: err?.details ?? null,
          hint: err?.hint ?? null,
          status: err?.status ?? null,
          name: err?.name ?? null,
        });
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
