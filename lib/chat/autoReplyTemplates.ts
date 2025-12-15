export type ChatCategoryKey = 'general' | 'wellness_spa' | 'study' | 'medical_aesthetic' | 'investment';
export type LangKey = 'en' | 'ar' | 'de';

export const AUTO_REPLY_TEMPLATES: Record<ChatCategoryKey, { en: string; ar: string; de: string }> = {
  general: {
    en: "Thank you for your message 🌿 \nWe’ve received your inquiry and our team will reply shortly.\nTo help us assist faster, please tell us which service you’re interested in: Wellness & Spa, Medical/Aesthetic, Study, or Investment.",
    ar: "شكرًا لتواصلك معنا 🌿 \nتم استلام رسالتك وسيقوم فريقنا بالرد قريبًا.\nلتسريع المساعدة، يرجى تحديد الخدمة المطلوبة: استجمام وسبا، تجميلية/علاجية، دراسية، أو استثمارية.",
    de: "Vielen Dank für Ihre Nachricht 🌿 \nWir haben Ihre Anfrage erhalten und melden uns in Kürze.\nDamit wir schneller helfen können: Geht es um Wellness & Spa, Medizin/Ästhetik, Studium oder Investment?",
  },
  wellness_spa: {
    en: "Thank you 🌿 \nFor Wellness & Spa trips, please share: preferred city, dates, hotel level, and any spa/wellness preferences. We’ll tailor a luxury plan for you.",
    ar: "شكرًا لك 🌿 \nلسياحة الاستجمام والسبا، نرجو تزويدنا بـ: المدينة المفضلة، التواريخ، مستوى الفندق، وأي تفضيلات خاصة بالسبا. سنجهز لك خطة فاخرة مناسبة.",
    de: "Vielen Dank 🌿 \nFür Wellness & Spa Reisen teilen Sie uns bitte Stadt, Reisedaten, Hotelniveau und Ihre Wellness-Wünsche mit. Wir erstellen Ihnen einen exklusiven Plan.",
  },
  study: {
    en: "Thank you 🎓 \nFor Study Tourism, please tell us: desired major, preferred private university, language (EN/AR), and your target start date. We’ll guide you through admissions and requirements.",
    ar: "شكرًا لك 🎓 \nللسياحة الدراسية، يرجى ذكر: التخصص المطلوب، الجامعة الخاصة المفضلة، لغة الدراسة، وموعد البدء المتوقع. سنساعدك بخطوات القبول والمتطلبات كاملة.",
    de: "Vielen Dank 🎓 \nFür Studienprogramme nennen Sie uns bitte: Wunschfach, bevorzugte Privatuni, Sprache (EN/AR) und gewünschten Starttermin. Wir begleiten Sie durch Zulassung und Anforderungen.",
  },
  medical_aesthetic: {
    en: "Thank you ✨ \nFor Medical & Aesthetic travel, please share (optionally): the procedure/service you’re considering, preferred city, and your timeframe. Your information is handled with full privacy.",
    ar: "شكرًا لك �� \nللسياحة العلاجية والتجميلية، يرجى ذكر (اختياريًا): نوع الإجراء/الخدمة، المدينة المفضلة، والفترة الزمنية. تتم معالجة معلوماتك بسرية تامة.",
    de: "Vielen Dank ✨ \nFür Medizin- & Ästhetikreisen teilen Sie uns bitte (optional) die gewünschte Behandlung, bevorzugte Stadt und den Zeitraum mit. Ihre Daten behandeln wir streng vertraulich.",
  },
  investment: {
    en: "Thank you 📈 \nFor Investment Tourism, please share your sector (real estate, hospitality, trade, etc.), budget range (optional), and timeline. We can arrange visits, meetings, and local guidance.",
    ar: "شكرًا لك 📈 \nللسياحة الاستثمارية، يرجى تزويدنا بمجال الاستثمار (عقارات، ضيافة، تجارة…)، نطاق الميزانية (اختياري)، والمدة الزمنية. نستطيع ترتيب زيارات واجتماعات وإرشاد محلي كامل.",
    de: "Vielen Dank 📈 \nFür Investment-Anfragen nennen Sie uns bitte Branche (Immobilien, Hotel, Handel …), Budgetrahmen (optional) und Zeitplan. Wir organisieren Besichtigungen, Meetings und lokale Betreuung.",
  },
};

export function resolveAutoReplyText(params: { categoryKey?: ChatCategoryKey | null; preferredLanguage?: string | null }): string {
  const langRaw = (params.preferredLanguage ?? '').toLowerCase();
  const lang: LangKey = langRaw === 'ar' || langRaw === 'de' || langRaw === 'en' ? (langRaw as LangKey) : 'en';

  const categoryKey: ChatCategoryKey = (params.categoryKey ?? 'general') || 'general';
  const category = (Object.prototype.hasOwnProperty.call(AUTO_REPLY_TEMPLATES, categoryKey)
    ? categoryKey
    : 'general') as ChatCategoryKey;

  return AUTO_REPLY_TEMPLATES[category][lang];
}
