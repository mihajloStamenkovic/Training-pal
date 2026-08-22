import { Check, Minus } from '@phosphor-icons/react';
import type { SessionSet, StrengthSet, CardioSet } from '../../db/types';
import { summariseSet } from '../../utils/workoutStats';
import styles from './SetRow.module.css';

interface CompletedSetRowProps {
  setNumber: number;
  set: SessionSet;
  type: 'strength' | 'cardio';
}

export function CompletedSetRow({ setNumber, set, type }: CompletedSetRowProps) {
  return (
    <div className={styles.row}>
      <Check size={14} className={styles.doneIcon} />
      <span className={styles.setNum}>Set {setNumber}</span>
      <span className={styles.summary}>{summariseSet(set, type)}</span>
      {type === 'strength' && (
        <span className={styles.trailing}>RIR {(set as StrengthSet).rir}</span>
      )}
    </div>
  );
}

interface PendingSetRowProps {
  setNumber: number;
  prediction?: SessionSet | null;
  type: 'strength' | 'cardio';
}

export function PendingSetRow({ setNumber, prediction, type }: PendingSetRowProps) {
  let hint = '';
  if (prediction) {
    hint = summariseSet(prediction, type);
    if (type === 'cardio') {
      const p = prediction as CardioSet;
      hint = `${p.durationMinutes}min`;
    }
  }

  return (
    <div className={`${styles.row} ${styles.pending}`}>
      <Minus size={14} className={styles.pendingIcon} />
      <span className={styles.setNum}>Set {setNumber}</span>
      <span className={styles.summary}>{hint}</span>
      <span className={styles.trailing}>planned</span>
    </div>
  );
}
