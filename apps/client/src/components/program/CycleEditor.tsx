import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDown, CaretUp, Plus, X } from '@phosphor-icons/react';
import { trpc } from '../../lib/trpc';
import { useToast } from '../../hooks/useToast';
import { todayString } from '../../utils/dates';
import type { ProgramCycle, Template } from '@training-pal/shared';
import BottomSheet from '../common/BottomSheet';
import styles from './CycleEditor.module.css';

interface CycleEditorProps {
  templates: Template[];
  cycle: ProgramCycle | null;
}

export default function CycleEditor({ templates, cycle }: CycleEditorProps) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { showError } = useToast();
  const [showPicker, setShowPicker] = useState(false);
  const [showResetPicker, setShowResetPicker] = useState(false);

  const upsertCycle = trpc.cycle.upsert.useMutation({
    onSuccess: () => utils.cycle.get.invalidate(),
    onError: () => showError('Failed to update cycle. Please try again.'),
  });
  const updateCycle = trpc.cycle.update.useMutation({
    onSuccess: () => utils.cycle.get.invalidate(),
    onError: () => showError('Failed to update cycle. Please try again.'),
  });

  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const sequence = cycle?.sequence ?? [];

  async function addToSequence(templateId: string) {
    const newSeq = [...sequence, templateId];
    try {
      if (cycle) {
        await updateCycle.mutateAsync({ sequence: newSeq });
      } else {
        await upsertCycle.mutateAsync({
          sequence: newSeq,
          currentIndex: 0,
          startDate: todayString(),
          lastCompletedDate: null,
        });
      }
    } catch {
      return; // onError has surfaced it; leave the picker open to retry
    }
    setShowPicker(false);
  }

  async function removeFromSequence(index: number) {
    if (!cycle) return;

    const newSeq = sequence.filter((_, i) => i !== index);
    let newIndex = cycle.currentIndex;

    if (newSeq.length === 0) {
      newIndex = 0;
    } else if (index < cycle.currentIndex) {
      newIndex = cycle.currentIndex - 1;
    } else if (index === cycle.currentIndex) {
      newIndex = Math.min(index, newSeq.length - 1);
    }

    await updateCycle.mutateAsync({ sequence: newSeq, currentIndex: newIndex }).catch(() => {});
  }

  async function moveInSequence(from: number, to: number) {
    if (!cycle) return;

    const newSeq = [...sequence];
    const [item] = newSeq.splice(from, 1);
    newSeq.splice(to, 0, item);

    let newIndex = cycle.currentIndex;
    if (from === cycle.currentIndex) {
      newIndex = to;
    } else if (from < cycle.currentIndex && to >= cycle.currentIndex) {
      newIndex = cycle.currentIndex - 1;
    } else if (from > cycle.currentIndex && to <= cycle.currentIndex) {
      newIndex = cycle.currentIndex + 1;
    }

    await updateCycle.mutateAsync({ sequence: newSeq, currentIndex: newIndex }).catch(() => {});
  }

  async function resetCycleTo(index: number) {
    if (!cycle) return;
    try {
      await updateCycle.mutateAsync({
        currentIndex: index,
        startDate: todayString(),
        lastCompletedDate: null,
      });
    } catch {
      return; // onError has surfaced it
    }
    setShowResetPicker(false);
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className="section-label">Rotation</div>
        {cycle && sequence.length > 0 && (
          <button className={styles.jumpBtn} onClick={() => setShowResetPicker(true)}>
            Jump to day…
          </button>
        )}
      </div>

      {sequence.length > 0 ? (
        <div className={styles.list}>
          {sequence.map((templateId, i) => {
            const tmpl = templateMap.get(templateId);
            const isCurrent = cycle?.currentIndex === i;
            return (
              <div key={`${templateId}-${i}`} className={styles.row}>
                <span className={`${styles.dayNum} ${isCurrent ? styles.dayNumCurrent : ''}`}>
                  {i + 1}
                </span>
                <span className={`${styles.name} ${isCurrent ? '' : styles.nameQuiet}`}>
                  {tmpl?.name ?? 'Deleted Template'}
                </span>
                {isCurrent && <span className={styles.nextBadge}>next</span>}
                <div className={styles.rowActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => moveInSequence(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                  >
                    <CaretUp size={15} />
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={() => moveInSequence(i, i + 1)}
                    disabled={i === sequence.length - 1}
                    aria-label="Move later"
                  >
                    <CaretDown size={15} />
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.removeBtn}`}
                    onClick={() => removeFromSequence(i)}
                    aria-label="Remove from rotation"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyNote}>
          Nothing in your rotation yet. Add workouts below and they will repeat in order.
        </p>
      )}

      <button className={styles.addBtn} onClick={() => setShowPicker(true)}>
        <Plus size={15} />
        Add to rotation
      </button>

      {showPicker && (
        <BottomSheet
          title="Add to rotation"
          hint="Workouts repeat in this order, one per day."
          onClose={() => setShowPicker(false)}
        >
          {templates.length === 0 ? (
            <p className={styles.pickerEmpty}>
              No workouts created yet.{' '}
              <button className={styles.linkBtn} onClick={() => navigate('/program/new')}>
                Create one
              </button>
            </p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                className={styles.sheetOption}
                onClick={() => addToSequence(t.id)}
              >
                <span className={styles.sheetName}>{t.name}</span>
                <span className={styles.sheetMeta}>
                  {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                </span>
              </button>
            ))
          )}
        </BottomSheet>
      )}

      {showResetPicker && cycle && (
        <BottomSheet
          title="Jump the rotation to"
          hint="This resets the rotation start to today."
          onClose={() => setShowResetPicker(false)}
        >
          {sequence.map((templateId, i) => (
            <button
              key={`reset-${templateId}-${i}`}
              className={styles.sheetOption}
              onClick={() => resetCycleTo(i)}
            >
              <span
                className={`${styles.sheetDay} ${cycle.currentIndex === i ? styles.sheetDayCurrent : ''}`}
              >
                {i + 1}
              </span>
              <span className={styles.sheetName}>
                {templateMap.get(templateId)?.name ?? 'Deleted Template'}
              </span>
              {cycle.currentIndex === i && <span className={styles.sheetBadge}>current</span>}
            </button>
          ))}
        </BottomSheet>
      )}
    </section>
  );
}
