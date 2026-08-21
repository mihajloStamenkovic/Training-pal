import { eq } from 'drizzle-orm';
import { programCycleUpsertSchema, programCycleUpdateSchema } from '@training-pal/shared';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { programCycles } from '../db/schema.js';

export const cycleRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [cycle] = await db
      .select()
      .from(programCycles)
      .where(eq(programCycles.userId, ctx.userId));
    return cycle ?? null;
  }),

  upsert: protectedProcedure
    .input(programCycleUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const [cycle] = await db
        .insert(programCycles)
        .values({
          id: ctx.userId,
          userId: ctx.userId,
          sequence: input.sequence,
          currentIndex: input.currentIndex,
          startDate: input.startDate,
          lastCompletedDate: input.lastCompletedDate,
        })
        .onConflictDoUpdate({
          target: programCycles.userId,
          set: {
            sequence: input.sequence,
            currentIndex: input.currentIndex,
            startDate: input.startDate,
            lastCompletedDate: input.lastCompletedDate,
          },
        })
        .returning();
      return cycle;
    }),

  update: protectedProcedure
    .input(programCycleUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const [cycle] = await db
        .update(programCycles)
        .set(input)
        .where(eq(programCycles.userId, ctx.userId))
        .returning();
      return cycle;
    }),
});
