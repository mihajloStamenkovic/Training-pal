import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { todayString } from '../../utils/dates';
import type { ProgramCycle, Template } from '../../db/types';
import Button from '../common/Button';
import styles from './CycleEditor.module.css';

interface CycleEditorProps {
  templates: Template[];
  cycle: ProgramCycle | null;
}

export default function CycleEditor({ templates, cycle }: CycleEditorProps) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showPicker, setShowPicker] = useState(false);
  const [showResetPicker, setShowResetPicker] = useState(false);

  const upsertCycle = trpc.cycle.upsert.useMutation({
    onSuccess: () => utils.cycle.get.invalidate(),
    onError: () => alert('Failed to update cycle. Please try again.'),
  });
  const updateCycle = trpc.cycle.update.useMutation({
    onSuccess: () => utils.cycle.get.invalidate(),
    onError: () => alert('Failed to update cycle. Please try again.'),
  });

  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const sequence = cycle?.sequence ?? [];

  async function addToSequence(templateId: string) {
    const newSeq = [...sequence, templateId];
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

    await updateCycle.mutateAsync({ sequence: newSeq, currentIndex: newIndex });
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

    await updateCycle.mutateAsync({ sequence: newSeq, currentIndex: newIndex });
  }

  async function resetCycleTo(index: number) {
    if (!cycle) return;
    await updateCycle.mutateAsync({
      currentIndex: index,
      startDate: todayString(),
      lastCompletedDate: null,
    });
    setShowResetPicker(false);
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Rotation</h2>
        {cycle && sequence.length > 0 && (
          <div className={styles.resetArea}>
            <button className={styles.resetBtn} onClick={() => setShowResetPicker(!showResetPicker)}>
              {showResetPicker ? 'Cancel' : `Day ${cycle.currentIndex + 1} of ${sequence.length}`}
            </button>
            {showResetPicker && (
              <div className={styles.resetDropdown}>
                <p className={styles.resetHint}>Jump the rotation to:</p>
                {sequence.map((templateId, i) => (
                  <button
                    key={`reset-${templateId}-${i}`}
                    className={`${styles.resetOption} ${cycle.currentIndex === i ? styles.resetOptionCurrent : ''}`}
                    onClick={() => resetCycleTo(i)}
                  >
                    <span className={styles.resetOptionDay}>Day {i + 1}</span>
                    <span className={styles.resetOptionName}>
                      {templateMap.get(templateId)?.name ?? 'Deleted Template'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {sequence.length > 0 ? (
        <div className={styles.sequenceList}>
          {sequence.map((templateId, i) => {
            const tmpl = templateMap.get(templateId);
            const isCurrent = cycle?.currentIndex === i;
            return (
              <div
                key={`${templateId}-${i}`}
                className={`${styles.sequenceItem} ${isCurrent ? styles.current : ''}`}
              >
                <span className={styles.dayNum}>{i + 1}</span>
                <span className={styles.templateName}>{tmpl?.name ?? 'Deleted Template'}</span>
                {isCurrent && <span className={styles.currentBadge}>Next</span>}
                <div className={styles.itemActions}>
                  <button
                    className={styles.moveBtn}
                    onClick={() => moveInSequence(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    className={styles.moveBtn}
                    onClick={() => moveInSequence(i, i + 1)}
                    disabled={i === sequence.length - 1}
                    aria-label="Move later"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeFromSequence(i)}
                    aria-label="Remove from rotation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
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

      {showPicker ? (
        <div className={styles.picker}>
          <p className={styles.pickerLabel}>Add to rotation:</p>
          {templates.length === 0 ? (
            <p className={styles.pickerEmpty}>
              No workouts created yet.{' '}
              <button className={styles.linkBtn} onClick={() => navigate('/program/new')}>
                Create one
              </button>
            </p>
          ) : (
            <div className={styles.pickerList}>
              {templates.map((t) => (
                <button key={t.id} className={styles.pickerItem} onClick={() => addToSequence(t.id)}>
                  {t.name}
                  <span className={styles.pickerMeta}>
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" fullWidth onClick={() => setShowPicker(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setShowPicker(true)}>
          + Add to Rotation
        </button>
      )}
    </section>
  );
}
