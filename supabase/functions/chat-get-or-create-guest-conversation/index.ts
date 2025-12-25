/* eslint-disable import/no-unresolved */
// Supabase Edge Function: chat-get-or-create-guest-conversation
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

type Json = Record<string, unknown>;

type ConversationRow = {
  id: string;
  type: string | null;
  guest_id: string | null;
  customer_id: string | null;
  guest_stage: number | null;
  preferred_language: string | null;
  created_at: string | null;
};

function jsonResponse(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

function normalizeLang(lang: string): 'ar' | 'de' | 'en' {
  const l = (lang || 'de').toLowerCase().trim();
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('en')) return 'en';
  return 'de';
}

function getWelcomeText(lang: 'ar' | 'de' | 'en'): string {
  if (lang === 'ar') {
    return 'أهلًا وسهلًا 👋 يسعدني مساعدتك. قبل ما نبدأ، شو اسمك الكريم؟';
  }
  if (lang === 'en') {
    return "Welcome 👋 I’m happy to help. Before we start, what’s your name?";
  }
  return 'Willkommen 👋 Ich helfe Ihnen gern. Wie darf ich Sie ansprechen?';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: { message: 'Method not allowed', status: 405 } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: { message: 'Missing Supabase env vars', status: 500 } });
  }

  const token = getBearerToken(req);
  if (!token) return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });

  // read preferredLanguage from request body
  let parsed: { preferredLanguage?: unknown } = {};
  try {
    parsed = (await req.json().catch(() => ({}))) as { preferredLanguage?: unknown };
  } catch {
    parsed = {};
  }

  const preferredLanguageRaw =
    typeof parsed.preferredLanguage === 'string' && parsed.preferredLanguage.trim()
      ? parsed.preferredLanguage.trim()
      : 'de';

  const preferredLanguage = normalizeLang(preferredLanguageRaw);

  // Verify user (anon sessions still have a user id)
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse(401, {
      error: { message: 'Invalid token', status: 401, details: userError?.message },
    });
  }

  const userId = userData.user.id;

  // guest_id = anon user id (stable per device/session)
  const guestId = String(userId);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // ✅ IMPORTANT: guest conversation should be PRIVATE (not public)
  const { data: existing, error: existingError } = await service
    .from('conversations')
    .select('id, type, guest_id, customer_id, guest_stage, preferred_language, created_at')
    .eq('type', 'private')
    .eq('guest_id', guestId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    return jsonResponse(500, {
      error: { message: 'Failed to load conversation', status: 500, details: existingError.message },
    });
  }

  let conv = (existing?.[0] ?? null) as ConversationRow | null;

  // Create new conversation if missing
  if (!conv) {
    const { data: inserted, error: insertError } = await service
      .from('conversations')
      .insert({
        type: 'private',
        guest_id: guestId,
        preferred_language: preferredLanguage,
        guest_stage: 0,
        unread_count_admin: 0,
        unread_count_user: 0,
        customer_id: null,
      })
      .select('id, type, guest_id, customer_id, guest_stage, preferred_language, created_at')
      .single();

    if (insertError) {
      return jsonResponse(500, {
        error: { message: 'Failed to create conversation', status: 500, details: insertError.message },
      });
    }

    conv = inserted as ConversationRow;

    // First system message: ask name
    const welcome = getWelcomeText(preferredLanguage);
    await service.from('messages').insert({
      conversation_id: conv.id,
      sender_type: 'system',
      sender_id: null,
      body: welcome,
    });
  } else {
    // Ensure welcome exists if there are no messages yet
    const { data: msgs, error: msgErr } = await service
      .from('messages')
      .select('id')
      .eq('conversation_id', conv.id)
      .limit(1);

    if (!msgErr && (!msgs || msgs.length === 0)) {
      const lang = normalizeLang(conv.preferred_language ?? preferredLanguage);
      const welcome = getWelcomeText(lang);
      await service.from('messages').insert({
        conversation_id: conv.id,
        sender_type: 'system',
        sender_id: null,
        body: welcome,
      });
    }
  }

  return jsonResponse(200, {
    data: {
      id: conv.id,
      type: conv.type ?? 'private',
      guest_id: conv.guest_id,
      customer_id: conv.customer_id,
      guest_stage: conv.guest_stage ?? 0,
      preferred_language: conv.preferred_language ?? preferredLanguage,
      created_at: conv.created_at,
    },
  });
});
