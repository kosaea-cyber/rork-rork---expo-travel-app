import { create } from 'zustand';
import { ServiceCategory, Package, BlogPost, AppSettings, FAQ } from '@/lib/db/types';

interface DataState {
  services: ServiceCategory[];
  packages: Package[];
  blogs: BlogPost[];
  faqs: FAQ[];
  appContent: AppSettings;
  isLoading: boolean;
  
  initData: () => Promise<void>;
  
  updateService: (service: ServiceCategory) => Promise<void>;
  addService: (service: ServiceCategory) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  
  updatePackage: (pkg: Package) => Promise<void>;
  addPackage: (pkg: Package) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;

  updateBlog: (blog: BlogPost) => Promise<void>;
  addBlog: (blog: BlogPost) => Promise<void>;
  deleteBlog: (id: string) => Promise<void>;

  updateAppContent: (content: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
    companyName: { en: '', ar: '', de: '' },
    contact: { email: '', phone: '', whatsapp: '', address: { en: '', ar: '', de: '' } },
    termsAndConditions: { en: '', ar: '', de: '' },
    privacyPolicy: { en: '', ar: '', de: '' },
    about: {
       section1Title: { en: '', ar: '', de: '' },
       section1Content: { en: '', ar: '', de: '' },
       missionTitle: { en: '', ar: '', de: '' },
       missionContent: { en: '', ar: '', de: '' },
       visionTitle: { en: '', ar: '', de: '' },
       visionContent: { en: '', ar: '', de: '' }
    },
    hero: {
       title: { en: '', ar: '', de: '' },
       subtitle: { en: '', ar: '', de: '' },
       buttonText: { en: '', ar: '', de: '' }
    },
    heroSlides: [],
    images: {
      heroBackground: '',
      welcomeBackground: '',
      authBackground: '',
      logoUrl: ''
    }
};

export const useDataStore = create<DataState>((set, get) => ({
  services: [],
  packages: [],
  blogs: [],
  faqs: [],
  appContent: DEFAULT_SETTINGS,
  isLoading: true,

  initData: async () => {
    console.log('[dataStore] initData disabled (Supabase-only)');
    set({ isLoading: false });
  },

  updateService: async () => {
    throw new Error('Not supported: backend disabled');
  },
  addService: async () => {
    throw new Error('Not supported: backend disabled');
  },
  deleteService: async () => {
    throw new Error('Not supported: backend disabled');
  },

  updatePackage: async () => {
    throw new Error('Not supported: backend disabled');
  },
  addPackage: async () => {
    throw new Error('Not supported: backend disabled');
  },
  deletePackage: async () => {
    throw new Error('Not supported: backend disabled');
  },

  updateBlog: async () => {
    throw new Error('Not supported: backend disabled');
  },
  addBlog: async () => {
    throw new Error('Not supported: backend disabled');
  },
  deleteBlog: async () => {
    throw new Error('Not supported: backend disabled');
  },

  updateAppContent: async () => {
    throw new Error('Not supported: backend disabled');
  },
}));
