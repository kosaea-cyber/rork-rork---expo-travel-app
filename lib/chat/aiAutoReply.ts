import { supabase } from '@/lib/supabase/client';
import { getAiSettingsCached } from '@/lib/ai/settings';
import type { ConversationType, MessageSenderType } from '@/store/chatStore';
import type { Language } from '@/store/i18nStore';

type Intent = 'spa_relax' | 'study' | 'cosmetic_medical' | 'investment' | 'general';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();

  const has = (words: string[]) => words.some((w) => t.includes(w));

  if (has(['spa', 'relax', 'massage', 'wellness', 'استجمام', 'سبا', 'مساج', 'relaxation'])) return 'spa_relax';
  if (has(['study', 'university', 'school', 'student', 'education', 'دراسة', 'جامع', 'جامعة', 'تعليم'])) return 'study';
  if (
    has([
      'cosmetic',
      'aesthetic',
      'medical',
      'surgery',
      'clinic',
      'doctor',
      'تجميل',
      'علاج',
      'طبي',
      'عملية',
      'عيادة',
    ])
  )
    return 'cosmetic_medical';
  if (has(['investment', 'invest', 'business', 'company', 'partner', 'استثمار', 'أعمال', 'شركة', 'شراكة']))
    return 'investment';

  return 'general';
}

function pickLocalized(lang: Language, variants: { en: string; ar: string; de: string }): string {
  if (lang === 'ar') return variants.ar;
  if (lang === 'de') return variants.de;
  return variants.en;
}

function buildReplyBody(intent: Intent, lang: Language): string {
  if (intent === 'spa_relax') {
    return pickLocalized(lang, {
      en: 'We can help with Wellness & Relaxation (سياحة استجمام و spa). Do you prefer a luxury spa day or a multi-day wellness package?',
      ar: 'نقدر نساعدك في سياحة الاستجمام و spa. هل تفضّل يوم سبا فاخر أم باقة استجمام لعدة أيام؟',
      de: 'Wir helfen gerne bei Wellness & Entspannung (سياحة استجمام و spa). Möchten Sie eher einen Luxus-Spa-Tag oder ein mehrtägiges Wellness-Paket?',
    });
  }

  if (intent === 'study') {
    return pickLocalized(lang, {
      en: 'Great — we offer Study Tourism (سياحة دراسية). Which level are you interested in (university / courses), and when do you plan to start?',
      ar: 'ممتاز — لدينا سياحة دراسية. ما المستوى الذي تبحث عنه (جامعة/دورات) ومتى ترغب بالبدء؟',
      de: 'Super — wir bieten Studientourismus (سياحة دراسية). Für welches Niveau interessieren Sie sich (Uni/Kurse) und wann möchten Sie starten?',
    });
  }

  if (intent === 'cosmetic_medical') {
    return pickLocalized(lang, {
      en: 'We can assist with Medical & Aesthetic Tourism (سياحة تجميلية وعلاجية). What service are you looking for, and do you have preferred dates?',
      ar: 'نقدر نساعدك في السياحة التجميلية والعلاجية. ما الخدمة المطلوبة وهل لديك تواريخ مفضلة؟',
      de: 'Wir unterstützen bei medizinischem & ästhetischem Tourismus (سياحة تجميلية وعلاجية). Welche Leistung möchten Sie, und haben Sie Wunschtermine?',
    });
  }

  if (intent === 'investment') {
    return pickLocalized(lang, {
      en: 'We can guide you for Investment Tourism (سياحة استثمارية). What sector are you interested in, and what is your approximate budget range?',
      ar: 'نقدر نرشدك في سياحة استثمارية. ما القطاع الذي تهتم به وما هو نطاق الميزانية التقريبي؟',
      de: 'Wir begleiten Sie beim Investment-Tourismus (سياحة استثمارية). Für welchen Sektor interessieren Sie sich und in welcher Budget-Spanne?',
    });
  }

  return pickLocalized(lang, {
    en: "Welcome to Ruwasi Elite Travel. What type of trip do you want (wellness / medical / study / investment)? And what dates are you considering?",
    ar: 'أهلاً بك في رواسي إليت للسفر. أي نوع رحلة تريد (استجمام/علاج/دراسة/استثمار)؟ وما هي التواريخ المناسبة لك؟',
    de: 'Willkommen bei Ruwasi Elite Travel. Welche Art von Reise wünschen Sie (Wellness/Medizin/Studium/Investment) und welche Daten kommen in Frage?',
  });
}

export async function maybeSendAiAutoReply(params: {
  conversationId: string;
  conversationType: ConversationType;
  userText: string;
  language: Language;
}): Promise<void> {
  const { conversationId, conversationType, userText, language } = params;

  try {
    console.log('[ai][autoReply] evaluate', {
      conversationId,
      conversationType,
      language,
      userTextLen: userText.length,
    });

    const settings = await getAiSettingsCached();

    console.log('[ai][autoReply] settings', {
      enabled: settings.enabled,
      mode: settings.mode,
      allow_public: settings.allow_public,
      allow_private: settings.allow_private,
    });

    if (settings.enabled !== true) return;
    if (settings.mode !== 'auto_reply') return;
    if (conversationType === 'public' && settings.allow_public !== true) return;
    if (conversationType === 'private' && settings.allow_private !== true) return;

    const intent = detectIntent(userText);
    const body = buildReplyBody(intent, language);

    const senderType: MessageSenderType = 'system';
    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: null,
      body,
    });

    if (insertError) {
      console.error('[ai][autoReply] insert failed', insertError);
      return;
    }

    const { error: convUpdateError } = await supabase
      .from('conversations')
      .update({ last_message_at: nowIso })
      .eq('id', conversationId);

    if (convUpdateError) {
      console.warn('[ai][autoReply] last_message_at update failed (non-fatal)', convUpdateError);
    }
  } catch (e) {
    console.error('[ai][autoReply] unexpected error', e);
  }
}
