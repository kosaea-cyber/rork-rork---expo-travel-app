/* eslint-disable import/no-unresolved */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

type BookingStatus = 'confirmed' | 'cancelled';

type Json = Record<string, unknown>;

type BookingRow = {
  id: string;
  user_id: string;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ConversationRow = {
  id: string;
  type: 'public' | 'private';
  customer_id: string | null;
  created_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_type: string | null;
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

function extractPreferredStartDate(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Preferred start date:\s*(.+)/i);
  const raw = m?.[1]?.trim() ?? '';
  return raw ? raw : null;
}

function buildSystemMessage(status: BookingStatus, bookingId: string, preferredStart: string | null): string {
  if (status === 'confirmed') {
    const when = preferredStart ? preferredStart : 'your requested date/time';
    return `✅ Your booking ${bookingId} has been confirmed for ${when}.`;
  }
  return `❌ Your booking ${bookingId} has been cancelled. Please contact support if this is unexpected.`;
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

  let parsed: { bookingId?: unknown; nextStatus?: unknown };
  try {
    parsed = (await req.json()) as { bookingId?: unknown; nextStatus?: unknown };
  } catch {
    return jsonResponse(400, { error: { message: 'Invalid JSON body', status: 400 } });
  }

  const bookingId = typeof parsed.bookingId === 'string' ? parsed.bookingId.trim() : '';
  const nextStatus = parsed.nextStatus as BookingStatus;

  if (!bookingId) {
    return jsonResponse(400, { error: { message: 'Missing bookingId', status: 400 } });
  }

  if (nextStatus !== 'confirmed' && nextStatus !== 'cancelled') {
    return jsonResponse(400, { error: { message: 'Invalid nextStatus', status: 400 } });
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse(401, { error: { message: 'Missing bearer token', status: 401 } });
  }

  const role = getJwtRole(token);
  if (role !== 'admin') {
    return jsonResponse(403, { error: { message: 'Admin only', status: 403 } });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse(401, { error: { message: 'Invalid token', status: 401, details: userError?.message } });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log('[booking-update-status] request', { bookingId, nextStatus, adminUserId: userData.user.id });

  const { data: booking, error: bookingError } = await serviceClient
    .from('bookings')
    .select('id, user_id, status, notes, created_at, updated_at')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    return jsonResponse(500, { error: { message: 'Failed to load booking', status: 500, details: bookingError.message } });
  }

  const bookingRow = (booking ?? null) as BookingRow | null;
  if (!bookingRow) {
    return jsonResponse(404, { error: { message: 'Booking not found', status: 404 } });
  }

  const { data: updatedBooking, error: updateError } = await serviceClient
    .from('bookings')
    .update({ status: nextStatus })
    .eq('id', bookingId)
    .select('id, user_id, status, notes, created_at, updated_at')
    .single();

  if (updateError) {
    return jsonResponse(500, { error: { message: 'Failed to update booking', status: 500, details: updateError.message } });
  }

  const updated = updatedBooking as BookingRow;

  const userId = updated.user_id;
  if (!userId) {
    return jsonResponse(500, { error: { message: 'Booking user_id missing', status: 500 } });
  }

  const { data: existingConvs, error: convError } = await serviceClient
    .from('conversations')
    .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type')
    .eq('type', 'private')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (convError) {
    return jsonResponse(500, { error: { message: 'Failed to load conversation', status: 500, details: convError.message } });
  }

  let conversation = (existingConvs?.[0] ?? null) as ConversationRow | null;

  if (!conversation) {
    const { data: createdConv, error: createConvError } = await serviceClient
      .from('conversations')
      .insert({ type: 'private', customer_id: userId })
      .select('id, type, customer_id, created_at, last_message_at, last_message_preview, last_sender_type')
      .single();

    if (createConvError) {
      return jsonResponse(500, {
        error: { message: 'Failed to create conversation', status: 500, details: createConvError.message },
      });
    }

    conversation = createdConv as ConversationRow;
  }

  const conversationId = conversation.id;

  const preferredStart = extractPreferredStartDate(updated.notes);
  const messageBody = buildSystemMessage(nextStatus, updated.id, preferredStart);

  const { data: insertedMessage, error: msgError } = await serviceClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'system',
      sender_id: null,
      body: messageBody,
    })
    .select('id')
    .single();

  if (msgError) {
    return jsonResponse(500, { error: { message: 'Failed to insert message', status: 500, details: msgError.message } });
  }

  const nowIso = new Date().toISOString();
  const preview = messageBody.length > 120 ? messageBody.slice(0, 120) : messageBody;

  const { error: convUpdateError } = await serviceClient
    .from('conversations')
    .update({ last_message_at: nowIso, last_message_preview: preview, last_sender_type: 'system' })
    .eq('id', conversationId);

  if (convUpdateError) {
    console.log('[booking-update-status] conversation update failed', convUpdateError.message);
  }

  console.log('[booking-update-status] done', { bookingId, nextStatus, conversationId, insertedMessageId: insertedMessage?.id ?? null });

  return jsonResponse(200, { data: { booking: updated, conversationId } });
});
