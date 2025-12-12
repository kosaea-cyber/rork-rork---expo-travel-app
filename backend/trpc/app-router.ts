import { createTRPCRouter } from "./create-context";
import { authRouter } from "./routes/auth/route";
import { servicesRouter } from "./routes/services/route";
import { bookingsRouter } from "./routes/bookings/route";
import { heroRouter } from "./routes/hero/route";
import { chatRouter } from "./routes/chat/route";
import { blogRouter } from "./routes/blog/route";
import { settingsRouter } from "./routes/settings/route";
import { customersRouter } from "./routes/customers/route";
import { faqRouter } from "./routes/faq/route";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  services: servicesRouter,
  bookings: bookingsRouter,
  hero: heroRouter,
  chat: chatRouter,
  blog: blogRouter,
  settings: settingsRouter,
  customers: customersRouter,
  faq: faqRouter,
});

export type AppRouter = typeof appRouter;
