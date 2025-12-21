import { create } from 'zustand';

export type ProfileRole = 'admin' | 'customer';
export type PreferredLanguage = 'en' | 'ar' | 'de';

type ProfileState = {
  role: ProfileRole | null;
  preferredLanguage: PreferredLanguage | null;
  setProfile: (profile: { role: ProfileRole; preferredLanguage: PreferredLanguage }) => void;
  clearProfile: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  role: null,
  preferredLanguage: null,
  setProfile: (profile) => {
    console.log('[profileStore] setProfile', profile);
    set({ role: profile.role, preferredLanguage: profile.preferredLanguage });
  },
  clearProfile: () => {
    console.log('[profileStore] clearProfile');
    set({ role: null, preferredLanguage: null });
  },
}));
