import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { templateCreateSchema, templateUpdateSchema } from '@training-pal/shared';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { templates, programCycles } from '../db/schema.js';

export const templatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(templates)
      .where(eq(templates.userId, ctx.userId))
      .orderBy(desc(templates.createdAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [template] = await db
        .select()
        .from(templates)
        .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.userId)));
      return template ?? null;
    }),

  create: protectedProcedure
    .input(templateCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const now = Date.now();
      const [template] = await db
        .insert(templates)
        .values({
          id: randomUUID(),
          userId: ctx.userId,
          name: input.name,
          exercises: input.exercises,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return template;
    }),

  update: protectedProcedure
    .input(templateUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const [template] = await db
        .update(templates)
        .set({
          name: input.name,
          exercises: input.exercises,
          updatedAt: Date.now(),
        })
        .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.userId)))
        .returning();
      return template;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [cycle] = await db
        .select()
        .from(programCycles)
        .where(eq(programCycles.userId, ctx.userId));

      if (cycle && cycle.sequence.includes(input.id)) {
        const removedBeforeCurrent = cycle.sequence
          .slice(0, cycle.currentIndex)
          .filter((id) => id === input.id).length;
        const nextSequence = cycle.sequence.filter((id) => id !== input.id);
        const nextIndex =
          nextSequence.length === 0
            ? 0
            : Math.min(cycle.currentIndex - removedBeforeCurrent, nextSequence.length - 1);

        await db
          .update(programCycles)
          .set({ sequence: nextSequence, currentIndex: Math.max(0, nextIndex) })
          .where(eq(programCycles.userId, ctx.userId));
      }

      await db
        .delete(templates)
        .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.userId)));

      return { success: true };
    }),
});
