import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";

// Assuming full settings schema here is tedious to replicate with zod perfectly if nested deep.
// But we need validation.
// For now, partial updates with relaxed schema or specific schema.

export const settingsRouter = createTRPCRouter({
  get: publicProcedure.query(() => {
    return db.get().settings;
  }),

  update: adminProcedure
    .input(z.any()) // Allow flexible updates for now, ideally strictly typed
    .mutation(async ({ input }) => {
      const current = db.get().settings;
      // deeply merge or just spread? Input should likely be a partial object matching structure.
      // We will do a shallow merge of top level keys or deep merge?
      // Since settings has nested objects like contact, about, etc., a deep merge is better or just replace sections.
      
      // Let's assume input is Partial<AppSettings>
      db.get().settings = { ...current, ...input };
      // Note: for deep nested like contact, this shallow merge might overwrite if not careful.
      // Client should send full object for nested props or we handle it better.
      // For simplicity:
      
      if (input.contact) db.get().settings.contact = { ...current.contact, ...input.contact };
      if (input.about) db.get().settings.about = { ...current.about, ...input.about };
      if (input.hero) db.get().settings.hero = { ...current.hero, ...input.hero };
      if (input.images) db.get().settings.images = { ...current.images, ...input.images };
      
      // Handle simple fields
      if (input.companyName) db.get().settings.companyName = input.companyName;
      if (input.termsAndConditions) db.get().settings.termsAndConditions = input.termsAndConditions;
      if (input.privacyPolicy) db.get().settings.privacyPolicy = input.privacyPolicy;
      
      // Hero slides are handled by hero router usually, but if passed here:
      if (input.heroSlides) db.get().settings.heroSlides = input.heroSlides;

      await db.save();
      return db.get().settings;
    }),
});
