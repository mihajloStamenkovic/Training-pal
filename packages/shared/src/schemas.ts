import { z } from 'zod';

// ─── Exercise Types ──────────────────────────────────────────────

export const strengthSetTargetSchema = z.object({
  weight: z.number(),
  reps: z.number(),
  rir: z.number(),
});

export const strengthExerciseSchema = z.object({
  id: z.string(),
  type: z.literal('strength'),
  name: z.string(),
  sets: z.array(strengthSetTargetSchema),
  restSeconds: z.number(),
});

export const cardioExerciseSchema = z.object({
  id: z.string(),
  type: z.literal('cardio'),
  name: z.string(),
  incline: z.number(),
  speed: z.number(),
  durationMinutes: z.number(),
  restSeconds: z.number(),
});

export const exerciseSchema = z.discriminatedUnion('type', [
  strengthExerciseSchema,
  cardioExerciseSchema,
]);

// ─── Template ────────────────────────────────────────────────────

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  exercises: z.array(exerciseSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const templateCreateSchema = templateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const templateUpdateSchema = templateSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// ─── Program Cycle ───────────────────────────────────────────────

export const programCycleSchema = z.object({
  id: z.string(),
  sequence: z.array(z.string()),
  currentIndex: z.number(),
  startDate: z.string(),
  lastCompletedDate: z.string().nullable(),
});

export const programCycleUpsertSchema = programCycleSchema.omit({ id: true });

export const programCycleUpdateSchema = programCycleSchema
  .omit({ id: true })
  .partial();

// ─── Session ─────────────────────────────────────────────────────

export const strengthSetSchema = z.object({
  setNumber: z.number(),
  weight: z.number(),
  reps: z.number(),
  rir: z.number(),
});

export const cardioSetSchema = z.object({
  setNumber: z.number(),
  incline: z.number(),
  speed: z.number(),
  durationMinutes: z.number(),
});

export const sessionSetSchema = z.union([strengthSetSchema, cardioSetSchema]);

export const sessionExerciseSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: z.enum(['strength', 'cardio']),
  sets: z.array(sessionSetSchema),
});

export const sessionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  date: z.string(),
  status: z.enum(['completed', 'skipped', 'abandoned']),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  exerciseData: z.array(sessionExerciseSchema),
});

export const sessionCreateSchema = sessionSchema.omit({ id: true });

export const sessionBulkCreateSchema = z.array(sessionCreateSchema);
