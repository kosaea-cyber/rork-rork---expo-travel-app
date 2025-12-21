export type AutoReplyKey =
  | 'generic'
  | 'wellness_spa'
  | 'study'
  | 'cosmetic_medical'
  | 'investment';

export type LocalizedAutoReply = { ar: string; en: string; de: string };

export const AUTO_REPLIES: Record<AutoReplyKey, LocalizedAutoReply> = {
  generic: {
    ar: `مرحباً بك 👋
يسعدنا مساعدتك في تنظيم رحلتك إلى سوريا بشكل راقٍ. هل تفضل: استجمام وSPA، تجميلية/علاجية، دراسية أم استثمارية؟
واذكر لنا المدينة المفضلة وتاريخ السفر إن أمكن.`,
    en: `Welcome 👋
We’d love to help you plan an elite trip to Syria. Which service are you interested in: Wellness & SPA, Cosmetic/Medical, Study, or Investment?
Also tell us your preferred city and travel dates if possible.`,
    de: `Willkommen 👋
Wir helfen dir gern bei deiner exklusiven Reise nach Syrien. Wofür interessierst du dich: Wellness & SPA, Kosmetisch/Medizinisch, Studium, oder Investment?
Nenne uns bitte auch deine Wunschstadt und Reisedaten, wenn möglich.`,
  },
  wellness_spa: {
    ar: `رائع ✨ لدينا باقات استجمام وSPA تشمل الاستقبال من المطار، الفندق، جلسات سبا/حمّام، جولات خفيفة، وخدمة مرافق عند الحاجة.
هل تفضل دمشق أم الساحل (اللاذقية/طرطوس)؟ وكم عدد الأشخاص؟`,
    en: `Great ✨ We offer Wellness & SPA packages including airport pickup, hotel stay, spa/hamam sessions, light city experiences, and optional personal assistance.
Do you prefer Damascus or the coast (Latakia/Tartous)? How many travelers?`,
    de: `Super ✨ Wir bieten Wellness & SPA-Pakete inkl. Abholung am Flughafen, Hotel, Spa/Hamam, leichte Ausflüge und optionaler persönlicher Begleitung.
Bevorzugst du Damaskus oder die Küste (Latakia/Tartous)? Wie viele Personen?`,
  },
  study: {
    ar: `ممتاز 🎓 نساعدك في السياحة الدراسية: اختيار الجامعة الخاصة المناسبة، تجهيز الأوراق، القبول، السكن، الاستقبال من المطار، والمتابعة بعد الوصول.
ما التخصص الذي تريده؟ وما اللغة المفضلة للدراسة؟`,
    en: `Excellent 🎓 We support Study Tourism: selecting the best private university, document preparation, admission steps, housing, airport pickup, and post-arrival guidance.
Which major are you interested in? And what’s your preferred study language?`,
    de: `Sehr gut 🎓 Wir unterstützen Studienreisen: passende private Universität, Unterlagen, Zulassung, Unterkunft, Abholung vom Flughafen und Betreuung nach der Ankunft.
Welches Fach interessiert dich? Und welche Unterrichtssprache bevorzugst du?`,
  },
  cosmetic_medical: {
    ar: `أهلاً بك 🌿 لدينا سياحة تجميلية وعلاجية تشمل ترتيب المواعيد مع العيادات/الأطباء، التنقلات، المرافقة، والمتابعة قبل وبعد الإجراء.
هل تبحث عن تجميل (أسنان/جلدية/تجميل) أم علاج طبي؟ وهل ترغب ببرنامج استجمام مكمّل؟`,
    en: `Welcome 🌿 We provide Cosmetic & Medical Tourism: clinic/doctor scheduling, transportation, assistance, and follow-up before/after the procedure.
Are you looking for cosmetic (dental/derma/aesthetic) or medical treatment? Would you like a wellness add-on?`,
    de: `Willkommen 🌿 Wir bieten Kosmetik- & Medizintourismus: Terminorganisation, Transport, Begleitung und Nachbetreuung vor/nach dem Eingriff.
Geht es um Kosmetik (Zähne/Haut/Ästhetik) oder medizinische Behandlung? Möchtest du Wellness als Zusatz?`,
  },
  investment: {
    ar: `ممتاز 💼 نقدم سياحة استثمارية تشمل جولات ميدانية، ترتيب لقاءات، ترجمة/مرافقة، وتجهيز ملف أولي لفهم الفرص والبيئة الاستثمارية.
ما نوع الاستثمار الذي تفكر فيه (عقارات/فندق/تجارة/صناعة)؟ وما مدة زيارتك المتوقعة؟`,
    en: `Great 💼 We offer Investment Tourism: on-ground visits, arranged meetings, translation/assistance, and a preliminary brief to understand opportunities and market context.
What type of investment are you considering (real estate/hospitality/trade/industry)? How long is your visit?`,
    de: `Sehr gut 💼 Wir bieten Investment-Tourismus: Vor-Ort-Besichtigungen, organisierte Termine, Übersetzung/Begleitung und ein erstes Briefing zu Chancen und Rahmenbedingungen.
Welche Investment-Art planst du (Immobilien/Hotel/Handel/Industrie)? Wie lange willst du bleiben?`,
  },
};
