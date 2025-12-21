import {
  ServiceCategory,
  Package,
  BlogPost,
  FAQ,
  AppSettings,
  LocalizedString,
} from '@/lib/db/types';

const locSame = (text: string): LocalizedString => ({
  en: text,
  ar: text,
  de: text,
});

export const MOCK_SERVICES: ServiceCategory[] = [];

export const MOCK_PACKAGES: Package[] = [];

export const MOCK_FAQ: FAQ[] = [];

export const MOCK_BLOGS: BlogPost[] = [];

export const MOCK_APP_CONTENT: AppSettings = {
  companyName: locSame(''),
  contact: { email: '', phone: '', whatsapp: '', address: locSame('') },
  termsAndConditions: locSame(''),
  privacyPolicy: locSame(''),
  about: {
    section1Title: locSame(''),
    section1Content: locSame(''),
    missionTitle: locSame(''),
    missionContent: locSame(''),
    visionTitle: locSame(''),
    visionContent: locSame(''),
  },
  hero: {
    title: locSame(''),
    subtitle: locSame(''),
    buttonText: locSame(''),
  },
  heroSlides: [],
  images: {
    heroBackground: '',
    welcomeBackground: '',
    authBackground: '',
    logoUrl: '',
  },
};
