import { create } from 'zustand';
import { trpcVanilla } from '@/lib/trpc';
import { Booking } from '@/lib/db/types';

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  addBooking: (bookingData: Omit<Booking, 'id' | 'status' | 'createdAt' | 'reference'>) => Promise<void>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  fetchBookings: (customerId?: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,

  addBooking: async (data) => {
    set({ isLoading: true });
    try {
      // trpc createBooking expects slightly different input, but mostly compatible.
      // We need to map `data` to `bookingInputSchema`.
      // Input: { packageId, serviceCategoryId, startDate, endDate, travelers, notes, type }
      const input = {
          packageId: data.packageId,
          serviceCategoryId: data.serviceCategoryId,
          startDate: data.startDate,
          endDate: data.endDate,
          travelers: data.travelers,
          notes: data.notes,
          type: data.type
      };

      const newBooking = await trpcVanilla.bookings.createBooking.mutate(input as any);
      
      const currentBookings = get().bookings;
      set({
        bookings: [newBooking, ...currentBookings],
        isLoading: false,
      });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  updateBooking: async (id, updates) => {
    try {
      // Only status update is supported via trpc currently for admin
      if (updates.status) {
          const updated = await trpcVanilla.bookings.updateStatus.mutate({ 
              id, 
              status: updates.status as any 
          });
          set({ 
            bookings: get().bookings.map(b => b.id === id ? updated : b) 
          });
      }
    } catch (e) {
      console.error(e);
    }
  },

  fetchBookings: async (customerId) => {
    set({ isLoading: true });
    try {
      // Ideally we check role to decide which endpoint to call, but store doesn't know role easily without coupling.
      // We can try listMyBookings.
      // If we are admin, we might want listAllBookings.
      // Let's try listMyBookings first.
      
      let bookings;
      try {
          bookings = await trpcVanilla.bookings.listMyBookings.query();
      } catch (e) {
          // Maybe we are admin? Or error.
      }
      
      // If we are admin (checked via auth store ideally), use listAllBookings
      // But trpcVanilla doesn't expose user role directly.
      // We can expose a separate method `fetchAllBookings` for admin.
      // For now, let's assume this store is for "My Bookings" primarily.
      
      set({ bookings: bookings || [], isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },
}));
