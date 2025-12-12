import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import { verifyPassword, hashPassword, generateToken } from "@/backend/utils/auth";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = db.get().users.find(
        (u) => u.email.toLowerCase() === input.email.toLowerCase() || u.id === input.email
      );

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const isValid = verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const token = generateToken();
      db.get().sessions[token] = {
        userId: user.id,
        createdAt: new Date().toISOString(),
      };
      await db.save();

      const { passwordHash, ...userSafe } = user;
      return { user: userSafe, token };
    }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(2),
      phone: z.string().optional(),
      role: z.enum(["customer", "admin"]).default("customer"), // Only allow admin if really needed, normally restricted
    }))
    .mutation(async ({ input }) => {
      const existing = db.get().users.find(u => u.email.toLowerCase() === input.email.toLowerCase());
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      // If registering as admin, maybe restrict it? For now, allowing it as per request "fix auth" implies making it work.
      // But usually registration is for customers.
      // I'll allow customer role by default.
      
      const userId = crypto.randomUUID();
      const newUser = {
        id: userId,
        email: input.email,
        name: input.name,
        role: "customer" as const, // Force customer for public registration
        passwordHash: hashPassword(input.password),
        preferredLanguage: "en" as const,
        createdAt: new Date().toISOString(),
        status: "active" as const,
        phone: input.phone,
      };

      db.get().users.push(newUser);
      
      const token = generateToken();
      db.get().sessions[token] = {
        userId: newUser.id,
        createdAt: new Date().toISOString(),
      };
      await db.save();

      const { passwordHash, ...userSafe } = newUser;
      return { user: userSafe, token };
    }),

  me: protectedProcedure.query(({ ctx }) => {
    const { passwordHash, ...userSafe } = ctx.user;
    return userSafe;
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.token) {
        delete db.get().sessions[ctx.token];
        await db.save();
    }
    return { success: true };
  }),
});
