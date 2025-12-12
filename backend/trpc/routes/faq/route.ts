import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import crypto from "node:crypto";

const localizedStringSchema = z.object({
  en: z.string(),
  ar: z.string(),
  de: z.string(),
});

export const faqRouter = createTRPCRouter({
  list: publicProcedure.query(() => {
    return db.get().faqs;
  }),

  create: adminProcedure
    .input(z.object({
        question: localizedStringSchema,
        answer: localizedStringSchema,
        category: z.string(),
    }))
    .mutation(async ({ input }) => {
      const newFaq = {
        id: crypto.randomUUID(),
        ...input,
      };
      db.get().faqs.push(newFaq);
      await db.save();
      return newFaq;
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), data: z.object({
        question: localizedStringSchema.optional(),
        answer: localizedStringSchema.optional(),
        category: z.string().optional(),
    })}))
    .mutation(async ({ input }) => {
      const idx = db.get().faqs.findIndex(f => f.id === input.id);
      if (idx !== -1) {
          db.get().faqs[idx] = { ...db.get().faqs[idx], ...input.data as any };
          await db.save();
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      db.get().faqs = db.get().faqs.filter(f => f.id !== input.id);
      await db.save();
    }),
});
