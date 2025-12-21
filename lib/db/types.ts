export type Language = 'en' | 'ar' | 'de';

export interface LocalizedString {
  en: string;
  ar: string;
  de: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  passwordHash?: string;
  phone?: string;
  nationality?: string;
  country?: string;
  preferredLanguage: Language;
  createdAt: string;
  status: 'active' | 'suspended';
  avatar?: string;
}

export interface ServiceCategory {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  icon: string; 
  slug: string;
  image?: string;
}

export interface Package {
  id: string;
  categoryId: string;
  title: LocalizedString;
  description: LocalizedString;
  duration: LocalizedString;
  price?: LocalizedString;
  features: LocalizedString[];
  included: LocalizedString[];
  imageUrl?: string;
  isFeatured: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  packageId?: string;
  packageTitle?: string;
  serviceCategoryId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  startDate: string;
  endDate: string;
  travelers: number;
  notes?: string;
  createdAt: string;
  type?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string; 
  text: string;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  customerId: string;
  bookingId?: string;
  subject: string;
  status: 'open' | 'closed';
  lastMessageAt: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  title: LocalizedString;
  content: LocalizedString;
  excerpt: LocalizedString;
  author: string;
  createdAt: string;
  imageUrl?: string;
  category: string;
}

export interface FAQ {
  id: string;
  question: LocalizedString;
  answer: LocalizedString;
  category: string;
}

export interface HeroSlide {
  id: string;
  imageUrl: string;
  title: LocalizedString;
  subtitle: LocalizedString;
  ctaLabel: LocalizedString;
  ctaLink: string;
  isActive: boolean;
  order: number;
}

export interface AppSettings {
  companyName: LocalizedString;
  termsAndConditions: LocalizedString;
  privacyPolicy: LocalizedString;
  
  contact: {
    email: string;
    phone: string;
    whatsapp: string;
    address: LocalizedString;
  };

  about: {
    section1Title: LocalizedString;
    section1Content: LocalizedString;
    missionTitle: LocalizedString;
    missionContent: LocalizedString;
    visionTitle: LocalizedString;
    visionContent: LocalizedString;
  };

  // Deprecated single hero fields (kept for type safety until migration complete)
  hero: {
    title: LocalizedString;
    subtitle: LocalizedString;
    buttonText: LocalizedString;
  };

  heroSlides: HeroSlide[];

  images: {
    heroBackground: string;
    welcomeBackground: string;
    authBackground: string;
    logoUrl?: string;
  };
}

export interface DatabaseSchema {
  users: User[];
  categories: ServiceCategory[];
  packages: Package[];
  bookings: Booking[];
  conversations: Conversation[];
  messages: Message[];
  blogs: BlogPost[];
  faqs: FAQ[];
  settings: AppSettings;
  sessions: { [token: string]: { userId: string; createdAt: string } };
}
