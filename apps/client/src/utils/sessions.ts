import type { Exercise, Session, SessionExercise } from '../db/types';

export function isHandledSession(session: Session): boolean {
  return session.status === 'completed' || session.status === 'skipped';
}

export function buildSessionExerciseSnapshot(exercises: Exercise[]): SessionExercise[] {
  return exercises.map((exercise) => ({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    type: exercise.type,
    sets: [],
  }));
}
