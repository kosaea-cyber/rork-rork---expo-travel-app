import {
  ServiceCategory,
  Package,
  BlogPost,
  FAQ,
  AppSettings,
  LocalizedString,
} from '@/lib/db/types';

// Helpers to create localized strings easily
const loc = (en: string, ar: string, de: string): LocalizedString => ({
  en,
  ar,
  de,
});
const locSame = (text: string): LocalizedString => ({
  en: text,
  ar: text,
  de: text,
});

export const MOCK_SERVICES: ServiceCategory[] = [
  {
    id: 'wellness',
    title: loc(
      'Wellness & Relaxation',
      'العافية والاسترخاء',
      'Wellness & Entspannung'
    ),
    description: loc(
      'Luxury spa and wellness treatments',
      'علاجات سبا وعافية فاخرة',
      'Luxus-Spa- und Wellnessbehandlungen'
    ),
    icon: 'Sunset',
    slug: 'wellness-relaxation',
    image:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'medical',
    title: loc(
      'Medical & Aesthetic',
      'السياحة العلاجية والتجميلية',
      'Medizin & Ästhetik'
    ),
    description: loc(
      'World-class medical treatments',
      'علاجات طبية عالمية المستوى',
      'Weltklasse medizinische Behandlungen'
    ),
    icon: 'Stethoscope',
    slug: 'medical-aesthetic',
    image:
      'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'study',
    title: loc('Study in Syria', 'الدراسة في سوريا', 'Studieren in Syrien'),
    description: loc(
      'Educational opportunities',
      'فرص تعليمية',
      'Bildungsmöglichkeiten'
    ),
    icon: 'GraduationCap',
    slug: 'study-in-syria',
    image:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'investment',
    title: loc(
      'Investment & Business',
      'الاستثمار والأعمال',
      'Investition & Geschäft'
    ),
    description: loc(
      'Business and investment tours',
      'جولات تجارية واستثمارية',
      'Geschäfts- und Investitionstouren'
    ),
    icon: 'TrendingUp',
    slug: 'investment-business',
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  },
];

export const MOCK_PACKAGES: Package[] = [
  {
    id: 'pkg_1',
    categoryId: 'wellness',
    title: loc(
      'Royal Spa Retreat',
      'ملاذ السبا الملكي',
      'Königliches Spa-Retreat'
    ),
    description: loc(
      '5 Days of complete relaxation in the finest spas of Damascus.',
      '5 أيام من الاسترخاء التام في أرقى منتجعات دمشق.',
      '5 Tage vollkommene Entspannung in den besten Spas von Damaskus.'
    ),
    duration: loc('5 Days', '5 أيام', '5 Tage'),
    price: loc('$2,500', '$2,500', '2.500 €'),
    features: [
      loc('Airport Pickup', 'استقبال من المطار', 'Flughafenabholung'),
      loc('5-Star Hotel', 'فندق 5 نجوم', '5-Sterne-Hotel'),
      loc('Daily Spa Treatments', 'علاجات سبا يومية', 'Tägliche Spa-Behandlungen'),
      loc('City Tour', 'جولة في المدينة', 'Stadtrundfahrt'),
    ],
    included: [
      loc('Accommodation', 'الإقامة', 'Unterkunft'),
      loc('Breakfast', 'الإفطار', 'Frühstück'),
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    isFeatured: true,
  },
  {
    id: 'pkg_2',
    categoryId: 'medical',
    title: loc(
      'Hollywood Smile Package',
      'باقة ابتسامة هوليوود',
      'Hollywood Lächeln Paket'
    ),
    description: loc(
      'Complete dental makeover with top specialists.',
      'تجميل أسنان كامل مع أفضل الأخصائيين.',
      'Komplette Zahnsanierung bei Top-Spezialisten.'
    ),
    duration: loc('7 Days', '7 أيام', '7 Tage'),
    price: loc('$3,000', '$3,000', '3.000 €'),
    features: [
      loc('Consultation', 'استشارة', 'Beratung'),
      loc('Dental Procedure', 'إجراء سني', 'Zahnärztlicher Eingriff'),
      loc('Luxury Accommodation', 'إقامة فاخرة', 'Luxusunterkunft'),
      loc('Post-op Care', 'رعاية ما بعد العملية', 'Nachsorge'),
    ],
    included: [
      loc('X-Rays', 'الأشعة السينية', 'Röntgen'),
      loc('Transfers', 'النقل', 'Transfers'),
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    isFeatured: true,
  },
  {
    id: 'pkg_3',
    categoryId: 'study',
    title: loc(
      'University Admission Assist',
      'المساعدة في القبول الجامعي',
      'Unterstützung bei der Universitätszulassung'
    ),
    description: loc(
      'Full support for private university admission.',
      'دعم كامل للقبول في الجامعات الخاصة.',
      'Volle Unterstützung bei der Zulassung zu privaten Universitäten.'
    ),
    duration: loc('Ongoing', 'مستمر', 'Laufend'),
    price: loc('$1,500', '$1,500', '1.500 €'),
    features: [
      loc('University Tours', 'جولات جامعية', 'Universitätsführungen'),
      loc('Application Handling', 'معالجة الطلبات', 'Antragsbearbeitung'),
      loc('Visa Support', 'دعم التأشيرة', 'Visa-Unterstützung'),
      loc('Housing Assistance', 'المساعدة في السكن', 'Wohnraumunterstützung'),
    ],
    included: [
      loc('Document Translation', 'ترجمة الوثائق', 'Dokumentenübersetzung'),
      loc('Counseling', 'الاستشارة', 'Beratung'),
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    isFeatured: false,
  },
  {
    id: 'pkg_4',
    categoryId: 'investment',
    title: loc(
      'Real Estate Investment Tour',
      'جولة الاستثمار العقاري',
      'Immobilien-Investment-Tour'
    ),
    description: loc(
      'Exclusive tour of prime real estate opportunities.',
      'جولة حصرية لفرص عقارية مميزة.',
      'Exklusive Tour zu erstklassigen Immobilienangeboten.'
    ),
    duration: loc('3 Days', '3 أيام', '3 Tage'),
    price: loc('$1,000', '$1,000', '1.000 €'),
    features: [
      loc('Legal Consultation', 'استشارة قانونية', 'Rechtsberatung'),
      loc('Property Tours', 'جولات عقارية', 'Immobilienbesichtigungen'),
      loc('Market Analysis', 'تحليل السوق', 'Marktanalyse'),
      loc('Business Dinner', 'عشاء عمل', 'Geschäftsessen'),
    ],
    included: [
      loc('Legal Fees', 'الرسوم القانونية', 'Rechtskosten'),
      loc('Transport', 'النقل', 'Transport'),
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    isFeatured: false,
  },
  {
    id: 'pkg_5',
    categoryId: 'wellness',
    title: loc('History & Relax', 'التاريخ والاسترخاء', 'Geschichte & Entspannung'),
    description: loc(
      'Combine historical tours with evening relaxation.',
      'اجمع بين الجولات التاريخية والاسترخاء المسائي.',
      'Kombinieren Sie historische Touren mit abendlicher Entspannung.'
    ),
    duration: loc('6 Days', '6 أيام', '6 Tage'),
    price: loc('$2,800', '$2,800', '2.800 €'),
    features: [
      loc('Guided Tours', 'جولات سياحية', 'Geführte Touren'),
      loc('Hamam Experience', 'تجربة الحمام', 'Hamam-Erlebnis'),
      loc('Private Transport', 'نقل خاص', 'Privater Transport'),
      loc('Gourmet Dining', 'تجارب طعام فاخرة', 'Gourmet-Essen'),
    ],
    included: [
      loc('Entry Fees', 'رسوم الدخول', 'Eintrittsgelder'),
      loc('Guide', 'المرشد', 'Reiseführer'),
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1570530865773-cb19c35f73d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    isFeatured: true,
  },
];

export const MOCK_FAQ: FAQ[] = [
  {
    id: '1',
    category: 'General',
    question: loc(
      'Do I need a visa for Syria?',
      'هل أحتاج إلى تأشيرة لسوريا؟',
      'Brauche ich ein Visum für Syrien?'
    ),
    answer: loc(
      'Yes, but we handle the entire visa process for you as part of our packages.',
      'نعم، لكننا نتولى إجراءات التأشيرة بالكامل كجزء من باقاتنا.',
      'Ja, aber wir kümmern uns im Rahmen unserer Pakete um den gesamten Visaprozess.'
    ),
  },
  {
    id: '2',
    category: 'Medical',
    question: loc(
      'Are the clinics certified?',
      'هل العيادات معتمدة؟',
      'Sind die Kliniken zertifiziert?'
    ),
    answer: loc(
      'All our medical partners are internationally certified and top-tier in the region.',
      'جميع شركائنا الطبيين معتمدون دولياً ومن الدرجة الأولى في المنطقة.',
      'Alle unsere medizinischen Partner sind international zertifiziert und führend in der Region.'
    ),
  },
];

export const MOCK_BLOGS: BlogPost[] = [
  {
    id: '1',
    title: loc(
      'Why Syria is the New Investment Hub',
      'لماذا سوريا هي مركز الاستثمار الجديد',
      'Warum Syrien das neue Investitionszentrum ist'
    ),
    excerpt: loc(
      'Discover the emerging opportunities in the Syrian market...',
      'اكتشف الفرص الناشئة في السوق السورية...',
      'Entdecken Sie die aufstrebenden Möglichkeiten auf dem syrischen Markt...'
    ),
    createdAt: '2025-10-12',
    content: loc(
      'Syria is rapidly emerging as a new frontier for investment, offering untapped potential in various sectors including real estate, tourism, and infrastructure. With new government incentives and a stabilizing economy, early investors are poised to reap significant rewards. The reconstruction efforts have opened up massive opportunities for construction and logistics companies. Additionally, the tourism sector is seeing a revival, with a growing demand for luxury accommodations and heritage tours.',
      'تبرز سوريا بسرعة كوجهة جديدة للاستثمار، حيث تقدم إمكانات غير مستغلة في مختلف القطاعات بما في ذلك العقارات والسياحة والبنية التحتية. مع الحوافز الحكومية الجديدة والاقتصاد المستقر، يستعد المستثمرون الأوائل لجني مكاسب كبيرة. فتحت جهود إعادة الإعمار فرصاً هائلة لشركات البناء والخدمات اللوجستية. بالإضافة إلى ذلك، يشهد قطاع السياحة انتعاشاً، مع تزايد الطلب على أماكن الإقامة الفاخرة والجولات التراثية.',
      'Syrien entwickelt sich schnell zu einem neuen Investitionsziel und bietet ungenutztes Potenzial in verschiedenen Sektoren, darunter Immobilien, Tourismus und Infrastruktur. Mit neuen staatlichen Anreizen und einer sich stabilisierenden Wirtschaft können frühe Investoren erhebliche Gewinne erzielen. Die Wiederaufbaubemühungen haben massive Chancen für Bau- und Logistikunternehmen eröffnet. Darüber hinaus erlebt der Tourismussektor eine Wiederbelebung mit einer wachsenden Nachfrage nach Luxusunterkünften und Kulturerbe-Touren.'
    ),
    imageUrl:
      'https://images.unsplash.com/photo-1569234817121-a2552baf41dc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    author: 'Admin',
    category: 'Investment',
  },
  {
    id: '2',
    title: loc(
      'Top 5 Spas in Damascus',
      'أفضل 5 منتجعات صحية في دمشق',
      'Top 5 Spas in Damaskus'
    ),
    excerpt: loc(
      'A guide to the most luxurious relaxation spots...',
      'دليل لأرقى أماكن الاسترخاء...',
      'Ein Führer zu den luxuriösesten Entspannungsorten...'
    ),
    createdAt: '2025-09-28',
    content: loc(
      'Damascus, one of the oldest inhabited cities in the world, is also home to some of the most luxurious and historic hammams and spas. \n\n1. Hammam Al-Bakri: Known for its traditional architecture and authentic treatments.\n2. The Royal Spa at Jasmine Hotel: Offers modern wellness therapies combined with ancient techniques.\n3. Zen Garden Spa: A hidden gem in the Old City, perfect for a quiet retreat.\n4. Al-Noura Wellness Center: Specializes in therapeutic massages and skin treatments.\n5. Damascus Four Seasons Spa: The pinnacle of luxury with world-class amenities.',
      'دمشق، إحدى أقدم المدن المأهولة في العالم، هي أيضاً موطن لبعض أفخم الحمامات والمنتجعات الصحية التاريخية. \n\n1. حمام البكري: معروف بهندسته المعمارية التقليدية وعلاجاته الأصيلة.\n2. السبا الملكي في فندق الياسمين: يقدم علاجات صحية حديثة ممزوجة بتقنيات قديمة.\n3. سبا حديقة الزن: جوهرة مخفية في المدينة القديمة، مثالية لملاذ هادئ.\n4. مركز النورة للعافية: متخصص في التدليك العلاجي وعلاجات البشرة.\n5. سبا فور سيزونز دمشق: قمة الفخامة مع مرافق عالمية المستوى.',
      'Damaskus, eine der ältesten bewohnten Städte der Welt, beherbergt auch einige der luxuriösesten und historischsten Hamams und Spas. \n\n1. Hammam Al-Bakri: Bekannt für seine traditionelle Architektur und authentischen Behandlungen.\n2. The Royal Spa im Jasmine Hotel: Bietet moderne Wellness-Therapien kombiniert mit alten Techniken.\n3. Zen Garden Spa: Ein verstecktes Juwel in der Altstadt, perfekt für einen ruhigen Rückzug.\n4. Al-Noura Wellness Center: Spezialisiert auf therapeutische Massagen und Hautbehandlungen.\n5. Damascus Four Seasons Spa: Der Gipfel des Luxus mit erstklassigen Annehmlichkeiten.'
    ),
    imageUrl:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    author: 'Admin',
    category: 'Wellness',
  },
];

export const MOCK_APP_CONTENT: AppSettings = {
  companyName: loc('Ruwasi Elite', 'رواسي إليت', 'Ruwasi Elite'),
  termsAndConditions: loc('Terms...', 'الشروط...', 'Bedingungen...'),
  privacyPolicy: loc('Privacy...', 'الخصوصية...', 'Datenschutz...'),
  hero: {
    title: loc(
      'Plan your elite trip to Syria',
      'خطط رحلتك النخبوية إلى سوريا',
      'Planen Sie Ihre Elite-Reise nach Syrien'
    ),
    subtitle: loc(
      'Experience the finest in Wellness, Medical, Study, and Investment Tourism.',
      'استمتع بأرقى ما في السياحة العلاجية والتعليمية والاستثمارية.',
      'Erleben Sie das Beste aus Wellness-, Medizin-, Studien- und Investitionstourismus.'
    ),
    buttonText: loc('Explore Services', 'استكشف الخدمات', 'Dienstleistungen erkunden'),
  },
  heroSlides: [],
  about: {
    section1Title: loc(
      'About Ruwasi Elite Travel',
      'عن رواسي إليت للسفر',
      'Über Ruwasi Elite Travel'
    ),
    section1Content: loc(
      'Ruwasi Elite Travel is your premier partner for exploring Syria. We specialize in providing high-end, tailored travel experiences for discerning clients from the GCC and beyond. Our deep local knowledge combined with international standards of service ensures that your journey is seamless, comfortable, and unforgettable.',
      'رواسي إليت للسفر هي شريكك الأول لاستكشاف سوريا. نحن متخصصون في تقديم تجارب سفر راقية ومصممة خصيصاً للعملاء المميزين من دول مجلس التعاون الخليجي وخارجها. معرفتنا المحلية العميقة المقترنة بالمعايير الدولية للخدمة تضمن أن تكون رحلتك سلسة ومريحة ولا تُنسى.',
      'Ruwasi Elite Travel ist Ihr erstklassiger Partner für die Erkundung Syriens. Wir sind darauf spezialisiert, maßgeschneiderte High-End-Reiseerlebnisse für anspruchsvolle Kunden aus dem GCC und darüber hinaus anzubieten. Unsere tiefen lokalen Kenntnisse in Kombination mit internationalen Servicestandards sorgen dafür, dass Ihre Reise nahtlos, komfortabel und unvergesslich wird.'
    ),
    missionTitle: loc('Our Mission', 'مهمتنا', 'Unsere Mission'),
    missionContent: loc(
      'To provide exceptional travel experiences that bridge cultures and showcase the beauty and potential of Syria, while delivering the highest standards of luxury and comfort.',
      'تقديم تجارب سفر استثنائية تجسر الثقافات وتبرز جمال وإمكانات سوريا، مع تقديم أعلى معايير الفخامة والراحة.',
      'Außergewöhnliche Reiseerlebnisse zu bieten, die Kulturen verbinden und die Schönheit und das Potenzial Syriens präsentieren, während wir die höchsten Standards an Luxus und Komfort bieten.'
    ),
    visionTitle: loc('Our Vision', 'رؤيتنا', 'Unsere Vision'),
    visionContent: loc(
      'To be the leading luxury travel and concierge service in the region, recognized for our commitment to excellence, integrity, and personalized service.',
      'أن نكون خدمة السفر والكونسيرج الفاخرة الرائدة في المنطقة، والمعروفة بالتزامنا بالتميز والنزاهة والخدمة الشخصية.',
      'Der führende Luxusreise- und Concierge-Service in der Region zu sein, anerkannt für unser Engagement für Exzellenz, Integrität und personalisierten Service.'
    ),
  },
  contact: {
    phone: '+965 1234 5678',
    email: 'info@ruwasi-elite.com',
    whatsapp: '+963 912 345 678',
    address: loc(
      'Kuwait City, Kuwait | Damascus, Syria',
      'مدينة الكويت، الكويت | دمشق، سوريا',
      'Kuwait-Stadt, Kuwait | Damaskus, Syrien'
    ),
  },
  images: {
    heroBackground: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    welcomeBackground: 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    authBackground: 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    logoUrl: '',
  },
};
