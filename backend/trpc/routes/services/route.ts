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

const categoryInputSchema = z.object({
  title: localizedStringSchema,
  description: localizedStringSchema,
  icon: z.string(),
  slug: z.string(),
  image: z.string().optional(),
});

const packageInputSchema = z.object({
  categoryId: z.string(),
  title: localizedStringSchema,
  description: localizedStringSchema,
  duration: localizedStringSchema,
  price: localizedStringSchema.optional(),
  features: z.array(localizedStringSchema),
  included: z.array(localizedStringSchema),
  imageUrl: z.string().optional(),
  isFeatured: z.boolean(),
});

export const servicesRouter = createTRPCRouter({
  // Categories
  listCategories: publicProcedure.query(() => {
    return db.get().categories;
  }),
  
  getCategory: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const category = db.get().categories.find((c) => c.id === input.id);
      if (!category) throw new TRPCError({ code: "NOT_FOUND" });
      return category;
    }),

  createCategory: adminProcedure
    .input(categoryInputSchema)
    .mutation(async ({ input }) => {
      const newCategory = {
        id: crypto.randomUUID(),
        ...input,
      };
      db.get().categories.push(newCategory);
      await db.save();
      return newCategory;
    }),

  updateCategory: adminProcedure
    .input(z.object({ id: z.string(), data: categoryInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const index = db.get().categories.findIndex((c) => c.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      
      const updated = { ...db.get().categories[index], ...input.data };
      db.get().categories[index] = updated;
      await db.save();
      return updated;
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const filtered = db.get().categories.filter((c) => c.id !== input.id);
      if (filtered.length === db.get().categories.length) throw new TRPCError({ code: "NOT_FOUND" });
      
      db.get().categories = filtered;
      // Also delete packages? Or keep them? Usually delete or warn.
      // For now, let's keep it simple.
      await db.save();
      return { success: true };
    }),

  // Packages
  listPackages: publicProcedure
    .input(z.object({ categoryId: z.string().optional(), featured: z.boolean().optional() }).optional())
    .query(({ input }) => {
      let packages = db.get().packages;
      if (input?.categoryId) {
        packages = packages.filter((p) => p.categoryId === input.categoryId);
      }
      if (input?.featured) {
        packages = packages.filter((p) => p.isFeatured);
      }
      return packages;
    }),

  getPackage: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const pkg = db.get().packages.find((p) => p.id === input.id);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });
      return pkg;
    }),

  createPackage: adminProcedure
    .input(packageInputSchema)
    .mutation(async ({ input }) => {
      const newPackage = {
        id: crypto.randomUUID(),
        ...input,
      };
      db.get().packages.push(newPackage);
      await db.save();
      return newPackage;
    }),

  updatePackage: adminProcedure
    .input(z.object({ id: z.string(), data: packageInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const index = db.get().packages.findIndex((p) => p.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      
      const updated = { ...db.get().packages[index], ...input.data };
      db.get().packages[index] = updated;
      await db.save();
      return updated;
    }),

  deletePackage: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const filtered = db.get().packages.filter((p) => p.id !== input.id);
      if (filtered.length === db.get().packages.length) throw new TRPCError({ code: "NOT_FOUND" });
      
      db.get().packages = filtered;
      await db.save();
      return { success: true };
    }),
});
