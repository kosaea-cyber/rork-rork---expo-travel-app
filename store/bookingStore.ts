import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type BookingRow = {
  id: string;
  user_id: string | null;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;

  package_id: string | null;
  preferred_start_date: string | null; // YYYY-MM-DD
  preferred_end_date: string | null; // YYYY-MM-DD
  travelers: number;
  customer_notes: string | null;
};

// بيانات إضافية للأدمن (من join)
export type AdminBookingRow = BookingRow & {
  customer: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    preferred_language: 'en' | 'ar' | 'de' | null;
  } | null;
  pkg: {
    title_de: string | null;
    title_en: string | null;
    title_ar: string | null;
    price_amount: number | null;
    price_currency: string | null;
  } | null;
};

export type CreateBookingPayload = {
  packageId: string;
  preferredStartDate: string; // YYYY-MM-DD
  preferredEndDate: string; // YYYY-MM-DD
  travelers: number;
  customerNotes?: string | null;
};

type StoreError = { message: string } | null;

async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) console.error('[bookingStore] auth.getUser error', error.message);
  const userId = data.user?.id ?? '';
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

async function assertAdmin(): Promise<void> {
  const userId = await getAuthedUserId();

  const profileRes = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();

  if (profileRes.error) throw new Error(profileRes.error.message);

  const role = (profileRes.data?.role ?? 'customer') as 'admin' | 'customer';
  if (role !== 'admin') throw new Error('Admin only');
}

/**
 * ✅ Supabase joins often return arrays (even for many-to-one)
 * so we normalize customer/pkg to single object or null.
 */
type AdminBookingJoinRow = BookingRow & {
  customer:
    | {
        full_name: string | null;
        phone: string | null;
        email: string | null;
        preferred_language: 'en' | 'ar' | 'de' | null;
      }[]
    | null;

  pkg:
    | {
        title_de: string | null;
        title_en: string | null;
        title_ar: string | null;
        price_amount: number | null;
        price_currency: string | null;
      }[]
    | null;
};

function normalizeAdminBookingRow(row: AdminBookingJoinRow): AdminBookingRow {
  return {
    ...row,
    customer: row.customer?.[0] ?? null,
    pkg: row.pkg?.[0] ?? null,
  };
}

interface BookingState {
  myBookings: BookingRow[];
  adminBookings: AdminBookingRow[];
  isLoading: boolean;
  error: StoreError;

  fetchMyBookings: () => Promise<void>;
  createBooking: (payload: CreateBookingPayload) => Promise<BookingRow | null>;

  adminFetchAllBookings: () => Promise<void>;
  adminFetchBookingById: (id: string) => Promise<AdminBookingRow | null>;

  updateBookingStatus: (id: string, status: BookingStatus) => Promise<BookingRow | null>;
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

      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, user_id, status, notes, created_at, updated_at, package_id, preferred_start_date, preferred_end_date, travelers, customer_notes',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      set({ myBookings: (data ?? []) as BookingRow[], isLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, error: { message } });
    }
  },

  createBooking: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const userId = await getAuthedUserId();

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          status: 'pending',
          package_id: payload.packageId,
          preferred_start_date: payload.preferredStartDate,
          preferred_end_date: payload.preferredEndDate,
          travelers: payload.travelers,
          customer_notes: payload.customerNotes ?? null,
          notes: null,
        })
        .select(
          'id, user_id, status, notes, created_at, updated_at, package_id, preferred_start_date, preferred_end_date, travelers, customer_notes',
        )
        .single();

      if (error) throw new Error(error.message);

      const created = data as BookingRow;
      set({ myBookings: [created, ...get().myBookings], isLoading: false });
      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, error: { message } });
      return null;
    }
  },

  adminFetchAllBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      await assertAdmin();

      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          id, user_id, status, notes, created_at, updated_at,
          package_id, preferred_start_date, preferred_end_date, travelers, customer_notes,
          customer:profiles!bookings_user_id_fkey(full_name, phone, email, preferred_language),
          pkg:packages!bookings_package_id_fkey(title_de, title_en, title_ar, price_amount, price_currency)
        `,
        )
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as AdminBookingJoinRow[];
      set({ adminBookings: rows.map(normalizeAdminBookingRow), isLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, error: { message } });
    }
  },

  adminFetchBookingById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await assertAdmin();

      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          id, user_id, status, notes, created_at, updated_at,
          package_id, preferred_start_date, preferred_end_date, travelers, customer_notes,
          customer:profiles!bookings_user_id_fkey(full_name, phone, email, preferred_language),
          pkg:packages!bookings_package_id_fkey(title_de, title_en, title_ar, price_amount, price_currency)
        `,
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);

      set({ isLoading: false });

      if (!data) return null;

      const normalized = normalizeAdminBookingRow(data as AdminBookingJoinRow);
      return normalized;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, error: { message } });
      return null;
    }
  },

  updateBookingStatus: async (id, status) => {
    set({ isLoading: true, error: null });
    try {
      await assertAdmin();

      const { data, error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id)
        .select(
          'id, user_id, status, notes, created_at, updated_at, package_id, preferred_start_date, preferred_end_date, travelers, customer_notes',
        )
        .single();

      if (error) throw new Error(error.message);

      const updated = data as BookingRow;

      set({
        isLoading: false,
        adminBookings: get().adminBookings.map((b) =>
          b.id === id
            ? ({
                ...b,
                ...updated,
              } as AdminBookingRow)
            : b,
        ),
        myBookings: get().myBookings.map((b) => (b.id === id ? updated : b)),
      });

      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, error: { message } });
      return null;
    }
  },
}));
