import { create } from 'zustand';

export type ProfileRole = 'admin' | 'customer';
export type PreferredLanguage = 'en' | 'ar' | 'de';

type ProfileState = {
  role: ProfileRole | null;
  preferredLanguage: PreferredLanguage | null;
  fullName: string | null;
  phone: string | null;

  setProfile: (profile: {
    role: ProfileRole;
    preferredLanguage: PreferredLanguage;
    fullName?: string | null;
    phone?: string | null;
  }) => void;

  clearProfile: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  role: null,
  preferredLanguage: null,
  fullName: null,
  phone: null,

  setProfile: (profile) => {
    console.log('[profileStore] setProfile', profile);
    set({
      role: profile.role,
      preferredLanguage: profile.preferredLanguage,
      fullName: profile.fullName ?? null,
      phone: profile.phone ?? null,
    });
  },

  clearProfile: () => {
    console.log('[profileStore] clearProfile');
    set({ role: null, preferredLanguage: null, fullName: null, phone: null });
  },
}));
