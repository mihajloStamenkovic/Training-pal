import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { sessionCreateSchema, sessionBulkCreateSchema } from '@training-pal/shared';
import type { Session } from '@training-pal/shared';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';

/** One insertable row. Both create paths go through this. */
function toRow(userId: string, input: Omit<Session, 'id'>) {
  return {
    id: randomUUID(),
    userId,
    templateId: input.templateId,
    templateName: input.templateName,
    date: input.date,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationSeconds: input.durationSeconds,
    exerciseData: input.exerciseData,
  };
}

export const sessionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ctx.userId))
      .orderBy(desc(sessions.date));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, input.id), eq(sessions.userId, ctx.userId)));
      return session ?? null;
    }),

  listByTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.templateId, input.templateId),
            eq(sessions.userId, ctx.userId),
            eq(sessions.status, 'completed'),
          ),
        )
        .orderBy(desc(sessions.date));
    }),

  create: protectedProcedure
    .input(sessionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .insert(sessions)
        .values(toRow(ctx.userId, input))
        .returning();
      return session;
    }),

  createMany: protectedProcedure
    .input(sessionBulkCreateSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.length === 0) return [];
      return db
        .insert(sessions)
        .values(input.map((session) => toRow(ctx.userId, session)))
        .returning();
    }),
});
