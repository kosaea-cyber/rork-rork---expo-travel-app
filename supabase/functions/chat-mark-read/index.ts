/* eslint-disable import/no-unresolved */
// Supabase Edge Function: chat-mark-read
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

type Json = Record<string, unknown>;

function jsonResponse(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: { message: 'Method not allowed', status: 405 } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse(500, { error: { message: 'Missing env vars', status: 500 } });

  const token = getBearerToken(req);
  if (!token) return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });

  let parsed: { conversationId?: unknown; target?: unknown } = {};
  try {
    parsed = (await req.json()) as { conversationId?: unknown; target?: unknown };
  } catch {
    return jsonResponse(400, { error: { message: 'Invalid JSON body', status: 400 } });
  }

  const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
  const target = typeof parsed.target === 'string' ? parsed.target.trim() : 'user'; // user | admin
  if (!conversationId) return jsonResponse(400, { error: { message: 'Missing conversationId', status: 400 } });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.id) return jsonResponse(401, { error: { message: 'Invalid token', status: 401 } });

  const userId = userData.user.id;

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: conv, error: convError } = await service
    .from('conversations')
    .select('id, type, customer_id, guest_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) return jsonResponse(500, { error: { message: 'Failed to load conversation', status: 500 } });
  if (!conv) return jsonResponse(404, { error: { message: 'Conversation not found', status: 404 } });

  const isAdmin = (authClient.auth as any) ? false : false; // not used
  const isAllowed =
    ((conv.type === 'public' && conv.guest_id === String(userId)) || (conv.type === 'private' && conv.customer_id === String(userId)));

  if (!isAllowed) return jsonResponse(403, { error: { message: 'Not allowed', status: 403 } });

  if (target === 'admin') {
    await service.from('conversations').update({ unread_count_admin: 0 }).eq('id', conversationId);
  } else {
    await service.from('conversations').update({ unread_count_user: 0 }).eq('id', conversationId);
  }

  return jsonResponse(200, { ok: true });
});
