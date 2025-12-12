import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/backend/trpc/create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export const customersRouter = createTRPCRouter({
  list: adminProcedure.query(() => {
    return db.get().users.filter(u => u.role === 'customer');
  }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const user = db.get().users.find((u) => u.id === input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ input }) => {
      const index = db.get().users.findIndex((u) => u.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      
      db.get().users[index].status = input.status;
      await db.save();
      return db.get().users[index];
    }),
});
