import type { Exercise } from './types.js';

/**
 * A stable, id-independent fingerprint of everything that makes up an
 * exercise's configuration: its name, its targets and its rest.
 *
 * Exercise ids are per-template (session history is keyed by them), so two
 * templates holding "the same" exercise never share an id. Comparing these
 * keys is how we tell whether a config actually differs.
 */
export function exerciseConfigKey(exercise: Exercise): string {
  if (exercise.type === 'strength') {
    return JSON.stringify([
      'strength',
      exercise.name.trim(),
      exercise.restSeconds,
      exercise.sets.map((set) => [set.weight, set.reps, set.rir]),
    ]);
  }

  return JSON.stringify([
    'cardio',
    exercise.name.trim(),
    exercise.restSeconds,
    exercise.incline,
    exercise.speed,
    exercise.durationMinutes,
  ]);
}

/** Exercises are matched across templates by name, case- and space-insensitively. */
export function exerciseNameKey(name: string): string {
  return name.trim().toLowerCase();
}
