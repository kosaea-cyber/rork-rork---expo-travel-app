/* eslint-disable import/no-unresolved */
// Supabase Edge Function: chat-send-message
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

type SendMode = 'public_guest' | 'public_auth' | 'private_user' | 'admin';

type Json = Record<string, unknown>;

type ConversationRow = {
  id: string;
  type: 'public' | 'private';
  customer_id: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'admin' | 'system' | 'ai';
  sender_id: string | null;
  body: string;
  created_at: string | null;
};

const cooldownByKey = new Map<string, number>();

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

function getClientIp(req: Request): string {
  // best-effort behind proxies
  const xf = req.headers.get('x-forwarded-for') ?? req.headers.get('X-Forwarded-For');
  if (xf) return xf.split(',')[0]?.trim() ?? 'unknown';
  const cf = req.headers.get('cf-connecting-ip') ?? req.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  return 'unknown';
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

  let parsed: { conversationId?: unknown; body?: unknown; mode?: unknown };
  try {
    parsed = (await req.json()) as { conversationId?: unknown; body?: unknown; mode?: unknown };
  } catch {
    return jsonResponse(400, { error: { message: 'Invalid JSON body', status: 400 } });
  }

  const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
  const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
  const mode = parsed.mode as SendMode;

  if (!conversationId) {
    return jsonResponse(400, { error: { message: 'Missing conversationId', status: 400 } });
  }
  if (!body) {
    return jsonResponse(400, { error: { message: 'Message is empty', status: 400 } });
  }
  if (body.length > 2000) {
    return jsonResponse(400, { error: { message: 'Message too long', status: 400 } });
  }

  const allowedModes: SendMode[] = ['public_guest', 'public_auth', 'private_user', 'admin'];
  if (!allowedModes.includes(mode)) {
    return jsonResponse(400, { error: { message: 'Invalid mode', status: 400 } });
  }

  const token = getBearerToken(req);
  const ip = getClientIp(req);

  // Auth only needed for non-guest modes
  let userId: string | null = null;

  if (mode !== 'public_guest') {
    if (!token) {
      return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user?.id) {
      return jsonResponse(401, { error: { message: 'Invalid token', status: 401, details: userError?.message } });
    }

    userId = userData.user.id;
  }

  // Admin gate
  if (mode === 'admin') {
    if (!token) return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
    const jwtRole = getJwtRole(token);
    if (jwtRole !== 'admin') {
      return jsonResponse(403, { error: { message: 'Admin only', status: 403 } });
    }
  }

  // Cooldown: per user for auth modes, per IP for guest mode
  const cooldownKey = mode === 'public_guest' ? `ip:${ip}` : `uid:${userId ?? 'unknown'}`;
  const now = Date.now();
  const last = cooldownByKey.get(cooldownKey) ?? 0;
  if (now - last < 3000) {
    return jsonResponse(429, { error: { message: 'Please wait a moment', status: 429 } });
  }
  cooldownByKey.set(cooldownKey, now);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Load conversation
  const { data: conv, error: convError } = await serviceClient
    .from('conversations')
    .select('id, type, customer_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) {
    return jsonResponse(500, { error: { message: 'Failed to load conversation', status: 500, details: convError.message } });
  }

  const conversation = (conv ?? null) as ConversationRow | null;
  if (!conversation) {
    return jsonResponse(404, { error: { message: 'Conversation not found', status: 404 } });
  }

  // Mode → conversation validation
  if ((mode === 'public_guest' || mode === 'public_auth') && conversation.type !== 'public') {
    return jsonResponse(400, { error: { message: 'Conversation is not public', status: 400 } });
  }

  if (mode === 'private_user') {
    if (conversation.type !== 'private') {
      return jsonResponse(400, { error: { message: 'Conversation is not private', status: 400 } });
    }
    if (!userId || conversation.customer_id !== userId) {
      return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });
    }
  }

  // Insert message
  const senderType: MessageRow['sender_type'] = mode === 'admin' ? 'admin' : 'user';
  const senderId: string | null = mode === 'public_guest' ? null : userId;

  const { data: inserted, error: insertError } = await serviceClient
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

  // Non-fatal: update conversation meta (you also have a trigger already)
  const nowIso = new Date().toISOString();
  const preview = body.length > 80 ? body.slice(0, 80) : body;

  const { error: updateError } = await serviceClient
    .from('conversations')
    .update({ last_message_at: nowIso, last_message_preview: preview, last_sender_type: senderType })
    .eq('id', conversationId);

  if (updateError) {
    console.log('[chat-send-message] conversation update failed', updateError.message);
  }

  return jsonResponse(200, { data: inserted as MessageRow });
});
