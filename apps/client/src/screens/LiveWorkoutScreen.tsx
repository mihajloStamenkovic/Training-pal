import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc, trpcClient } from '../lib/trpc';
import { todayString } from '../utils/dates';
import { getLastSessionExercises } from '../utils/predictions';
import { exerciseConfigKey, exerciseNameKey } from '../db/types';
import { useRestTimer } from '../hooks/useRestTimer';
import { useStopwatch, formatStopwatch } from '../hooks/useStopwatch';
import {
  clearWorkoutDraft,
  getWorkoutDraftDate,
  loadWorkoutDraft,
  saveWorkoutDraft,
  type WorkoutDraftInput,
} from '../utils/workoutDraft';
import type {
  Exercise,
  StrengthExercise,
  CardioExercise,
  SessionExercise,
  SessionSet,
  StrengthSet,
  CardioSet,
} from '../db/types';
import ExerciseProgress from '../components/workout/ExerciseProgress';
import { CompletedSetRow, PendingSetRow } from '../components/workout/SetRow';
import RirSelector from '../components/workout/RirSelector';
import RestTimerDisplay from '../components/workout/RestTimerDisplay';
import NumberInput from '../components/common/NumberInput';
import Button from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import styles from './LiveWorkoutScreen.module.css';

type SetInput = WorkoutDraftInput;

const emptyInput: WorkoutDraftInput = {
  weight: '',
  reps: '',
  rir: null,
  incline: '',
  speed: '',
  durationMinutes: '',
};

export default function LiveWorkoutScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const manualDate = searchParams.get('date');
  const manualTemplateId = searchParams.get('templateId');
  const isManualLog = Boolean(manualDate && manualTemplateId);
  const utils = trpc.useUtils();
  const { data: cycle } = trpc.cycle.get.useQuery();
  const createSession = trpc.sessions.create.useMutation({
    onError: () => alert('Failed to save workout. Please try again.'),
  });
  const updateCycleMutation = trpc.cycle.update.useMutation({
    onError: () => alert('Failed to update your program cycle. Please try again.'),
  });
  const updateTemplateMutation = trpc.templates.update.useMutation({
    onError: () => alert('Failed to update template targets. Please try again.'),
  });
  const syncExercisesMutation = trpc.templates.syncExercises.useMutation({
    onError: () => alert('Failed to carry these numbers over to your other workouts.'),
  });

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [predictions, setPredictions] = useState<Map<string, SessionExercise>>(new Map());
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Map<string, SessionSet[]>>(new Map());
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [input, setInput] = useState<SetInput>({ ...emptyInput });
  const [startedAt, setStartedAt] = useState(Date.now());
  const [showAbandon, setShowAbandon] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [weightStep, setWeightStep] = useState<1 | 1.25>(1);
  const activeSetRef = useRef<HTMLDivElement>(null);

  const timer = useRestTimer();
  const elapsedSeconds = useStopwatch(startedAt);

  // Prefill priority: template targets first, last session as fallback.
  // Finishing a workout writes what was actually performed back into the
  // template, so the template is always the freshest source — and edits made in
  // the template editor take effect the very next time the workout runs.
  function prefillSet(ex: Exercise, setIndex: number, preds: Map<string, SessionExercise>) {
    const pred = preds.get(ex.id);
    const predSet = pred?.type === ex.type ? pred.sets[setIndex] : null;

    if (ex.type === 'strength') {
      const target = (ex as StrengthExercise).sets[setIndex];
      if (target && (target.weight > 0 || target.reps > 0)) {
        setInput({ ...emptyInput, weight: String(target.weight || ''), reps: String(target.reps || ''), rir: target.rir });
      } else if (predSet) {
        const s = predSet as StrengthSet;
        setInput({ ...emptyInput, weight: String(s.weight), reps: String(s.reps), rir: s.rir });
      } else if (target) {
        setInput({ ...emptyInput, rir: target.rir });
      } else {
        setInput({ ...emptyInput });
      }
      return;
    }

    const cardio = ex as CardioExercise;
    if (cardio.durationMinutes > 0 || cardio.speed > 0 || cardio.incline > 0) {
      setInput({
        ...emptyInput,
        incline: String(cardio.incline),
        speed: String(cardio.speed),
        durationMinutes: String(cardio.durationMinutes),
      });
    } else if (predSet) {
      const c = predSet as CardioSet;
      setInput({ ...emptyInput, incline: String(c.incline), speed: String(c.speed), durationMinutes: String(c.durationMinutes) });
    } else {
      setInput({ ...emptyInput });
    }
  }

  // Load template and predictions on mount
  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        await loadWorkout();
      } catch {
        setLoadError(true);
      }
    }

    async function loadWorkout() {
      const draft = loadWorkoutDraft();
      let draftMatches = false;

      if (draft) {
        if (isManualLog) {
          draftMatches =
            draft.mode === 'manual' &&
            draft.manualDate === (manualDate ?? null) &&
            draft.manualTemplateId === (manualTemplateId ?? null);
        } else {
          const c = await trpcClient.cycle.get.query();
          const expectedTemplateId = c?.sequence[c.currentIndex];
          draftMatches =
            draft.mode === 'today' &&
            getWorkoutDraftDate(draft) === todayString() &&
            draft.templateId === expectedTemplateId;

          if (!draftMatches && draft.mode === 'today') {
            clearWorkoutDraft();
          }
        }
      }

      if (draftMatches) {
        const activeDraft = draft!;
        setTemplateId(activeDraft.templateId);
        setTemplateName(activeDraft.templateName);
        setExercises(activeDraft.exercises);
        setPredictions(new Map(activeDraft.predictions));
        setCompletedSets(new Map(activeDraft.completedSets));
        setCurrentExIndex(activeDraft.currentExIndex);
        setCurrentSetNum(activeDraft.currentSetNum);
        setInput(activeDraft.input);
        setStartedAt(activeDraft.startedAt);
        setWeightStep(activeDraft.weightStep);
        setLoaded(true);
        return;
      }

      let tId: string;

      if (isManualLog) {
        tId = manualTemplateId!;
      } else {
        const c = await trpcClient.cycle.get.query();
        if (!c || c.sequence.length === 0) {
          navigate('/');
          return;
        }
        tId = c.sequence[c.currentIndex];
      }

      const template = await trpcClient.templates.get.query({ id: tId });
      if (!template || template.exercises.length === 0) {
        navigate('/');
        return;
      }

      setTemplateId(tId);
      setTemplateName(template.name);
      setExercises(template.exercises);

      const preds = await getLastSessionExercises(tId);
      setPredictions(preds);

      // Prefill first set of first exercise
      prefillSet(template.exercises[0], 0, preds);

      setLoaded(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  useEffect(() => {
    if (!loaded || !templateId) return;

    saveWorkoutDraft({
      version: 1,
      mode: isManualLog ? 'manual' : 'today',
      sessionDate: isManualLog ? manualDate! : todayString(),
      manualDate: manualDate ?? null,
      manualTemplateId: manualTemplateId ?? null,
      templateId,
      templateName,
      exercises,
      predictions: Array.from(predictions.entries()),
      completedSets: Array.from(completedSets.entries()),
      currentExIndex,
      currentSetNum,
      input,
      startedAt,
      weightStep,
      savedAt: Date.now(),
    });
  }, [
    loaded,
    templateId,
    templateName,
    exercises,
    predictions,
    completedSets,
    currentExIndex,
    currentSetNum,
    input,
    startedAt,
    weightStep,
    isManualLog,
    manualDate,
    manualTemplateId,
  ]);

  const currentEx = exercises[currentExIndex];
  const exCompletedSets = completedSets.get(currentEx?.id ?? '') ?? [];
  const totalSetsForEx = currentEx?.type === 'strength' ? currentEx.sets.length : 1;
  const allSetsDone = exCompletedSets.length >= totalSetsForEx;
  const isLastExercise = currentExIndex === exercises.length - 1;
  const currentPred = currentEx ? predictions.get(currentEx.id) : null;

  function saveSet() {
    if (!currentEx) return;

    let set: SessionSet;
    if (currentEx.type === 'strength') {
      const weight = parseFloat(input.weight);
      const reps = parseInt(input.reps);
      if (isNaN(weight) || isNaN(reps) || input.rir === null) return;
      set = { setNumber: currentSetNum, weight, reps, rir: input.rir };
    } else {
      const incline = parseFloat(input.incline);
      const speed = parseFloat(input.speed);
      const dur = parseInt(input.durationMinutes);
      if (isNaN(incline) || isNaN(speed) || isNaN(dur)) return;
      set = { setNumber: currentSetNum, incline, speed, durationMinutes: dur };
    }

    const key = currentEx.id;
    setCompletedSets((prev) => {
      const next = new Map(prev);
      next.set(key, [...(next.get(key) ?? []), set]);
      return next;
    });

    const nextSetNum = currentSetNum + 1;
    setCurrentSetNum(nextSetNum);

    // Prefill next set or start rest timer after last set
    if (nextSetNum <= totalSetsForEx) {
      prefillSet(currentEx, nextSetNum - 1, predictions);

      // Start rest timer between sets
      if (currentEx.restSeconds > 0) {
        timer.start(currentEx.restSeconds);
      }
    } else {
      // All sets done — start rest timer before next exercise (strength only)
      if (currentEx.type === 'strength' && currentEx.restSeconds > 0 && !isLastExercise) {
        timer.start(currentEx.restSeconds);
      }
    }

    // Auto-scroll to active set
    setTimeout(() => {
      activeSetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function nextExercise() {
    timer.cancel();
    const nextIdx = currentExIndex + 1;
    setCurrentExIndex(nextIdx);
    setCurrentSetNum(1);
    prefillSet(exercises[nextIdx], 0, predictions);
  }

  async function finishWorkout() {
    timer.cancel();
    const now = Date.now();
    const sessionDate = isManualLog ? manualDate! : todayString();

    const exerciseData: SessionExercise[] = exercises.map((ex) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      type: ex.type,
      sets: completedSets.get(ex.id) ?? [],
    }));

    await createSession.mutateAsync({
      templateId,
      templateName,
      date: sessionDate,
      status: 'completed',
      startedAt: isManualLog ? null : startedAt,
      finishedAt: isManualLog ? null : now,
      durationSeconds: isManualLog ? null : Math.round((now - startedAt) / 1000),
      exerciseData,
    });

    if (!isManualLog) {
      // Update template targets with what was actually performed.
      const updatedExercises: Exercise[] = exercises.map((ex) => {
        const done = completedSets.get(ex.id);
        if (!done || done.length === 0) return ex;

        if (ex.type === 'strength') {
          return {
            ...ex,
            sets: done.map((s) => ({
              weight: (s as StrengthSet).weight,
              reps: (s as StrengthSet).reps,
              rir: (s as StrengthSet).rir,
            })),
          };
        }
        const c = done[0] as CardioSet;
        return {
          ...ex,
          incline: c.incline,
          speed: c.speed,
          durationMinutes: c.durationMinutes,
        };
      });

      await updateTemplateMutation.mutateAsync({
        id: templateId,
        name: templateName,
        exercises: updatedExercises,
      });

      // Exercises are global: a 70kg x 6 bench logged here becomes the target
      // for that same bench press in every other template too, so the next
      // workout that includes it starts from what was actually lifted.
      const nameCounts = new Map<string, number>();
      for (const ex of updatedExercises) {
        const key = exerciseNameKey(ex.name);
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
      }

      const syncUpdates = updatedExercises.flatMap((ex, i) => {
        if (!ex.name.trim()) return [];
        if (exerciseConfigKey(ex) === exerciseConfigKey(exercises[i])) return [];
        // An ambiguous name can't act as a single source of truth.
        if ((nameCounts.get(exerciseNameKey(ex.name)) ?? 0) > 1) return [];
        return [{ from: ex.name, exercise: ex }];
      });

      if (syncUpdates.length > 0) {
        await syncExercisesMutation.mutateAsync({
          updates: syncUpdates,
          skipTemplateId: templateId,
        });
      }
    }

    if (!isManualLog && cycle) {
      const nextIndex = (cycle.currentIndex + 1) % cycle.sequence.length;
      await updateCycleMutation.mutateAsync({
        currentIndex: nextIndex,
        lastCompletedDate: sessionDate,
      });
    }

    utils.sessions.invalidate();
    utils.cycle.get.invalidate();
    utils.templates.invalidate();
    clearWorkoutDraft();
    navigate('/');
  }

  function handleAbandon() {
    timer.cancel();
    clearWorkoutDraft();
    navigate('/');
  }

  if (loadError) {
    return (
      <ErrorMessage
        message="Couldn't load this workout."
        onRetry={() => setRetryKey((k) => k + 1)}
      />
    );
  }
  if (!loaded || !currentEx) return <LoadingSpinner />;

  const canSave = currentEx.type === 'strength'
    ? input.weight !== '' && input.reps !== '' && input.rir !== null
    : input.incline !== '' && input.speed !== '' && input.durationMinutes !== '';

  // Pending set hints follow the same priority as the prefill: template target
  // first, last session as fallback.
  function getPendingHint(setIndex: number): SessionSet | null {
    if (currentEx.type === 'strength') {
      const target = (currentEx as StrengthExercise).sets[setIndex];
      if (target && (target.weight > 0 || target.reps > 0)) {
        return { setNumber: setIndex + 1, weight: target.weight, reps: target.reps, rir: target.rir };
      }
    }
    const predSet = currentPred?.type === currentEx.type ? currentPred.sets[setIndex] : null;
    return predSet ?? null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.stopwatch}>{formatStopwatch(elapsedSeconds)}</div>
        <ExerciseProgress current={currentExIndex} total={exercises.length} />
        <div className={styles.headerRow}>
          <h1 className={styles.exName}>{currentEx.name}</h1>
          <button className={styles.abandonBtn} onClick={() => setShowAbandon(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <span className={styles.exType}>
          {currentEx.type === 'strength'
            ? `${totalSetsForEx} working set${totalSetsForEx !== 1 ? 's' : ''} · Rest ${currentEx.restSeconds}s`
            : 'Cardio'}
        </span>
      </div>

      <div className={styles.setsList}>
        {/* Completed sets */}
        {exCompletedSets.map((set, i) => (
          <CompletedSetRow key={i} setNumber={i + 1} set={set} type={currentEx.type} />
        ))}

        {/* Rest timer — blocks next set/exercise until done */}
        {timer.isActive && (
          <RestTimerDisplay remaining={timer.remaining} onSkip={timer.cancel} />
        )}

        {/* Active set input — hidden while timer is running */}
        {!allSetsDone && !timer.isActive && (
          <div className={styles.activeSet} ref={activeSetRef}>
            {/* Prediction hint */}
            {currentPred && currentPred.type === currentEx.type && currentPred.sets[currentSetNum - 1] && (
              <div className={styles.predHint}>
                {currentEx.type === 'strength'
                  ? (() => {
                      const p = currentPred.sets[currentSetNum - 1] as StrengthSet;
                      return `Last: ${p.weight}kg × ${p.reps} @ RIR ${p.rir}`;
                    })()
                  : (() => {
                      const p = currentPred.sets[currentSetNum - 1] as CardioSet;
                      return `Last: Incline ${p.incline} · Speed ${p.speed} · ${p.durationMinutes}min`;
                    })()}
              </div>
            )}

            <div className={styles.setLabel}>Set {currentSetNum}</div>

            {currentEx.type === 'strength' ? (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Weight (kg)</label>
                  <div className={styles.fieldRow}>
                    <button className={styles.incBtn} onClick={() => {
                      const cur = parseFloat(input.weight) || 0;
                      setInput((p) => ({ ...p, weight: String(Math.max(0, +(cur - weightStep).toFixed(2))) }));
                    }}>−</button>
                    <NumberInput
                      value={input.weight}
                      onChange={(v) => setInput((p) => ({ ...p, weight: v }))}
                      decimal
                      placeholder="0"
                    />
                    <button className={styles.incBtn} onClick={() => {
                      const cur = parseFloat(input.weight) || 0;
                      setInput((p) => ({ ...p, weight: String(+(cur + weightStep).toFixed(2)) }));
                    }}>+</button>
                    <button
                      className={`${styles.stepToggle} ${weightStep === 1 ? styles.stepActive1 : styles.stepActive125}`}
                      onClick={() => setWeightStep((s) => (s === 1 ? 1.25 : 1))}
                    >
                      {weightStep === 1 ? '1' : '1.25'}
                    </button>
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Reps</label>
                  <div className={styles.fieldRow}>
                    <button className={styles.incBtn} onClick={() => {
                      const cur = parseInt(input.reps) || 0;
                      setInput((p) => ({ ...p, reps: String(Math.max(0, cur - 1)) }));
                    }}>−</button>
                    <NumberInput
                      value={input.reps}
                      onChange={(v) => setInput((p) => ({ ...p, reps: v }))}
                      placeholder="0"
                    />
                    <button className={styles.incBtn} onClick={() => {
                      const cur = parseInt(input.reps) || 0;
                      setInput((p) => ({ ...p, reps: String(cur + 1) }));
                    }}>+</button>
                  </div>
                </div>
                <RirSelector
                  value={input.rir}
                  onChange={(v) => setInput((p) => ({ ...p, rir: v }))}
                />
              </>
            ) : (
              <div className={styles.inputRow}>
                <NumberInput
                  label="Incline"
                  value={input.incline}
                  onChange={(v) => setInput((p) => ({ ...p, incline: v }))}
                  decimal
                  placeholder="0"
                />
                <NumberInput
                  label="Speed"
                  value={input.speed}
                  onChange={(v) => setInput((p) => ({ ...p, speed: v }))}
                  decimal
                  placeholder="0"
                />
                <NumberInput
                  label="Min"
                  value={input.durationMinutes}
                  onChange={(v) => setInput((p) => ({ ...p, durationMinutes: v }))}
                  placeholder="0"
                />
              </div>
            )}

            <Button fullWidth onClick={saveSet} disabled={!canSave}>
              Finished
            </Button>
          </div>
        )}

        {/* Pending sets — hidden while timer is running */}
        {!allSetsDone && !timer.isActive &&
          Array.from({ length: totalSetsForEx - exCompletedSets.length - 1 }, (_, i) => {
            const futureSetNum = currentSetNum + 1 + i;
            return (
              <PendingSetRow
                key={futureSetNum}
                setNumber={futureSetNum}
                prediction={getPendingHint(futureSetNum - 1)}
                type={currentEx.type}
              />
            );
          })}
      </div>

      {/* Next / Finish buttons */}
      {allSetsDone && !timer.isActive && (
        <div className={styles.nextArea}>
          {isLastExercise ? (
            <Button fullWidth onClick={finishWorkout}>
              Finish Workout
            </Button>
          ) : (
            <Button fullWidth onClick={nextExercise}>
              Next Exercise
            </Button>
          )}
        </div>
      )}

      {showAbandon && (
        <ConfirmDialog
          title="Abandon Workout?"
          message="Your progress for this session will be lost."
          confirmLabel="Abandon"
          danger
          onConfirm={handleAbandon}
          onCancel={() => setShowAbandon(false)}
        />
      )}
    </div>
  );
}
