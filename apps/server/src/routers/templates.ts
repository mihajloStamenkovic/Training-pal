import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import {
  templateCreateSchema,
  templateUpdateSchema,
  exerciseSchema,
  exerciseConfigKey,
  exerciseNameKey,
} from '@training-pal/shared';
import type { Exercise } from '@training-pal/shared';
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

      if (!template) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      }
      return template;
    }),

  // Exercise names are global labels in this app: editing an exercise in one
  // template pushes the whole config — name, targets and rest — onto every
  // other template that holds an exercise with the same (old) name. Each
  // template keeps its own exercise id so session history stays attached.
  syncExercises: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            from: z.string().min(1),
            exercise: exerciseSchema,
          }),
        ),
        skipTemplateId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const byName = new Map<string, Exercise>();
      for (const update of input.updates) {
        const key = exerciseNameKey(update.from);
        if (!key || !update.exercise.name.trim()) continue;
        byName.set(key, update.exercise);
      }
      if (byName.size === 0) return { updatedTemplateIds: [] };

      return db.transaction(async (tx) => {
        const owned = await tx
          .select()
          .from(templates)
          .where(eq(templates.userId, ctx.userId));

        const updatedTemplateIds: string[] = [];

        for (const template of owned) {
          if (template.id === input.skipTemplateId) continue;

          let changed = false;
          const exercises = template.exercises.map((exercise) => {
            const source = byName.get(exerciseNameKey(exercise.name));
            if (!source) return exercise;

            const next = { ...source, id: exercise.id } as Exercise;
            if (exerciseConfigKey(next) === exerciseConfigKey(exercise)) return exercise;

            changed = true;
            return next;
          });

          if (!changed) continue;

          await tx
            .update(templates)
            .set({ exercises, updatedAt: Date.now() })
            .where(and(eq(templates.id, template.id), eq(templates.userId, ctx.userId)));
          updatedTemplateIds.push(template.id);
        }

        return { updatedTemplateIds };
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        const [cycle] = await tx
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

          await tx
            .update(programCycles)
            .set({ sequence: nextSequence, currentIndex: Math.max(0, nextIndex) })
            .where(eq(programCycles.userId, ctx.userId));
        }

        await tx
          .delete(templates)
          .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.userId)));
      });

      return { success: true };
    }),
});
