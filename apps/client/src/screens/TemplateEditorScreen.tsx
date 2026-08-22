import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CaretLeft, Plus } from '@phosphor-icons/react';
import { trpc } from '../lib/trpc';
import { useToast } from '../hooks/useToast';
import { generateId } from '../utils/uuid';
import { cloneExercise, cloneExercises, copyTemplateName } from '../utils/templates';
import { exerciseConfigKey, exerciseNameKey } from '@training-pal/shared';
import type { Exercise, StrengthExercise } from '@training-pal/shared';
import ExerciseFormRow from '../components/templates/ExerciseFormRow';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import styles from './TemplateEditorScreen.module.css';

function createDefaultExercise(): StrengthExercise {
  return {
    id: generateId(),
    type: 'strength',
    name: '',
    sets: [{ weight: 0, reps: 0, rir: 2 }],
    restSeconds: 180,
  };
}

export default function TemplateEditorScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const utils = trpc.useUtils();
  const { showError } = useToast();
  const { data: existing, isPending, isError, refetch } = trpc.templates.get.useQuery(
    { id: id! },
    { enabled: !!id },
  );
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => utils.templates.list.invalidate(),
    onError: () => showError('Failed to create template. Please try again.'),
  });
  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      utils.templates.get.invalidate({ id: id! });
    },
    onError: () => showError('Failed to save template. Please try again.'),
  });
  const syncExercises = trpc.templates.syncExercises.useMutation({
    onError: () => showError('Failed to sync these exercises to your other templates.'),
  });

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>(() => [createDefaultExercise()]);
  // Only one exercise is open at a time; the rest collapse to a summary line.
  // `undefined` means "nothing chosen yet", which opens the first one.
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
  const openId = expandedId === undefined ? exercises[0]?.id ?? null : expandedId;

  useEffect(() => {
    if (existing) {
      const loaded =
        existing.exercises.length > 0 ? existing.exercises : [createDefaultExercise()];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable form state from a fetched record on load
      setName(existing.name);
      setExercises(loaded);
      setExpandedId(loaded[0].id);
    }
  }, [existing]);

  const loading = isNew ? false : isPending;
  const errored = !isNew && isError;

  function updateExercise(index: number, updated: Exercise) {
    setExercises((prev) => prev.map((e, i) => (i === index ? updated : e)));
  }

  function removeExercise(index: number) {
    const next = exercises.filter((_, i) => i !== index);
    if (next.length === 0) {
      const fresh = createDefaultExercise();
      setExercises([fresh]);
      setExpandedId(fresh.id);
      return;
    }
    setExercises(next);
    if (openId === exercises[index]?.id) {
      setExpandedId(next[Math.min(index, next.length - 1)].id);
    }
  }

  function moveExercise(from: number, to: number) {
    setExercises((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function duplicateExercise(index: number) {
    const copy = cloneExercise(exercises[index]);
    const next = [...exercises];
    next.splice(index + 1, 0, copy);
    setExercises(next);
    setExpandedId(copy.id);
  }

  function addExercise() {
    const fresh = createDefaultExercise();
    setExercises((prev) => [...prev, fresh]);
    setExpandedId(fresh.id);
  }

  async function handleSave(saveAsCopy = false) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const validExercises = exercises.filter((e) => e.name.trim() !== '');
    if (validExercises.length === 0) return;

    if (isNew || saveAsCopy) {
      await createTemplate.mutateAsync({
        name: saveAsCopy ? copyTemplateName(trimmedName) : trimmedName,
        exercises: saveAsCopy ? cloneExercises(validExercises) : validExercises,
      });
    } else {
      await updateTemplate.mutateAsync({
        id: id!,
        name: trimmedName,
        exercises: validExercises,
      });
      await syncEditedExercises(validExercises);
    }
    navigate('/program');
  }

  // An exercise name is a global label in this app: whatever you change here —
  // its name, its sets/reps/RIR, its rest — is pushed onto the same exercise in
  // every other template. Only exercises that actually changed in this edit are
  // pushed, so adding an exercise to a template never overwrites the numbers it
  // already has elsewhere.
  async function syncEditedExercises(saved: Exercise[]) {
    if (!existing) return;

    const previous = new Map(existing.exercises.map((e) => [e.id, e]));

    // A name that appears twice in this template can't act as a single source
    // of truth, so leave those alone rather than picking one arbitrarily.
    const nameCounts = new Map<string, number>();
    for (const exercise of saved) {
      const key = exerciseNameKey(exercise.name);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    const updates: { from: string; exercise: Exercise }[] = [];
    const seen = new Set<string>();

    for (const exercise of saved) {
      const before = previous.get(exercise.id);
      if (!before) continue; // newly added here — nothing to push outward
      if (exerciseConfigKey(before) === exerciseConfigKey(exercise)) continue;
      if ((nameCounts.get(exerciseNameKey(exercise.name)) ?? 0) > 1) continue;

      const from = before.name.trim();
      if (!from || !exercise.name.trim()) continue;

      const key = exerciseNameKey(from);
      if (seen.has(key)) continue;
      seen.add(key);

      updates.push({ from, exercise });
    }

    if (updates.length === 0) return;

    await syncExercises.mutateAsync({ updates, skipTemplateId: id! });
    utils.templates.invalidate();
  }

  if (loading) return <LoadingSpinner />;
  if (errored) return <ErrorMessage message="Couldn't load this template." onRetry={() => refetch()} />;

  const isValid = name.trim() !== '' && exercises.some((e) => e.name.trim() !== '');

  return (
    <div className="page">
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/program')}>
          <CaretLeft size={15} />
          Program
        </button>
        <span className={styles.mode}>{isNew ? 'new' : 'editing'}</span>
      </div>

      <input
        type="text"
        placeholder="Workout name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={styles.nameInput}
        autoFocus={isNew}
      />
      <p className={styles.nameHint}>
        Renaming an exercise below renames it in every workout that uses it.
      </p>

      <div className={styles.exerciseList}>
        {exercises.map((exercise, i) => (
          <div key={exercise.id} className={styles.exerciseSlot}>
            {i > 0 && <div className="rule" />}
            <ExerciseFormRow
              exercise={exercise}
              index={i}
              total={exercises.length}
              expanded={openId === exercise.id}
              onToggle={() =>
                setExpandedId((current) => (current === exercise.id ? null : exercise.id))
              }
              onChange={(updated) => updateExercise(i, updated)}
              onDuplicate={() => duplicateExercise(i)}
              onRemove={() => removeExercise(i)}
              onMoveUp={() => moveExercise(i, i - 1)}
              onMoveDown={() => moveExercise(i, i + 1)}
            />
          </div>
        ))}
      </div>

      <button className={styles.addBtn} onClick={addExercise}>
        <Plus size={15} />
        Add exercise
      </button>

      <div className="action-pad">
        <div className="action-pad-inner">
          {!isNew && (
            <Button variant="secondary" className={styles.copyBtn} onClick={() => handleSave(true)}>
              Save as copy
            </Button>
          )}
          <Button fullWidth onClick={() => handleSave()} disabled={!isValid}>
            {isNew ? 'Create workout' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
