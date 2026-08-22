import type {
  CardioSet,
  Exercise,
  SessionExercise,
  SessionSet,
  StrengthExercise,
  StrengthSet,
} from '../db/types';

/** Rough work time per set, used only for the "est." figure on Today. */
const SECONDS_PER_SET = 45;

export interface PlannedStats {
  sets: number;
  tonnes: number;
  minutes: number;
}

/** What a template adds up to before you've trained it. */
export function plannedStats(exercises: Exercise[]): PlannedStats {
  let sets = 0;
  let kg = 0;
  let seconds = 0;

  for (const exercise of exercises) {
    if (exercise.type === 'strength') {
      sets += exercise.sets.length;
      for (const set of exercise.sets) {
        kg += set.weight * set.reps;
      }
      seconds += exercise.sets.length * (SECONDS_PER_SET + exercise.restSeconds);
    } else {
      seconds += exercise.durationMinutes * 60;
    }
  }

  return { sets, tonnes: kg / 1000, minutes: Math.round(seconds / 60) };
}

/** What a finished session actually came to. */
export function sessionStats(exerciseData: SessionExercise[]): { sets: number; tonnes: number } {
  let sets = 0;
  let kg = 0;

  for (const exercise of exerciseData) {
    if (exercise.type !== 'strength') continue;
    sets += exercise.sets.length;
    for (const set of exercise.sets) {
      const s = set as StrengthSet;
      kg += s.weight * s.reps;
    }
  }

  return { sets, tonnes: kg / 1000 };
}

/** The heaviest set of a strength exercise — the number the row shows. */
export function heaviestSet(sets: StrengthSet[]): StrengthSet | null {
  let best: StrengthSet | null = null;
  for (const set of sets) {
    if (!best || set.weight > best.weight) best = set;
  }
  return best;
}

export interface RowFigure {
  value: string;
  unit: string;
  trailing: string | null;
}

/** The `[big number] [unit] [× reps]` triple on a Today / done row. */
export function rowFigure(exercise: Exercise): RowFigure {
  if (exercise.type === 'strength') {
    const target = heaviestTarget(exercise);
    return {
      value: formatNumber(target?.weight ?? 0),
      unit: 'kg',
      trailing: target ? `×${target.reps}` : null,
    };
  }
  return { value: String(exercise.durationMinutes), unit: 'min', trailing: null };
}

function heaviestTarget(exercise: StrengthExercise) {
  let best = exercise.sets[0] ?? null;
  for (const set of exercise.sets) {
    if (set.weight > best.weight) best = set;
  }
  return best;
}

/** The muted second line of a Today row. */
export function exerciseMeta(exercise: Exercise): string {
  if (exercise.type === 'strength') {
    const count = exercise.sets.length;
    const parts = [`${count} set${count !== 1 ? 's' : ''}`];
    const first = exercise.sets[0];
    if (first) parts.push(`RIR ${first.rir}`);
    if (exercise.restSeconds > 0) parts.push(`rest ${formatRest(exercise.restSeconds)}`);
    return parts.join(' · ');
  }
  return `incline ${formatNumber(exercise.incline)} · speed ${formatNumber(exercise.speed)}`;
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Trims the trailing zeros a raw float picks up (62.50 -> 62.5, 60.0 -> 60). */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** One tonne figure, always to one decimal — 4.3, not 4.28571. */
export function formatTonnes(tonnes: number): string {
  return tonnes.toFixed(1);
}

export function summariseSet(set: SessionSet, type: 'strength' | 'cardio'): string {
  if (type === 'strength') {
    const s = set as StrengthSet;
    return `${formatNumber(s.weight)} × ${s.reps}`;
  }
  const c = set as CardioSet;
  return `${formatNumber(c.incline)} · ${formatNumber(c.speed)} · ${c.durationMinutes}min`;
}
