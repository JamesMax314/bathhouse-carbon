import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { prisma } from '@/lib/prisma';

export const createContext = async () => ({
  prisma,
});

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export { TRPCError };
