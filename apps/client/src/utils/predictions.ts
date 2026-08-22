import { trpcClient } from '../lib/trpc';
import type { SessionExercise } from '@training-pal/shared';

export async function getLastSessionExercises(
  templateId: string
): Promise<Map<string, SessionExercise>> {
  const sessions = await trpcClient.sessions.listByTemplate.query({ templateId });

  const last = sessions[0];
  if (!last) return new Map();

  const map = new Map<string, SessionExercise>();
  for (const ex of last.exerciseData) {
    map.set(ex.exerciseId, ex);
  }
  return map;
}
