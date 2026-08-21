import {
  pgTable,
  text,
  bigint,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { Exercise, SessionExercise } from '@training-pal/shared';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  exercises: jsonb('exercises').$type<Exercise[]>().notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  templateId: text('template_id').notNull(),
  templateName: text('template_name').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  status: text('status', {
    enum: ['completed', 'skipped', 'abandoned'],
  }).notNull(),
  startedAt: bigint('started_at', { mode: 'number' }),
  finishedAt: bigint('finished_at', { mode: 'number' }),
  durationSeconds: integer('duration_seconds'),
  exerciseData: jsonb('exercise_data').$type<SessionExercise[]>().notNull(),
});

export const programCycles = pgTable('program_cycles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  sequence: jsonb('sequence').$type<string[]>().notNull(),
  currentIndex: integer('current_index').notNull(),
  startDate: text('start_date').notNull(),
  lastCompletedDate: text('last_completed_date'),
});
