import { create } from 'zustand';

import { supabase } from '@/lib/supabase/client';

export type AppImageKey = 'heroBackground' | 'welcomeBackground' | 'authBackground' | 'logoUrl';

export type AppImagesByKey = Partial<Record<AppImageKey, string>>;

type AppImagesRow = {
  key: string;
  url: string | null;
};

interface AppImagesState {
  imagesByKey: AppImagesByKey;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  refresh: () => Promise<void>;
}

const KNOWN_KEYS: AppImageKey[] = ['heroBackground', 'welcomeBackground', 'authBackground', 'logoUrl'];

export const useAppImagesStore = create<AppImagesState>((set) => ({
  imagesByKey: {},
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  refresh: async () => {
    console.log('[appImagesStore] refresh start');
    set({ isLoading: true, error: null });

    try {
      const res = await supabase.from('app_images').select('key,url');

      console.log('[appImagesStore] refresh result', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });

      if (res.error) {
        set({ isLoading: false, error: res.error.message, lastFetchedAt: Date.now() });
        return;
      }

      const next: AppImagesByKey = {};
      for (const row of (res.data ?? []) as AppImagesRow[]) {
        const k = row.key as AppImageKey;
        if (!KNOWN_KEYS.includes(k)) continue;
        const url = row.url ?? '';
        if (url) next[k] = url;
      }

      set({ imagesByKey: next, isLoading: false, error: null, lastFetchedAt: Date.now() });
    } catch (e) {
      console.error('[appImagesStore] refresh unexpected error', e);
      set({ isLoading: false, error: 'Failed to load images.', lastFetchedAt: Date.now() });
    }
  },
}));
