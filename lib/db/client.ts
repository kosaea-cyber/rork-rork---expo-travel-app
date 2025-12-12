import { Storage } from './storage';
import * as Crypto from 'expo-crypto';
import { DatabaseSchema, User, ServiceCategory, Package, Booking, Conversation, Message, BlogPost, AppSettings, FAQ, HeroSlide } from './types';
import { MOCK_SERVICES, MOCK_PACKAGES, MOCK_BLOGS, MOCK_FAQ, MOCK_APP_CONTENT } from '@/mocks/data';

const DB_KEY = 'rork_app_db_v6';

// Initial Seed Data
const INITIAL_DB: DatabaseSchema = {
  users: [
    {
      id: 'admin',
      email: 'admin',
      name: 'Super Admin',
      role: 'admin',
      preferredLanguage: 'en',
      createdAt: new Date().toISOString(),
      status: 'active',
      passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' // SHA-256 of 'admin123'
    },
    {
      id: 'demo_user',
      email: 'user@demo.com',
      name: 'Ahmed Al-Kuwaiti',
      role: 'customer',
      preferredLanguage: 'ar',
      createdAt: new Date().toISOString(),
      status: 'active',
      phone: '+965 1234 5678',
      nationality: 'Kuwaiti',
      country: 'Kuwait'
    }
  ],
  categories: [],
  packages: [],
  bookings: [],
  conversations: [],
  messages: [],
  blogs: [],
  faqs: [],
  settings: {
    companyName: { en: 'Ruwasi Elite Travel', ar: 'رواسي إليت للسفر', de: 'Ruwasi Elite Travel' },
    termsAndConditions: { en: 'Terms...', ar: 'الشروط...', de: 'Bedingungen...' },
    privacyPolicy: { en: 'Privacy...', ar: 'الخصوصية...', de: 'Datenschutz...' },
    contact: {
      email: 'info@ruwasi.com',
      phone: '+96500000000',
      whatsapp: '+96500000000',
      address: { en: 'Kuwait City', ar: 'مدينة الكويت', de: 'Kuwait-Stadt' }
    },
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
    heroSlides: [
        {
            id: 'slide1',
            imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            title: { en: 'Plan your elite trip to Syria', ar: 'خطط لرحلتك النخبوية إلى سوريا', de: 'Planen Sie Ihre Elitereise nach Syrien' },
            subtitle: { en: 'Experience the finest in Wellness, Medical, Study, and Investment Tourism.', ar: 'جرب الأفضل في السياحة الصحية والطبية والدراسية والاستثمارية.', de: 'Erleben Sie das Beste aus Wellness-, Medizin-, Studien- und Investitionstourismus.' },
            ctaLabel: { en: 'Explore Services', ar: 'استكشف الخدمات', de: 'Dienste erkunden' },
            ctaLink: '/(tabs)/services',
            isActive: true,
            order: 1
        },
        {
            id: 'slide2',
            imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            title: { en: 'Medical Tourism', ar: 'السياحة العلاجية', de: 'Medizintourismus' },
            subtitle: { en: 'World-class healthcare at your fingertips.', ar: 'رعاية صحية عالمية المستوى في متناول يدك.', de: 'Weltklasse-Gesundheitsversorgung zum Greifen nah.' },
            ctaLabel: { en: 'Book Consultation', ar: 'احجز استشارة', de: 'Beratung buchen' },
            ctaLink: '/(tabs)/services',
            isActive: true,
            order: 2
        },
        {
            id: 'slide3',
            imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            title: { en: 'Wellness & Spa', ar: 'العافية والسبا', de: 'Wellness & Spa' },
            subtitle: { en: 'Relax and rejuvenate in luxury.', ar: 'استرخ وجدد نشاطك في فخامة.', de: 'Entspannen und verjüngen Sie sich in Luxus.' },
            ctaLabel: { en: 'View Packages', ar: 'عرض الباقات', de: 'Pakete ansehen' },
            ctaLink: '/(tabs)/services',
            isActive: true,
            order: 3
        },
        {
            id: 'slide4',
            imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            title: { en: 'Educational Trips', ar: 'رحلات تعليمية', de: 'Bildungsreisen' },
            subtitle: { en: 'Discover top universities and programs.', ar: 'اكتشف أفضل الجامعات والبرامج.', de: 'Entdecken Sie Top-Universitäten und Programme.' },
            ctaLabel: { en: 'Learn More', ar: 'اعرف المزيد', de: 'Mehr erfahren' },
            ctaLink: '/(tabs)/services',
            isActive: true,
            order: 4
        },
        {
            id: 'slide5',
            imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            title: { en: 'Investment Opportunities', ar: 'فرص استثمارية', de: 'Investitionsmöglichkeiten' },
            subtitle: { en: 'Grow your wealth with strategic investments.', ar: 'نمِّ ثروتك باستثمارات استراتيجية.', de: 'Vermehren Sie Ihr Vermögen mit strategischen Investitionen.' },
            ctaLabel: { en: 'Contact Us', ar: 'اتصل بنا', de: 'Kontaktiere uns' },
            ctaLink: '/(tabs)/account/contact',
            isActive: true,
            order: 5
        }
    ],
    images: {
      heroBackground: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      welcomeBackground: 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      authBackground: 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      logoUrl: ''
    }
  },
  sessions: {}
};

class Database {
  private data: DatabaseSchema = INITIAL_DB;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const stored = await Storage.getItem(DB_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure settings structure is complete by merging with defaults
        if (parsed.settings) {
            parsed.settings = {
                ...INITIAL_DB.settings,
                ...parsed.settings,
                images: {
                    ...INITIAL_DB.settings.images,
                    ...(parsed.settings.images || {})
                }
            };
        }
        this.data = { ...INITIAL_DB, ...parsed };
      } else {
        this.seedFromMocks();
        await this.save();
      }
      this.initialized = true;
      console.log('Database initialized');
    } catch (e) {
      console.error('Database init failed', e);
      this.seedFromMocks();
    }
  }

  private seedFromMocks() {
    this.data.categories = MOCK_SERVICES.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      icon: s.icon,
      slug: s.id.toLowerCase(),
      image: s.image
    }));

    this.data.packages = MOCK_PACKAGES.map(p => ({
      id: p.id,
      categoryId: p.categoryId,
      title: p.title,
      description: p.description,
      duration: p.duration,
      features: p.features,
      included: p.included || [],
      isFeatured: p.isFeatured,
      price: p.price,
      imageUrl: p.imageUrl
    }));

    this.data.blogs = MOCK_BLOGS.map(b => ({
      id: b.id,
      title: b.title,
      content: b.content,
      excerpt: b.excerpt,
      author: b.author || 'Ruwasi Team',
      createdAt: b.createdAt,
      category: b.category || 'General',
      imageUrl: b.imageUrl
    }));

    this.data.faqs = MOCK_FAQ.map(f => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: 'General'
    }));
    
    // Seed Settings from Mock
    this.data.settings = MOCK_APP_CONTENT;
  }

  async save() {
    try {
      await Storage.setItem(DB_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Database save failed', e);
    }
  }

  async hashPassword(password: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  }

  // --- ENTITY MANAGERS ---

  users = {
    findUnique: async (where: { id?: string, email?: string }) => {
      await this.ensureInit();
      return this.data.users.find(u => 
        (where.id && u.id === where.id) || 
        (where.email && u.email.toLowerCase() === where.email.toLowerCase())
      );
    },
    validateCredentials: async (emailOrUsername: string, password: string): Promise<User | null> => {
        await this.ensureInit();
        const user = this.data.users.find(u => 
            u.email.toLowerCase() === emailOrUsername.toLowerCase() || 
            u.id === emailOrUsername
        );
        if (!user || !user.passwordHash) return null;
        const inputHash = await this.hashPassword(password);
        return inputHash === user.passwordHash ? user : null;
    },
    create: async (user: User, password?: string) => {
      await this.ensureInit();
      if (password) {
        user.passwordHash = await this.hashPassword(password);
      }
      this.data.users.push(user);
      await this.save();
      return user;
    },
    update: async (id: string, data: Partial<User>) => {
      await this.ensureInit();
      const idx = this.data.users.findIndex(u => u.id === id);
      if (idx === -1) throw new Error('User not found');
      this.data.users[idx] = { ...this.data.users[idx], ...data };
      await this.save();
      return this.data.users[idx];
    },
    findMany: async (filter?: { role?: 'admin' | 'customer' }) => {
      await this.ensureInit();
      let res = this.data.users;
      if (filter?.role) res = res.filter(u => u.role === filter.role);
      return res;
    }
  };

  bookings = {
    findMany: async (filter?: { customerId?: string, status?: string }) => {
      await this.ensureInit();
      let res = this.data.bookings;
      if (filter?.customerId) res = res.filter(b => b.customerId === filter.customerId);
      if (filter?.status) res = res.filter(b => b.status === filter.status);
      return res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    findById: async (id: string) => {
      await this.ensureInit();
      return this.data.bookings.find(b => b.id === id);
    },
    create: async (data: Booking) => {
      await this.ensureInit();
      this.data.bookings.push(data);
      await this.save();
      return data;
    },
    update: async (id: string, data: Partial<Booking>) => {
      await this.ensureInit();
      const idx = this.data.bookings.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Booking not found');
      this.data.bookings[idx] = { ...this.data.bookings[idx], ...data };
      await this.save();
      return this.data.bookings[idx];
    },
    delete: async (id: string) => {
        await this.ensureInit();
        this.data.bookings = this.data.bookings.filter(b => b.id !== id);
        await this.save();
    }
  };

  conversations = {
    findMany: async (filter?: { customerId?: string }) => {
      await this.ensureInit();
      let res = this.data.conversations;
      if (filter?.customerId) res = res.filter(c => c.customerId === filter.customerId);
      return res.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    },
    findById: async (id: string) => {
      await this.ensureInit();
      return this.data.conversations.find(c => c.id === id);
    },
    create: async (data: Conversation) => {
      await this.ensureInit();
      this.data.conversations.push(data);
      await this.save();
      return data;
    },
    update: async (id: string, data: Partial<Conversation>) => {
      await this.ensureInit();
      const idx = this.data.conversations.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.data.conversations[idx] = { ...this.data.conversations[idx], ...data };
        await this.save();
      }
    }
  };

  messages = {
    findMany: async (conversationId: string) => {
      await this.ensureInit();
      return this.data.messages.filter(m => m.conversationId === conversationId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    create: async (data: Message) => {
      await this.ensureInit();
      this.data.messages.push(data);
      const convIdx = this.data.conversations.findIndex(c => c.id === data.conversationId);
      if (convIdx !== -1) {
        this.data.conversations[convIdx].lastMessageAt = data.createdAt;
      }
      await this.save();
      return data;
    }
  };

  packages = {
    findMany: async (filter?: { categoryId?: string }) => {
      await this.ensureInit();
      let res = this.data.packages;
      if (filter?.categoryId) res = res.filter(p => p.categoryId === filter.categoryId);
      return res;
    },
    update: async (id: string, data: Partial<Package>) => {
      await this.ensureInit();
      const idx = this.data.packages.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.data.packages[idx] = { ...this.data.packages[idx], ...data };
        await this.save();
      }
    },
    create: async (data: Package) => {
        await this.ensureInit();
        this.data.packages.push(data);
        await this.save();
    },
    delete: async (id: string) => {
        await this.ensureInit();
        this.data.packages = this.data.packages.filter(p => p.id !== id);
        await this.save();
    }
  };

  categories = {
    findMany: async () => {
      await this.ensureInit();
      return this.data.categories;
    },
    update: async (id: string, data: Partial<ServiceCategory>) => {
        await this.ensureInit();
        const idx = this.data.categories.findIndex(c => c.id === id);
        if (idx !== -1) {
            this.data.categories[idx] = { ...this.data.categories[idx], ...data };
            await this.save();
        }
    },
    create: async (data: ServiceCategory) => {
        await this.ensureInit();
        this.data.categories.push(data);
        await this.save();
    },
    delete: async (id: string) => {
        await this.ensureInit();
        this.data.categories = this.data.categories.filter(c => c.id !== id);
        await this.save();
    }
  };

  blogs = {
    findMany: async () => {
      await this.ensureInit();
      return this.data.blogs;
    },
    create: async (data: BlogPost) => {
        await this.ensureInit();
        this.data.blogs.push(data);
        await this.save();
    },
    update: async (id: string, data: Partial<BlogPost>) => {
        await this.ensureInit();
        const idx = this.data.blogs.findIndex(b => b.id === id);
        if (idx !== -1) {
            this.data.blogs[idx] = { ...this.data.blogs[idx], ...data };
            await this.save();
        }
    },
    delete: async (id: string) => {
        await this.ensureInit();
        this.data.blogs = this.data.blogs.filter(b => b.id !== id);
        await this.save();
    }
  };
  
  faqs = {
    findMany: async () => {
        await this.ensureInit();
        return this.data.faqs;
    }
  }

  settings = {
    get: async () => {
      await this.ensureInit();
      return this.data.settings;
    },
    update: async (data: Partial<AppSettings>) => {
      await this.ensureInit();
      this.data.settings = { ...this.data.settings, ...data };
      await this.save();
      return this.data.settings;
    }
  };

  heroSlides = {
    getAll: async () => {
        await this.ensureInit();
        return this.data.settings.heroSlides;
    },
    update: async (slides: HeroSlide[]) => {
        await this.ensureInit();
        this.data.settings.heroSlides = slides;
        await this.save();
    }
  };

  private async ensureInit() {
    if (!this.initialized) await this.init();
    await new Promise(r => setTimeout(r, 100)); // Small latency
  }
}

export const db = new Database();
