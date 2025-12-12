import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/backend/db";

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  await db.waitForInit();

  const authHeader = opts.req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  let user = null;
  
  if (token) {
    try {
      const session = db.get().sessions[token];
      if (session) {
        user = db.get().users.find((u) => u.id === session.userId) || null;
      }
    } catch (e) {
      // db might not be ready or token invalid
    }
  }

  return {
    req: opts.req,
    user,
    token,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      token: ctx.token,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});
