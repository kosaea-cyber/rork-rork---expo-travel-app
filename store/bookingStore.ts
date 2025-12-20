import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type BookingRow = {
  id: string;
  user_id: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CreateBookingPayload = {
  notes: string;
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
        .select('id, user_id, status, notes, created_at, updated_at')
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
      console.log('[bookingStore] createBooking', { userId, notesLen: payload.notes.length });

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          status: 'pending' as const,
          notes: payload.notes,
        })
        .select('id, user_id, status, notes, created_at, updated_at')
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
        .select('id, user_id, status, notes, created_at, updated_at')
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
      console.log('[bookingStore] updateBookingStatusAdmin', { bookingId, nextStatus });

      const { data, error } = await supabase
        .from('bookings')
        .update({ status: nextStatus })
        .eq('id', bookingId)
        .select('id, user_id, status, notes, created_at, updated_at')
        .single();

      if (error) {
        console.error('[bookingStore] updateBookingStatusAdmin update error', error.message);
        throw new Error(error.message);
      }

      const updated = data as BookingRow;
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
