import { I18nManager } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalizedString } from '@/lib/db/types';

// Types
export type Language = 'en' | 'ar' | 'de';

export function getLocalized(content: LocalizedString | string | undefined, lang: Language): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content[lang] || content['en'] || '';
}

type I18nStore = {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  isRTL: boolean;
};

// Translations
const translations: Record<Language, Record<string, string>> = {
  en: {
    // General
    appName: 'Ruwasi Elite Travel',
    tagline: 'Your Elite Path to Syria',
    welcome: 'Welcome',
    login: 'Login',
    register: 'Create Account',
    guest: 'Continue as Guest',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    phone: 'Phone Number',
    nationality: 'Nationality',
    country: 'Country of Residence',
    submit: 'Submit',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    logout: 'Logout',
    
    // Tabs
    tabHome: 'Home',
    tabServices: 'Services',
    tabBookings: 'Bookings',
    tabAccount: 'Account',

    // Home
    planTrip: 'Plan your elite trip to Syria',
    exploreServices: 'Explore Services',
    featuredPackages: 'Featured Packages',
    airportSteps: 'From Airport to Airport',
    
    // Services
    wellness: 'Wellness & Relaxation',
    medical: 'Medical & Aesthetic',
    study: 'Study in Syria',
    investment: 'Investment & Business',
    viewPackages: 'View Packages',
    requestBooking: 'Request Booking',
    loginToBook: 'Login to Book',
    
    // Bookings
    myBookings: 'My Bookings',
    noBookings: 'No bookings found',
    bookingStatus: 'Status',
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    openConversation: 'Open Conversation',
    askQuestion: 'Ask a Question',
    bookingRequestSent: 'Booking Request Sent',
    
    // Account
    myProfile: 'My Profile',
    myMessages: 'My Messages',
    settings: 'Settings',
    about: 'About Ruwasi',
    faq: 'FAQ',
    blog: 'Blog',
    language: 'Language',
    terms: 'Terms & Privacy',
    
    // Admin
    adminDashboard: 'Dashboard',
    adminCustomers: 'Customers Management',
    adminBookings: 'Bookings Management',
    adminMessages: 'Messages',
    adminServices: 'Services Management',
    adminPackages: 'Packages Management',
    adminBlogs: 'Blog Management',
    adminContent: 'Content Management',
    adminSettings: 'Admin Settings',
    
    // Admin Actions
    suspendUser: 'Suspend User',
    activateUser: 'Activate User',
    confirmBooking: 'Confirm Booking',
    cancelBooking: 'Cancel Booking',
    completeBooking: 'Complete Booking',
    
    // Admin Stats
    totalCustomers: 'Total Customers',
    newCustomers: 'New Customers',
    activeBookings: 'Active Bookings',
    revenue: 'Revenue',

    // Chat
    chatAutoReplyStub:
      "Thanks for reaching out — we’ve received your message. A team member will reply shortly.",
  },
  ar: {
    // General
    appName: 'رواسي إليت للسفر',
    tagline: 'مسارك النخبو إلى سوريا',
    welcome: 'مرحباً',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    guest: 'المتابعة كضيف',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    phone: 'رقم الهاتف',
    nationality: 'الجنسية',
    country: 'بلد الإقامة',
    submit: 'إرسال',
    cancel: 'إلغاء',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    success: 'نجاح',
    logout: 'تسجيل خروج',
    
    // Tabs
    tabHome: 'الرئيسية',
    tabServices: 'خدماتنا',
    tabBookings: 'حجوزاتي',
    tabAccount: 'حسابي',

    // Home
    planTrip: 'خطط رحلتك النخبوية إلى سوريا',
    exploreServices: 'استكشف الخدمات',
    featuredPackages: 'باقات مميزة',
    airportSteps: 'من المطار إلى المطار',
    
    // Services
    wellness: 'العافية والاسترخاء',
    medical: 'السياحة العلاجية والتجميلية',
    study: 'الدراسة في سوريا',
    investment: 'الاستثمار والأعمال',
    viewPackages: 'عرض الباقات',
    requestBooking: 'طلب حجز',
    loginToBook: 'سجل الدخول للحجز',
    
    // Bookings
    myBookings: 'حجوزاتي',
    noBookings: 'لا توجد حجوزات',
    bookingStatus: 'الحالة',
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    cancelled: 'ملغي',
    completed: 'مكتمل',
    openConversation: 'فتح المحادثة',
    askQuestion: 'طرح سؤال',
    bookingRequestSent: 'تم إرسال طلب الحجز',
    
    // Account
    myProfile: 'ملفي الشخصي',
    myMessages: 'رسائلي',
    settings: 'الإعدادات',
    about: 'عن رواسي',
    faq: 'الأسئلة الشائعة',
    blog: 'المدونة',
    language: 'اللغة',
    terms: 'الشروط والخصوصية',
    
    // Admin
    adminDashboard: 'لوحة التحكم',
    adminCustomers: 'إدارة العملاء',
    adminBookings: 'إدارة الحجوزات',
    adminMessages: 'الرسائل',
    adminServices: 'إدارة الخدمات',
    adminPackages: 'إدارة الباقات',
    adminBlogs: 'إدارة المدونة',
    adminContent: 'إدارة المحتوى',
    adminSettings: 'إعدادات المسؤول',
    
    // Admin Actions
    suspendUser: 'تجميد المستخدم',
    activateUser: 'تفعيل المستخدم',
    confirmBooking: 'تأكيد الحجز',
    cancelBooking: 'إلغاء الحجز',
    completeBooking: 'إكمال الحجز',
    
    // Admin Stats
    totalCustomers: 'إجمالي العملاء',
    newCustomers: 'عملاء جدد',
    activeBookings: 'حجوزات نشطة',
    revenue: 'الإيرادات',

    // Chat
    chatAutoReplyStub: 'شكرًا لتواصلك — تم استلام رسالتك. سيقوم أحد أعضاء الفريق بالرد قريبًا.',
  },
  de: {
    // General
    appName: 'Ruwasi Elite Travel',
    tagline: 'Ihr Elite-Pfad nach Syrien',
    welcome: 'Willkommen',
    login: 'Anmelden',
    register: 'Konto erstellen',
    guest: 'Als Gast fortfahren',
    email: 'E-Mail',
    password: 'Passwort',
    fullName: 'Vollständiger Name',
    phone: 'Telefonnummer',
    nationality: 'Nationalität',
    country: 'Wohnsitzland',
    submit: 'Absenden',
    cancel: 'Abbrechen',
    loading: 'Laden...',
    error: 'Ein Fehler ist aufgetreten',
    success: 'Erfolg',
    logout: 'Abmelden',
    
    // Tabs
    tabHome: 'Startseite',
    tabServices: 'Dienstleistungen',
    tabBookings: 'Buchungen',
    tabAccount: 'Konto',

    // Home
    planTrip: 'Planen Sie Ihre Elite-Reise nach Syrien',
    exploreServices: 'Dienstleistungen erkunden',
    featuredPackages: 'Ausgewählte Pakete',
    airportSteps: 'Von Flughafen zu Flughafen',
    
    // Services
    wellness: 'Wellness & Entspannung',
    medical: 'Medizin & Ästhetik',
    study: 'Studieren in Syrien',
    investment: 'Investition & Geschäft',
    viewPackages: 'Pakete ansehen',
    requestBooking: 'Buchung anfragen',
    loginToBook: 'Zum Buchen anmelden',
    
    // Bookings
    myBookings: 'Meine Buchungen',
    noBookings: 'Keine Buchungen gefunden',
    bookingStatus: 'Status',
    pending: 'Ausstehend',
    confirmed: 'Bestätigt',
    cancelled: 'Storniert',
    completed: 'Abgeschlossen',
    openConversation: 'Gespräch öffnen',
    askQuestion: 'Eine Frage stellen',
    bookingRequestSent: 'Buchungsanfrage gesendet',
    
    // Account
    myProfile: 'Mein Profil',
    myMessages: 'Meine Nachrichten',
    settings: 'Einstellungen',
    about: 'Über Ruwasi',
    faq: 'FAQ',
    blog: 'Blog',
    language: 'Sprache',
    terms: 'Bedingungen & Datenschutz',
    
    // Admin
    adminDashboard: 'Instrumententafel',
    adminCustomers: 'Kundenverwaltung',
    adminBookings: 'Buchungsverwaltung',
    adminMessages: 'Nachrichten',
    adminServices: 'Dienstleistungsverwaltung',
    adminPackages: 'Paketverwaltung',
    adminBlogs: 'Blog-Verwaltung',
    adminContent: 'Inhaltsverwaltung',
    adminSettings: 'Admin-Einstellungen',
    
    // Admin Actions
    suspendUser: 'Benutzer sperren',
    activateUser: 'Benutzer aktivieren',
    confirmBooking: 'Buchung bestätigen',
    cancelBooking: 'Buchung stornieren',
    completeBooking: 'Buchung abschließen',
    
    // Admin Stats
    totalCustomers: 'Gesamtkunden',
    newCustomers: 'Neue Kunden',
    activeBookings: 'Aktive Buchungen',
    revenue: 'Einnahmen',

    // Chat
    chatAutoReplyStub:
      'Danke für Ihre Nachricht — wir haben sie erhalten. Ein Teammitglied antwortet in Kürze.',
  },
};

// Store
export const useI18nStore = create<I18nStore>((set, get) => ({
  language: 'en',
  isRTL: false,
  setLanguage: async (lang: Language) => {
    const isRTL = lang === 'ar';
    await AsyncStorage.setItem('user-language', lang);
    set({ language: lang, isRTL });
  },
  t: (key: string) => {
    const lang = get().language;
    return translations[lang][key] || key;
  },
}));

// Initialize
export const initI18n = async () => {
  try {
    const storedLang = await AsyncStorage.getItem('user-language');
    if (storedLang === 'ar' || storedLang === 'en' || storedLang === 'de') {
      useI18nStore.getState().setLanguage(storedLang as Language);
    }
  } catch (e) {
    console.error('Failed to load language', e);
  }
};
