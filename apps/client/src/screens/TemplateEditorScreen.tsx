import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { generateId } from '../utils/uuid';
import { cloneExercise, cloneExercises, copyTemplateName } from '../utils/templates';
import type { Exercise, StrengthExercise } from '../db/types';
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
  const { data: existing, isPending, isError, refetch } = trpc.templates.get.useQuery(
    { id: id! },
    { enabled: !!id },
  );
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => utils.templates.list.invalidate(),
    onError: () => alert('Failed to create template. Please try again.'),
  });
  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      utils.templates.get.invalidate({ id: id! });
    },
    onError: () => alert('Failed to save template. Please try again.'),
  });

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([createDefaultExercise()]);

  useEffect(() => {
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable form state from a fetched record on load
      setName(existing.name);
      setExercises(existing.exercises.length > 0 ? existing.exercises : [createDefaultExercise()]);
    }
  }, [existing]);

  const loading = isNew ? false : isPending;
  const errored = !isNew && isError;

  function updateExercise(index: number, updated: Exercise) {
    setExercises((prev) => prev.map((e, i) => (i === index ? updated : e)));
  }

  function removeExercise(index: number) {
    setExercises((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createDefaultExercise()];
    });
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
    setExercises((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, cloneExercise(prev[index]));
      return next;
    });
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
    }
    navigate('/templates');
  }

  if (loading) return <LoadingSpinner />;
  if (errored) return <ErrorMessage message="Couldn't load this template." onRetry={() => refetch()} />;

  const isValid = name.trim() !== '' && exercises.some((e) => e.name.trim() !== '');

  return (
    <div className="page">
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/templates')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1 className={styles.title}>{isNew ? 'New Template' : 'Edit Template'}</h1>
      </div>

      <div className={styles.nameField}>
        <input
          type="text"
          placeholder="Template name (e.g. Upper A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.nameInput}
          autoFocus={isNew}
        />
      </div>

      <div className={styles.exerciseList}>
        {exercises.map((exercise, i) => (
          <ExerciseFormRow
            key={exercise.id}
            exercise={exercise}
            index={i}
            total={exercises.length}
            onChange={(updated) => updateExercise(i, updated)}
            onDuplicate={() => duplicateExercise(i)}
            onRemove={() => removeExercise(i)}
            onMoveUp={() => moveExercise(i, i - 1)}
            onMoveDown={() => moveExercise(i, i + 1)}
          />
        ))}
      </div>

      <button
        className={styles.addBtn}
        onClick={() => setExercises((prev) => [...prev, createDefaultExercise()])}
      >
        + Add Exercise
      </button>

      <div className={styles.saveArea}>
        {!isNew && (
          <Button variant="secondary" fullWidth onClick={() => handleSave(true)}>
            Save As Copy
          </Button>
        )}
        <Button fullWidth onClick={() => handleSave()} disabled={!isValid}>
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
