import { CaretDown, CaretUp, Copy, Plus, X } from '@phosphor-icons/react';
import type { Exercise, StrengthExercise, StrengthSetTarget } from '../../db/types';
import { formatClock, formatNumber, heaviest } from '../../utils/workoutStats';
import styles from './ExerciseFormRow.module.css';

interface ExerciseFormRowProps {
  exercise: Exercise;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updated: Exercise) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const defaultSet: StrengthSetTarget = { weight: 0, reps: 0, rir: 2 };

/** The one-line version of an exercise: "3 × 26kg" or "12 min". */
function summarise(exercise: Exercise): string {
  if (exercise.type === 'strength') {
    const top = heaviest(exercise.sets);
    return `${exercise.sets.length} × ${formatNumber(top?.weight ?? 0)}kg`;
  }
  return `${exercise.durationMinutes} min`;
}

export default function ExerciseFormRow({
  exercise,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ExerciseFormRowProps) {
  const isStrength = exercise.type === 'strength';
  const number = String(index + 1).padStart(2, '0');

  function update(patch: Record<string, unknown>) {
    onChange({ ...exercise, ...patch } as Exercise);
  }

  function setType(next: 'strength' | 'cardio') {
    if (next === exercise.type) return;
    if (next === 'cardio') {
      onChange({
        id: exercise.id,
        type: 'cardio',
        name: exercise.name,
        incline: 0,
        speed: 0,
        durationMinutes: 30,
        restSeconds: 0,
      });
    } else {
      onChange({
        id: exercise.id,
        type: 'strength',
        name: exercise.name,
        sets: [{ ...defaultSet }],
        restSeconds: exercise.restSeconds || 180,
      });
    }
  }

  // Strength set helpers
  function updateSet(setIndex: number, patch: Partial<StrengthSetTarget>) {
    if (exercise.type !== 'strength') return;
    const newSets = exercise.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s));
    update({ sets: newSets });
  }

  function addSet() {
    if (exercise.type !== 'strength') return;
    const lastSet = exercise.sets[exercise.sets.length - 1] ?? defaultSet;
    update({ sets: [...exercise.sets, { ...lastSet }] });
  }

  function removeSet(setIndex: number) {
    if (exercise.type !== 'strength') return;
    const newSets = exercise.sets.filter((_, i) => i !== setIndex);
    update({ sets: newSets.length > 0 ? newSets : [{ ...defaultSet }] });
  }

  if (!expanded) {
    return (
      <button className={styles.summaryRow} onClick={onToggle}>
        <span className={styles.summaryNum}>{number}</span>
        <span className={styles.summaryName}>{exercise.name || 'Untitled exercise'}</span>
        <span className={styles.summaryMeta}>{summarise(exercise)}</span>
        <CaretDown size={14} className={styles.summaryCaret} />
      </button>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <button className={styles.number} onClick={onToggle} aria-label="Collapse exercise">
          {number}
        </button>
        <input
          type="text"
          placeholder="Exercise name"
          value={exercise.name}
          onChange={(e) => update({ name: e.target.value })}
          className={styles.nameInput}
        />
        <div className={styles.headActions}>
          <button className={styles.iconBtn} onClick={onDuplicate} aria-label="Duplicate exercise">
            <Copy size={15} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
          >
            <CaretUp size={15} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move down"
          >
            <CaretDown size={15} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.removeBtn}`}
            onClick={onRemove}
            aria-label="Remove exercise"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className={styles.typeRow}>
        <div className={styles.segmented}>
          <button
            className={`${styles.segment} ${isStrength ? styles.segmentOn : ''}`}
            onClick={() => setType('strength')}
          >
            Strength
          </button>
          <button
            className={`${styles.segment} ${!isStrength ? styles.segmentOn : ''}`}
            onClick={() => setType('cardio')}
          >
            Cardio
          </button>
        </div>
        <span className={styles.spacer} />
        {isStrength && (
          <label className={styles.restField}>
            <span className={styles.restLabel}>rest</span>
            <input
              type="text"
              inputMode="numeric"
              className={styles.restInput}
              value={exercise.restSeconds}
              onChange={(e) =>
                update({ restSeconds: Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0) })
              }
              aria-label="Rest between sets, in seconds"
            />
            <span className={styles.restHint}>{formatClock(exercise.restSeconds)}</span>
          </label>
        )}
      </div>

      {isStrength ? (
        <div className={styles.sets}>
          <div className={styles.setsHead}>
            <span className={styles.colSet}>set</span>
            <span className={styles.colWeight}>kg</span>
            <span className={styles.colReps}>reps</span>
            <span className={styles.colRir}>rir</span>
            <span className={styles.colRemove} />
          </div>
          {(exercise as StrengthExercise).sets.map((set, si) => (
            <div key={si} className={styles.setRow}>
              <span className={styles.colSet}>{si + 1}</span>
              <input
                type="text"
                inputMode="decimal"
                className={`${styles.colWeight} ${styles.cellInput}`}
                value={set.weight || ''}
                placeholder="0"
                onChange={(e) =>
                  updateSet(si, { weight: parseFloat(e.target.value.replace(',', '.')) || 0 })
                }
                aria-label={`Set ${si + 1} weight`}
              />
              <input
                type="text"
                inputMode="numeric"
                className={`${styles.colReps} ${styles.cellInput}`}
                value={set.reps || ''}
                placeholder="0"
                onChange={(e) => updateSet(si, { reps: parseInt(e.target.value) || 0 })}
                aria-label={`Set ${si + 1} reps`}
              />
              <div className={styles.colRir}>
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.rirChip} ${set.rir === n ? styles.rirOn : ''}`}
                    onClick={() => updateSet(si, { rir: n })}
                    aria-label={`Set ${si + 1}, RIR ${n}`}
                    aria-pressed={set.rir === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                className={`${styles.iconBtn} ${styles.removeBtn} ${styles.colRemove}`}
                onClick={() => removeSet(si)}
                aria-label={`Remove set ${si + 1}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button className={styles.addSetBtn} onClick={addSet}>
            <Plus size={14} />
            Add set
          </button>
        </div>
      ) : (
        <div className={styles.cardioFields}>
          <label className={styles.cardioField}>
            <span className={styles.cardioLabel}>incline</span>
            <input
              type="text"
              inputMode="decimal"
              value={exercise.incline}
              onChange={(e) =>
                update({ incline: parseFloat(e.target.value.replace(',', '.')) || 0 })
              }
            />
          </label>
          <label className={styles.cardioField}>
            <span className={styles.cardioLabel}>speed</span>
            <input
              type="text"
              inputMode="decimal"
              value={exercise.speed}
              onChange={(e) => update({ speed: parseFloat(e.target.value.replace(',', '.')) || 0 })}
            />
          </label>
          <label className={styles.cardioField}>
            <span className={styles.cardioLabel}>minutes</span>
            <input
              type="text"
              inputMode="numeric"
              value={exercise.durationMinutes}
              onChange={(e) => update({ durationMinutes: parseInt(e.target.value) || 0 })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
