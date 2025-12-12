import { create } from 'zustand';
import { trpcVanilla } from '@/lib/trpc';
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
    try {
      const [services, packages, blogs, settings, faqs, heroSlides] = await Promise.all([
        trpcVanilla.services.listCategories.query(),
        trpcVanilla.services.listPackages.query(),
        trpcVanilla.blog.list.query(),
        trpcVanilla.settings.get.query(),
        trpcVanilla.faq.list.query(),
        trpcVanilla.hero.listSlides.query(),
      ]);
      
      // Merge settings with heroSlides if needed, or backend handles it
      // Backend returns settings which includes heroSlides, but heroSlides usually managed by hero router
      // settings.heroSlides might be empty if not synced.
      // Let's use heroSlides from hero router
      if (settings) {
          settings.heroSlides = heroSlides as any;
      }

      set({
        services,
        packages,
        blogs,
        appContent: settings || DEFAULT_SETTINGS,
        faqs,
        isLoading: false,
      });
    } catch (e) {
      console.error('Failed to init data from Backend', e);
      set({ isLoading: false });
    }
  },

  updateService: async (service) => {
      await trpcVanilla.services.updateCategory.mutate({ id: service.id, data: service });
      get().initData();
  },
  addService: async (service) => {
      // transform service to input schema (remove id if creating?)
      // backend creates ID. 
      const { id, ...data } = service;
      await trpcVanilla.services.createCategory.mutate(data);
      get().initData();
  },
  deleteService: async (id) => {
      await trpcVanilla.services.deleteCategory.mutate({ id });
      get().initData();
  },

  updatePackage: async (pkg) => {
      await trpcVanilla.services.updatePackage.mutate({ id: pkg.id, data: pkg });
      get().initData();
  },
  addPackage: async (pkg) => {
      const { id, ...data } = pkg;
      await trpcVanilla.services.createPackage.mutate(data);
      get().initData();
  },
  deletePackage: async (id) => {
      await trpcVanilla.services.deletePackage.mutate({ id });
      get().initData();
  },

  updateBlog: async (blog) => {
      await trpcVanilla.blog.update.mutate({ id: blog.id, data: blog });
      get().initData();
  },
  addBlog: async (blog) => {
      const { id, author, createdAt, ...data } = blog;
      await trpcVanilla.blog.create.mutate(data);
      get().initData();
  },
  deleteBlog: async (id) => {
      await trpcVanilla.blog.delete.mutate({ id });
      get().initData();
  },

  updateAppContent: async (updates) => {
      await trpcVanilla.settings.update.mutate(updates);
      get().initData();
  }
}));
