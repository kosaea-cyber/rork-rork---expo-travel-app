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
  guest_id: string | null;
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

function getGuestId(req: Request): string | null {
  const raw = req.headers.get('x-guest-id') ?? req.headers.get('X-Guest-Id');
  const guestId = raw?.trim() ?? '';
  if (!guestId) return null;
  if (guestId.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(guestId)) return null;
  return guestId;
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

  const isProtectedMode = mode === 'public_auth' || mode === 'private_user' || mode === 'admin';

  // For protected modes -> JWT required
  if (isProtectedMode && !token) {
    return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
  }

  // For guest mode -> x-guest-id required
  const guestId = mode === 'public_guest' ? getGuestId(req) : null;
  if (mode === 'public_guest' && !guestId) {
    return jsonResponse(400, { error: { message: 'Missing x-guest-id header', status: 400 } });
  }

  // Auth only needed for protected modes
  let userId: string | null = null;

  if (isProtectedMode) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user?.id) {
      return jsonResponse(401, {
        error: { message: 'Invalid token', status: 401, details: userError?.message ?? null },
      });
    }

    userId = userData.user.id;
  }

  // Admin gate
  if (mode === 'admin') {
    const jwtRole = getJwtRole(token ?? '');
    if (jwtRole !== 'admin') {
      return jsonResponse(403, { error: { message: 'Admin only', status: 403 } });
    }
  }

  // Cooldown
  // - Guest: scoped by guestId + IP
  // - Auth: scoped by userId
  const cooldownKey =
    mode === 'public_guest' ? `guest:${guestId ?? 'missing'}:ip:${ip}` : `uid:${userId ?? 'unknown'}`;

  const now = Date.now();
  const last = cooldownByKey.get(cooldownKey) ?? 0;
  if (now - last < 3000) {
    console.log('[chat-send-message] rate limit hit', { mode, cooldownKey });
    return jsonResponse(429, { error: { message: 'Please wait a moment', status: 429 } });
  }
  cooldownByKey.set(cooldownKey, now);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Load conversation (include guest_id)
  const { data: conv, error: convError } = await serviceClient
    .from('conversations')
    .select('id, type, customer_id, guest_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) {
    return jsonResponse(500, {
      error: { message: 'Failed to load conversation', status: 500, details: convError.message },
    });
  }

  const conversation = (conv ?? null) as ConversationRow | null;
  if (!conversation) {
    return jsonResponse(404, { error: { message: 'Conversation not found', status: 404 } });
  }

  // Mode → conversation validation
  // 1) public_auth must be public
  if (mode === 'public_auth') {
    if (conversation.type !== 'public') {
      return jsonResponse(400, { error: { message: 'Conversation is not public', status: 400 } });
    }
  }

  // 2) private_user must be private and owned by user
  if (mode === 'private_user') {
    if (conversation.type !== 'private') {
      return jsonResponse(400, { error: { message: 'Conversation is not private', status: 400 } });
    }
    if (!userId || conversation.customer_id !== userId) {
      return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });
    }
  }

  // 3) admin can send to any conversation
  //    (optional extra: ensure conversation exists already - done above)

  // 4) public_guest:
  //    - allowed to send to:
  //       a) public conversation (shared)
  //       b) private guest conversation where conversation.guest_id matches x-guest-id
  if (mode === 'public_guest') {
    if (conversation.type === 'public') {
      // ok
    } else {
      // must be private guest conversation
      if (conversation.type !== 'private') {
        return jsonResponse(400, { error: { message: 'Invalid conversation type', status: 400 } });
      }
      if (!guestId || !conversation.guest_id || conversation.guest_id !== guestId) {
        return jsonResponse(403, { error: { message: 'Not allowed (guest mismatch)', status: 403 } });
      }
      // Also ensure no customer_id is set for guest conversation (optional safety)
      // If you allow linking guest -> real user later, you can remove this.
      // if (conversation.customer_id) return jsonResponse(403, { error: { message: 'Guest chat is not available here', status: 403 } });
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

  // Update conversation meta (non-fatal)
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
