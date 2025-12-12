import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

const localizedStringSchema = z.object({
  en: z.string(),
  ar: z.string(),
  de: z.string(),
});

const slideInputSchema = z.object({
  imageUrl: z.string(),
  title: localizedStringSchema,
  subtitle: localizedStringSchema,
  ctaLabel: localizedStringSchema,
  ctaLink: z.string(),
  isActive: z.boolean(),
  order: z.number(),
});

export const heroRouter = createTRPCRouter({
  listSlides: publicProcedure.query(() => {
    // Return all slides for everyone, frontend can filter active ones or we can return all.
    // Usually admin needs all, public needs active.
    // But since this is a shared endpoint, let's return all and let frontend decide or filter here if not admin.
    // But we don't know if user is admin easily in publicProcedure without context.
    // Let's return all.
    const slides = db.get().settings.heroSlides || [];
    return slides.sort((a, b) => a.order - b.order);
  }),

  createSlide: adminProcedure
    .input(slideInputSchema)
    .mutation(async ({ input }) => {
      const newSlide = {
        id: crypto.randomUUID(),
        ...input,
      };
      
      const slides = db.get().settings.heroSlides || [];
      slides.push(newSlide);
      db.get().settings.heroSlides = slides;
      await db.save();
      
      return newSlide;
    }),

  updateSlide: adminProcedure
    .input(z.object({
        id: z.string(),
        data: slideInputSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const slides = db.get().settings.heroSlides || [];
      const index = slides.findIndex((s) => s.id === input.id);
      
      if (index === -1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Slide not found" });
      }

      const updatedSlide = {
        ...slides[index],
        ...input.data,
      };

      slides[index] = updatedSlide;
      db.get().settings.heroSlides = slides;
      await db.save();

      return updatedSlide;
    }),

  deleteSlide: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const slides = db.get().settings.heroSlides || [];
      const filtered = slides.filter((s) => s.id !== input.id);
      
      if (filtered.length === slides.length) {
         throw new TRPCError({ code: "NOT_FOUND", message: "Slide not found" });
      }

      db.get().settings.heroSlides = filtered;
      await db.save();
      return { success: true };
    }),

  reorderSlides: adminProcedure
    .input(z.array(z.string())) // Array of IDs in new order
    .mutation(async ({ input }) => {
      const slides = db.get().settings.heroSlides || [];
      // Create a map for quick access
      const slideMap = new Map(slides.map(s => [s.id, s]));
      
      const newSlides = [];
      let order = 1;
      
      for (const id of input) {
        const slide = slideMap.get(id);
        if (slide) {
            slide.order = order++;
            newSlides.push(slide);
            slideMap.delete(id); // Remove so we know what's left
        }
      }
      
      // Append remaining slides at the end (if any were missing from input)
      for (const slide of slideMap.values()) {
        slide.order = order++;
        newSlides.push(slide);
      }
      
      db.get().settings.heroSlides = newSlides;
      await db.save();
      
      return newSlides;
    }),
});
