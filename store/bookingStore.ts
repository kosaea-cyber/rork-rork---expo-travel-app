import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { Booking } from '@/lib/db/types';

type BookingInsertInput = Omit<Booking, 'id' | 'status' | 'createdAt' | 'reference'>;

type BookingRow = {
  id: string;
  reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  package_id: string | null;
  package_title: string | null;
  service_category_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number | null;
  notes: string | null;
  created_at: string | null;
  type: string | null;
};

function mapBookingRow(row: BookingRow): Booking {
  return {
    id: row.id,
    reference: row.reference ?? '',
    customerId: row.customer_id ?? '',
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    packageId: row.package_id ?? undefined,
    packageTitle: row.package_title ?? undefined,
    serviceCategoryId: row.service_category_id ?? '',
    status: (row.status ?? 'pending') as Booking['status'],
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    travelers: row.travelers ?? 0,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? '',
    type: row.type ?? undefined,
  };
}

function makeReference(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BK-${y}${m}${d}-${rand}`;
}

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  addBooking: (bookingData: BookingInsertInput) => Promise<void>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  fetchBookings: (customerId?: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,

  addBooking: async (data) => {
    set({ isLoading: true });
    try {
      console.log('[bookingStore] addBooking', {
        packageId: data.packageId ?? null,
        serviceCategoryId: data.serviceCategoryId,
      });

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[bookingStore] auth.getUser error', authError);
      }

      const customerId = authData.user?.id ?? '';
      if (!customerId) {
        throw new Error('Not authenticated');
      }

      const reference = makeReference();

      const insertPayload: Partial<BookingRow> & {
        reference: string;
        customer_id: string;
        service_category_id: string;
        status: 'pending';
        start_date: string;
        end_date: string;
        travelers: number;
      } = {
        reference,
        customer_id: customerId,
        service_category_id: data.serviceCategoryId,
        status: 'pending',
        start_date: data.startDate,
        end_date: data.endDate,
        travelers: data.travelers,
        notes: data.notes ?? null,
        type: data.type ?? null,
        package_id: data.packageId ?? null,
      };

      const { data: inserted, error } = await supabase
        .from('bookings')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        console.error('[bookingStore] insert error', error);
        throw new Error(error.message);
      }

      const created = mapBookingRow(inserted as BookingRow);
      set({ bookings: [created, ...get().bookings], isLoading: false });
    } catch (e) {
      console.error('[bookingStore] addBooking failed', e);
      set({ isLoading: false });
    }
  },

  updateBooking: async (id, updates) => {
    try {
      console.log('[bookingStore] updateBooking', { id, updates });

      const patch: Partial<BookingRow> = {};
      if (updates.status) patch.status = updates.status as BookingRow['status'];
      if (updates.startDate) patch.start_date = updates.startDate;
      if (updates.endDate) patch.end_date = updates.endDate;
      if (updates.travelers != null) patch.travelers = updates.travelers;
      if (updates.notes !== undefined) patch.notes = updates.notes ?? null;

      if (Object.keys(patch).length === 0) return;

      const { data: updated, error } = await supabase
        .from('bookings')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[bookingStore] update error', error);
        throw new Error(error.message);
      }

      const mapped = mapBookingRow(updated as BookingRow);
      set({ bookings: get().bookings.map((b) => (b.id === id ? mapped : b)) });
    } catch (e) {
      console.error('[bookingStore] updateBooking failed', e);
    }
  },

  fetchBookings: async (customerIdParam) => {
    set({ isLoading: true });
    try {
      console.log('[bookingStore] fetchBookings', { customerIdParam: customerIdParam ?? null });

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[bookingStore] auth.getUser error', authError);
      }

      const customerId = customerIdParam ?? authData.user?.id ?? '';
      if (!customerId) {
        set({ bookings: [], isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[bookingStore] select error', error);
        throw new Error(error.message);
      }

      const rows: BookingRow[] = (data ?? []) as BookingRow[];
      set({ bookings: rows.map(mapBookingRow), isLoading: false });
    } catch (e) {
      console.error('[bookingStore] fetchBookings failed', e);
      set({ isLoading: false });
    }
  },
}));
