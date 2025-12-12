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

const blogInputSchema = z.object({
  title: localizedStringSchema,
  content: localizedStringSchema,
  excerpt: localizedStringSchema,
  category: z.string(),
  imageUrl: z.string().optional(),
});

export const blogRouter = createTRPCRouter({
  list: publicProcedure.query(() => {
    return db.get().blogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const blog = db.get().blogs.find((b) => b.id === input.id);
      if (!blog) throw new TRPCError({ code: "NOT_FOUND" });
      return blog;
    }),

  create: adminProcedure
    .input(blogInputSchema)
    .mutation(async ({ ctx, input }) => {
      const newBlog = {
        id: crypto.randomUUID(),
        author: ctx.user.name,
        createdAt: new Date().toISOString(),
        ...input,
      };
      db.get().blogs.push(newBlog);
      await db.save();
      return newBlog;
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), data: blogInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const index = db.get().blogs.findIndex((b) => b.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      
      const updated = { ...db.get().blogs[index], ...input.data };
      db.get().blogs[index] = updated;
      await db.save();
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const filtered = db.get().blogs.filter((b) => b.id !== input.id);
      if (filtered.length === db.get().blogs.length) throw new TRPCError({ code: "NOT_FOUND" });
      
      db.get().blogs = filtered;
      await db.save();
      return { success: true };
    }),
});
