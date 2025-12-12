import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

const bookingInputSchema = z.object({
  packageId: z.string().optional(),
  serviceCategoryId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number(),
  notes: z.string().optional(),
  type: z.string().optional(),
});

export const bookingsRouter = createTRPCRouter({
  listMyBookings: protectedProcedure.query(({ ctx }) => {
    return db.get().bookings
      .filter((b) => b.customerId === ctx.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }),

  getBooking: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const booking = db.get().bookings.find((b) => b.id === input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      
      if (ctx.user.role !== "admin" && booking.customerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return booking;
    }),

  createBooking: protectedProcedure
    .input(bookingInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch package info if needed
      let packageTitle = undefined;
      let packageInfo = undefined;
      if (input.packageId) {
        packageInfo = db.get().packages.find(p => p.id === input.packageId);
        packageTitle = packageInfo?.title.en; // fallback or store logic
      }

      // Generate reference
      const reference = `BK-${Date.now().toString().slice(-6)}`;

      const newBooking = {
        id: crypto.randomUUID(),
        customerId: ctx.user.id,
        customerName: ctx.user.name,
        customerEmail: ctx.user.email,
        reference,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        packageTitle,
        ...input,
      };

      db.get().bookings.push(newBooking);
      await db.save();
      
      return newBooking;
    }),

  // Admin routes
  listAllBookings: adminProcedure.query(() => {
    return db.get().bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
    }))
    .mutation(async ({ input }) => {
      const index = db.get().bookings.findIndex((b) => b.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      
      db.get().bookings[index].status = input.status;
      await db.save();
      return db.get().bookings[index];
    }),
});
