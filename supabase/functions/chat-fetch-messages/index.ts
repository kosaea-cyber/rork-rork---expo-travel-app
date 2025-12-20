/* eslint-disable import/no-unresolved */
// Supabase Edge Function: chat-fetch-messages
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

  let parsed: { conversationId?: unknown; limit?: unknown; before?: unknown; mode?: unknown };
  try {
    parsed = (await req.json()) as { conversationId?: unknown; limit?: unknown; before?: unknown; mode?: unknown };
  } catch {
    return jsonResponse(400, { error: { message: 'Invalid JSON body', status: 400 } });
  }

  const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
  const limitRaw = typeof parsed.limit === 'number' ? parsed.limit : Number(parsed.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, limitRaw)) : 30;
  const before = typeof parsed.before === 'string' ? parsed.before.trim() : '';
  const mode = parsed.mode as SendMode;

  if (!conversationId) return jsonResponse(400, { error: { message: 'Missing conversationId', status: 400 } });

  const allowedModes: SendMode[] = ['public_guest', 'public_auth', 'private_user', 'admin'];
  if (!allowedModes.includes(mode)) return jsonResponse(400, { error: { message: 'Invalid mode', status: 400 } });

  const token = getBearerToken(req);
  const isProtectedMode = mode === 'public_auth' || mode === 'private_user' || mode === 'admin';

  if (isProtectedMode && !token) {
    return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
  }

  const guestId = mode === 'public_guest' ? getGuestId(req) : null;
  if (mode === 'public_guest' && !guestId) {
    return jsonResponse(400, { error: { message: 'Missing x-guest-id header', status: 400 } });
  }

  // Auth only for protected modes
  let userId: string | null = null;

  if (isProtectedMode) {
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
    const jwtRole = getJwtRole(token ?? '');
    if (jwtRole !== 'admin') {
      return jsonResponse(403, { error: { message: 'Admin only', status: 403 } });
    }
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Load conversation (includes guest_id)
  const { data: conv, error: convError } = await serviceClient
    .from('conversations')
    .select('id, type, customer_id, guest_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) {
    return jsonResponse(500, { error: { message: 'Failed to load conversation', status: 500, details: convError.message } });
  }

  const conversation = (conv ?? null) as ConversationRow | null;
  if (!conversation) return jsonResponse(404, { error: { message: 'Conversation not found', status: 404 } });

  // Mode → conversation validation
  if ((mode === 'public_guest' || mode === 'public_auth') && conversation.type !== 'public') {
    // If you use private guest conversations (type=private with guest_id), keep this relaxed check:
    // Allow guest to read private only if guest_id matches.
    // We will handle below.
  }

  if (mode === 'private_user') {
    if (conversation.type !== 'private') return jsonResponse(400, { error: { message: 'Conversation is not private', status: 400 } });
    if (!userId || conversation.customer_id !== userId) return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });
  }

  // Guest access: allow reading only if guest_id matches (for private guest conversations)
  if (mode === 'public_guest' && conversation.type === 'private') {
    if (!guestId || conversation.guest_id !== guestId) {
      return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });
    }
  }

  // Fetch messages
  let q = serviceClient
    .from('messages')
    .select('id, conversation_id, sender_type, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) q = q.lt('created_at', before);

  const { data: rows, error: msgError } = await q;

  if (msgError) {
    return jsonResponse(500, { error: { message: 'Failed to load messages', status: 500, details: msgError.message } });
  }

  return jsonResponse(200, { data: (rows ?? []) as MessageRow[] });
});
