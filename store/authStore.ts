import { create } from 'zustand';
import { trpcVanilla } from '@/lib/trpc';
import { User } from '@/lib/db/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        // Verify token with backend
        const user = await trpcVanilla.auth.me.query();
        if (user) {
          set({ 
            user: user as User, // Casting because backend might return slightly different struct (no password hash) which matches User interface mostly
            isAdmin: user.role === 'admin',
            isGuest: false,
            isLoading: false 
          });
          return;
        }
      }
      set({ isLoading: false });
    } catch (e) {
      console.error('Auth check failed', e);
      // Token might be invalid
      await AsyncStorage.removeItem('auth_token');
      set({ isLoading: false, user: null });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    
    if (!password) {
        set({ isLoading: false });
        return false;
    }

    try {
      const result = await trpcVanilla.auth.login.mutate({ email, password });
      
      await AsyncStorage.setItem('auth_token', result.token);
      set({ 
        user: result.user as User, 
        isAdmin: result.user.role === 'admin', 
        isGuest: false, 
        isLoading: false 
      });
      return true;
    } catch (e) {
      console.error("Login failed", e);
      set({ isLoading: false });
      return false;
    }
  },

  register: async (userData, password) => {
    set({ isLoading: true });
    
    try {
      const result = await trpcVanilla.auth.register.mutate({
        email: userData.email,
        password: password,
        name: userData.name,
        phone: userData.phone,
        role: "customer" // Default
      });

      await AsyncStorage.setItem('auth_token', result.token);
      set({ 
        user: result.user as User, 
        isAdmin: false, 
        isGuest: false, 
        isLoading: false 
      });
    } catch (e) {
      console.error("Register failed", e);
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
        await trpcVanilla.auth.logout.mutate();
    } catch (e) {
        // ignore
    }
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, isAdmin: false, isGuest: false });
  },

  setGuest: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ isGuest: true, user: null, isAdmin: false });
  },

  updateProfile: async (updates) => {
    // Implement profile update via trpc if endpoint exists
    // For now just update local state
    const { user } = get();
    if (!user) return;
    
    // TODO: Add updateProfile endpoint in auth or users router
    // const updated = await trpcVanilla.auth.updateProfile.mutate(updates);
    set({ user: { ...user, ...updates } });
  }
}));
