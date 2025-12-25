/* eslint-disable import/no-unresolved */
// Supabase Edge Function: chat-send-message (Guest stages)
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

type Json = Record<string, unknown>;

type ConversationRow = {
  id: string;
  type: string | null; // 'private' | 'public' (we use private for guest)
  customer_id: string | null;
  guest_id: string | null;

  guest_stage: number | null;
  guest_name: string | null;
  guest_phone: string | null;
  preferred_language: string | null;

  unread_count_admin: number | null;
  unread_count_user: number | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'admin' | 'system' | 'ai';
  sender_id: string | null;
  body: string;
  created_at: string | null;
};

// best-effort in-memory cooldown
const cooldownByUserId = new Map<string, number>();

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

function decodeJwtPayload(token: string): Json | null {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Json;
  } catch {
    return null;
  }
}

function getJwtRole(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return typeof role === 'string' && role.trim() ? role : null;
}

function normalizeLang(lang: string | null | undefined): 'de' | 'ar' | 'en' {
  const l = (lang ?? 'de').toLowerCase();
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('en')) return 'en';
  return 'de';
}

function askPhoneText(lang: 'de' | 'ar' | 'en', name: string): string {
  if (lang === 'ar') return `تشرفنا ${name} 😊 ممكن رقم هاتفك للتواصل إذا احتجنا تفاصيل؟`;
  if (lang === 'en') return `Nice to meet you, ${name}! 😊 Could you share your phone number in case we need details?`;
  return `Freut mich, ${name}! 😊 Darf ich bitte Ihre Telefonnummer für Rückfragen?`;
}

function askHelpText(lang: 'de' | 'ar' | 'en'): string {
  if (lang === 'ar') return 'تمام، شكرًا ✅ تفضل كيف فيني ساعدك؟';
  if (lang === 'en') return 'Perfect, thank you! ✅ How can I help you today?';
  return 'Perfekt – danke! ✅ Wie kann ich Ihnen heute helfen?';
}

function safeName(input: string): string {
  const v = input.trim().replace(/\s+/g, ' ');
  if (!v) return '…';
  return v.slice(0, 60);
}

function safePhone(input: string): string {
  // keep + and digits only-ish
  const v = input.trim().replace(/\s+/g, '');
  return v.slice(0, 30);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: { message: 'Method not allowed', status: 405 } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: { message: 'Missing env vars', status: 500 } });
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
  }

  // basic cooldown per anon/auth userId (best-effort)
  const now = Date.now();

  let parsed: { conversationId?: unknown; body?: unknown } = {};
  try {
    parsed = (await req.json()) as { conversationId?: unknown; body?: unknown };
  } catch {
    return jsonResponse(400, { error: { message: 'Invalid JSON body', status: 400 } });
  }

  const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
  const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';

  if (!conversationId) return jsonResponse(400, { error: { message: 'Missing conversationId', status: 400 } });
  if (!body) return jsonResponse(400, { error: { message: 'Message is empty', status: 400 } });
  if (body.length > 2000) return jsonResponse(400, { error: { message: 'Message too long', status: 400 } });

  // auth user (anon also returns a real user id)
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse(401, { error: { message: 'Invalid token', status: 401, details: userError?.message } });
  }

  const userId = userData.user.id;

  // cooldown check now that we know userId
  const last = cooldownByUserId.get(userId) ?? 0;
  if (now - last < 1500) {
    return jsonResponse(429, { error: { message: 'Please wait a moment', status: 429 } });
  }
  cooldownByUserId.set(userId, now);

  const jwtRole = getJwtRole(token);
  const isAdmin = jwtRole === 'admin';

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Load conversation
  const { data: conv, error: convError } = await service
    .from('conversations')
    .select(
      'id, type, customer_id, guest_id, guest_stage, guest_name, guest_phone, preferred_language, unread_count_admin, unread_count_user',
    )
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) {
    return jsonResponse(500, { error: { message: 'Failed to load conversation', status: 500, details: convError.message } });
  }

  const conversation = (conv ?? null) as ConversationRow | null;
  if (!conversation) {
    return jsonResponse(404, { error: { message: 'Conversation not found', status: 404 } });
  }

  const type = (conversation.type ?? '').toLowerCase();

  // ✅ Authorization rules:
  // - Admin can send anywhere (optional)
  // - Guest conversation: type=private AND guest_id == userId (customer_id is null)
  // - Private authenticated user: type=private AND customer_id == userId
  const isGuestConversation = type === 'private' && conversation.guest_id && conversation.guest_id === String(userId);
  const isPrivateOwner = type === 'private' && conversation.customer_id && conversation.customer_id === String(userId);

  if (!isAdmin && !isGuestConversation && !isPrivateOwner) {
    return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });
  }

  // Insert sender message
  // NOTE: for guests we still store sender_id = userId (anon user id) -> helps moderation & threading.
  // If you insist to keep guest sender_id null, tell me and we adjust RLS + UI accordingly.
  const senderType: MessageRow['sender_type'] = isAdmin ? 'admin' : 'user';
  const senderId: string | null = isAdmin ? userId : userId;

  const { data: inserted, error: insertError } = await service
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      body,
    })
    .select('id, conversation_id, sender_type, sender_id, body, created_at')
    .single();

  if (insertError) {
    return jsonResponse(500, { error: { message: 'Insert failed', status: 500, details: insertError.message } });
  }

  // Stage logic only for guest conversations AND only when user is sending (not admin)
  const lang = normalizeLang(conversation.preferred_language);
  const stage = conversation.guest_stage ?? 0;

  if (isGuestConversation && !isAdmin) {
    if (stage === 0) {
      const name = safeName(body);

      await service.from('conversations').update({ guest_name: name, guest_stage: 1 }).eq('id', conversationId);

      await service.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_id: null,
        body: askPhoneText(lang, name),
      });
    } else if (stage === 1) {
      const phone = safePhone(body);

      await service.from('conversations').update({ guest_phone: phone, guest_stage: 2 }).eq('id', conversationId);

      await service.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_id: null,
        body: askHelpText(lang),
      });
    }
  }

  // Update conversation meta + unread counts (count unread for admin when user sends)
  const nowIso = new Date().toISOString();
  const preview = body.length > 80 ? body.slice(0, 80) : body;

  const nextUnreadAdmin = isAdmin ? (conversation.unread_count_admin ?? 0) : (conversation.unread_count_admin ?? 0) + 1;

  await service
    .from('conversations')
    .update({
      last_message_at: nowIso,
      last_message_preview: preview,
      last_sender_type: senderType,
      unread_count_admin: nextUnreadAdmin,
    })
    .eq('id', conversationId);

  return jsonResponse(200, { data: inserted as MessageRow });
});
