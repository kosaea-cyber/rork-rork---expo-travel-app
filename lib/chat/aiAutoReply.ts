import { AUTO_REPLIES, type AutoReplyKey } from '@/lib/ai/autoReplies';
import { getAiSettingsCached } from '@/lib/ai/settings';
import { supabase } from '@/lib/supabase/client';
import type { ConversationType, MessageSenderType } from '@/store/chatStore';
import type { Language } from '@/store/i18nStore';

function detectAutoReplyKey(text: string): AutoReplyKey {
  const t = text.toLowerCase();

  const has = (words: string[]) => words.some((w) => t.includes(w));

  if (has(['spa', 'relax', 'wellness', 'حمام', 'سبا', 'استجمام'])) return 'wellness_spa';
  if (has(['study', 'university', 'admission', 'جامعة', 'دراسة'])) return 'study';
  if (has(['medical', 'clinic', 'dentist', 'surgery', 'تجميل', 'علاج', 'أسنان', 'عيادة'])) return 'cosmetic_medical';
  if (has(['invest', 'business', 'real estate', 'استثمار', 'مشروع', 'عقار'])) return 'investment';

  return 'generic';
}

function pickLocalized(lang: Language, variants: { en: string; ar: string; de: string }): string {
  if (lang === 'ar') return variants.ar;
  if (lang === 'de') return variants.de;
  return variants.en;
}

function buildReplyBody(replyKey: AutoReplyKey, lang: Language): string {
  const variants = AUTO_REPLIES[replyKey] ?? AUTO_REPLIES.generic;
  return pickLocalized(lang, variants);
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

    const replyKey = detectAutoReplyKey(userText);
    const body = buildReplyBody(replyKey, language);

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
