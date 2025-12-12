import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

export const chatRouter = createTRPCRouter({
  listMyConversations: protectedProcedure.query(({ ctx }) => {
    return db.get().conversations
      .filter((c) => c.customerId === ctx.user.id)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const conv = db.get().conversations.find((c) => c.id === input.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      
      if (ctx.user.role !== "admin" && conv.customerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const messages = db.get().messages
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return { conversation: conv, messages };
    }),

  createConversation: protectedProcedure
    .input(z.object({ subject: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const newConv = {
        id: crypto.randomUUID(),
        customerId: ctx.user.id,
        subject: input.subject,
        status: "open" as const,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      db.get().conversations.push(newConv);
      await db.save();
      return newConv;
    }),

  sendMessage: protectedProcedure
    .input(z.object({ conversationId: z.string(), text: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conv = db.get().conversations.find((c) => c.id === input.conversationId);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      
      if (ctx.user.role !== "admin" && conv.customerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const newMessage = {
        id: crypto.randomUUID(),
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        text: input.text,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      db.get().messages.push(newMessage);
      conv.lastMessageAt = newMessage.createdAt;
      
      // If admin replies, maybe mark as read or whatever logic?
      // Keeping it simple.
      
      await db.save();
      return newMessage;
    }),

  // Admin
  listAllConversations: adminProcedure.query(() => {
    return db.get().conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }),
});
