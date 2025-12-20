import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type BookingRow = {
  id: string;
  user_id: string;
  status: BookingStatus;
  notes: string | null;
  package_id: string | null;
  preferred_start_date: string | null;
  preferred_end_date: string | null;
  travelers: number;
  customer_notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CreateBookingPayload = {
  packageId: string;
  preferredStartDate: string;
  preferredEndDate?: string | null;
  travelers: number;
  customerNotes?: string;
};

type StoreError = {
  message: string;
} | null;

async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[bookingStore] auth.getUser error', error.message);
  }

  const userId = data.user?.id ?? '';
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

async function assertAdmin(): Promise<void> {
  const userId = await getAuthedUserId();

  const profileRes = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileRes.error) {
    console.error('[bookingStore] profiles select error', profileRes.error.message);
    throw new Error(profileRes.error.message);
  }

  const role = (profileRes.data?.role ?? 'customer') as 'admin' | 'customer';
  if (role !== 'admin') {
    throw new Error('Admin only');
  }
}

interface BookingState {
  myBookings: BookingRow[];
  adminBookings: BookingRow[];
  isLoading: boolean;
  error: StoreError;

  fetchMyBookings: () => Promise<void>;
  createBooking: (payload: CreateBookingPayload) => Promise<BookingRow | null>;

  fetchAllBookingsForAdmin: () => Promise<void>;
  updateBookingStatusAdmin: (bookingId: string, nextStatus: BookingStatus) => Promise<BookingRow | null>;
}

const bookingSelect =
  'id, user_id, status, notes, package_id, preferred_start_date, preferred_end_date, travelers, customer_notes, created_at, updated_at';

export const useBookingStore = create<BookingState>((set, get) => ({
  myBookings: [],
  adminBookings: [],
  isLoading: false,
  error: null,

  fetchMyBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await getAuthedUserId();
      console.log('[bookingStore] fetchMyBookings', { userId });

      const { data, error } = await supabase
        .from('bookings')
        .select(bookingSelect)
        .eq('user_id', userId)
        .in('status', ['pending', 'confirmed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[bookingStore] fetchMyBookings select error', error.message);
        throw new Error(error.message);
      }

      set({ myBookings: (data ?? []) as BookingRow[], isLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('[bookingStore] fetchMyBookings failed', message);
      set({ isLoading: false, error: { message } });
    }
  },

  createBooking: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const userId = await getAuthedUserId();
      console.log('[bookingStore] createBooking', {
        userId,
        packageId: payload.packageId,
        travelers: payload.travelers,
        preferredStartDate: payload.preferredStartDate,
        preferredEndDate: payload.preferredEndDate ?? null,
        customerNotesLen: payload.customerNotes?.length ?? 0,
      });

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          status: 'pending' as const,
          package_id: payload.packageId,
          preferred_start_date: payload.preferredStartDate,
          preferred_end_date: payload.preferredEndDate ?? null,
          travelers: payload.travelers,
          customer_notes: payload.customerNotes?.trim() ? payload.customerNotes.trim() : null,
        })
        .select(bookingSelect)
        .single();

      if (error) {
        console.error('[bookingStore] createBooking insert error', error.message);
        throw new Error(error.message);
      }

      const created = data as BookingRow;
      set({ myBookings: [created, ...get().myBookings], isLoading: false });
      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('[bookingStore] createBooking failed', message);
      set({ isLoading: false, error: { message } });
      return null;
    }
  },

  fetchAllBookingsForAdmin: async () => {
    set({ isLoading: true, error: null });
    try {
      await assertAdmin();
      console.log('[bookingStore] fetchAllBookingsForAdmin');

      const { data, error } = await supabase
        .from('bookings')
        .select(bookingSelect)
        .in('status', ['pending', 'confirmed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[bookingStore] fetchAllBookingsForAdmin select error', error.message);
        throw new Error(error.message);
      }

      set({ adminBookings: (data ?? []) as BookingRow[], isLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('[bookingStore] fetchAllBookingsForAdmin failed', message);
      set({ isLoading: false, error: { message } });
    }
  },

  updateBookingStatusAdmin: async (bookingId, nextStatus) => {
    set({ isLoading: true, error: null });
    try {
      await assertAdmin();
      console.log('[bookingStore] updateBookingStatusAdmin (edge)', { bookingId, nextStatus });

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      if (!baseUrl) {
        throw new Error('Missing Supabase URL');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[bookingStore] auth.getSession error', sessionError.message);
      }

      const accessToken = sessionData.session?.access_token ?? null;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const url = `${baseUrl.replace(/\/$/, '')}/functions/v1/booking-update-status`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ bookingId, nextStatus }),
      });

      const json = (await res.json().catch(() => null)) as
        | { data?: { booking?: BookingRow | null; conversationId?: string | null } | null; error?: unknown }
        | null;

      if (!res.ok) {
        const msg =
          (json?.error as any)?.message ??
          (typeof (json?.error as any)?.details === 'string' ? (json?.error as any)?.details : null) ??
          `Request failed (${res.status})`;
        console.error('[bookingStore] updateBookingStatusAdmin edge failed', { status: res.status, msg, raw: json });
        throw new Error(msg);
      }

      const updated = (json?.data?.booking ?? null) as BookingRow | null;
      if (!updated) {
        console.error('[bookingStore] updateBookingStatusAdmin edge missing booking', { json });
        throw new Error('Failed to update booking');
      }

      set({
        isLoading: false,
        adminBookings: get().adminBookings.map((b) => (b.id === bookingId ? updated : b)),
        myBookings: get().myBookings.map((b) => (b.id === bookingId ? updated : b)),
      });

      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('[bookingStore] updateBookingStatusAdmin failed', message);
      set({ isLoading: false, error: { message } });
      return null;
    }
  },
}));
