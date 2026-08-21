import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { getAuth } from '@clerk/express';
import { db } from './db/index.js';
import { users } from './db/schema.js';

export interface Context {
  userId: string | null;
}

export function createContext({ req }: CreateExpressContextOptions): Context {
  const { userId } = getAuth(req);
  return { userId };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  await db.insert(users).values({ id: ctx.userId }).onConflictDoNothing();

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
