import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X } from '@phosphor-icons/react';
import { trpc, trpcClient } from '../lib/trpc';
import { useToast } from '../hooks/useToast';
import { todayString } from '../utils/dates';
import { getLastSessionExercises } from '../utils/predictions';
import { formatNumber } from '../utils/workoutStats';
import { exerciseConfigKey, exerciseNameKey } from '@training-pal/shared';
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
} from '@training-pal/shared';
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

/** How wide a display figure needs to be, in digit widths. */
function figureWidth(value: string): string {
  return `${Math.max(2, value.length)}ch`;
}

/** What the last set's RIR says about the next one. */
function coachingLine(set: SessionSet | undefined, type: 'strength' | 'cardio'): string | null {
  if (!set || type !== 'strength') return null;
  const rir = (set as StrengthSet).rir;
  if (rir === 0) return 'Last set went to failure — hold the weight, or drop a little.';
  if (rir === 1) return 'Last set was hard (RIR 1) — hold the weight.';
  return 'Last set felt solid (RIR 2) — add a little next time.';
}

export default function LiveWorkoutScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const manualDate = searchParams.get('date');
  const manualTemplateId = searchParams.get('templateId');
  const isManualLog = Boolean(manualDate && manualTemplateId);
  const utils = trpc.useUtils();
  const { showError } = useToast();
  const { data: cycle } = trpc.cycle.get.useQuery();
  const createSession = trpc.sessions.create.useMutation({
    onError: () => showError('Failed to save workout. Please try again.'),
  });
  const updateCycleMutation = trpc.cycle.update.useMutation({
    onError: () => showError('Failed to update your program cycle. Please try again.'),
  });
  const updateTemplateMutation = trpc.templates.update.useMutation({
    onError: () => showError('Failed to update template targets. Please try again.'),
  });
  const syncExercisesMutation = trpc.templates.syncExercises.useMutation({
    onError: () => showError('Failed to carry these numbers over to your other workouts.'),
  });

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [predictions, setPredictions] = useState<Map<string, SessionExercise>>(new Map());
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Map<string, SessionSet[]>>(new Map());
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [input, setInput] = useState<SetInput>({ ...emptyInput });
  // Lazy initialiser: Date.now() in the argument position would be re-read on
  // every render, letting the elapsed clock drift off the real start.
  const [startedAt, setStartedAt] = useState(() => Date.now());
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

  // Takes the most recent set back out of the log and reopens it for editing —
  // the "Edit set n" escape hatch on the rest screen.
  function reopenLastSet() {
    if (!currentEx) return;
    const logged = completedSets.get(currentEx.id) ?? [];
    const last = logged[logged.length - 1];
    if (!last) return;

    timer.cancel();
    setCompletedSets((prev) => {
      const next = new Map(prev);
      next.set(currentEx.id, logged.slice(0, -1));
      return next;
    });
    setCurrentSetNum(last.setNumber);

    if (currentEx.type === 'strength') {
      const s = last as StrengthSet;
      setInput({ ...emptyInput, weight: String(s.weight), reps: String(s.reps), rir: s.rir });
    } else {
      const c = last as CardioSet;
      setInput({
        ...emptyInput,
        incline: String(c.incline),
        speed: String(c.speed),
        durationMinutes: String(c.durationMinutes),
      });
    }
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
    try {
      await saveFinishedWorkout();
    } catch {
      // Each mutation's onError has already surfaced the failure. Bail out
      // without clearing the draft or navigating, so the session is still
      // here to retry rather than silently lost.
      return;
    }

    utils.sessions.invalidate();
    utils.cycle.get.invalidate();
    utils.templates.invalidate();
    clearWorkoutDraft();
    navigate('/');
  }

  async function saveFinishedWorkout() {
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

    if (!isManualLog && cycle && cycle.sequence.length > 0) {
      const nextIndex = (cycle.currentIndex + 1) % cycle.sequence.length;
      await updateCycleMutation.mutateAsync({
        currentIndex: nextIndex,
        lastCompletedDate: sessionDate,
      });
    }
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

  const isStrength = currentEx.type === 'strength';
  const canSave = isStrength
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

  const lastLogged = exCompletedSets[exCompletedSets.length - 1];
  const nextExerciseName = exercises[currentExIndex + 1]?.name ?? '';

  // What the rest screen counts down towards.
  const restingBeforeNextExercise = allSetsDone;
  const upNext = restingBeforeNextExercise
    ? nextExerciseName
    : isStrength
      ? `Set ${currentSetNum} · ${formatNumber(parseFloat(input.weight) || 0)}kg × ${input.reps || 0}`
      : `Set ${currentSetNum}`;
  const skipLabel = restingBeforeNextExercise
    ? 'Skip rest, next exercise'
    : `Skip rest, start set ${currentSetNum}`;

  const abandonDialog = showAbandon ? (
    <ConfirmDialog
      title="Abandon this workout?"
      message="Your progress for this session will be discarded — nothing goes into your history."
      confirmLabel="Abandon"
      cancelLabel="Keep training"
      danger
      onConfirm={handleAbandon}
      onCancel={() => setShowAbandon(false)}
    />
  ) : null;

  const header = (
    <div className={styles.strip}>
      <div className={styles.stopwatch}>{formatStopwatch(elapsedSeconds)}</div>
      <ExerciseProgress current={currentExIndex} total={exercises.length} />
      <button
        className={styles.abandonBtn}
        onClick={() => setShowAbandon(true)}
        aria-label="Abandon workout"
      >
        <X size={16} />
      </button>
    </div>
  );

  if (timer.isActive) {
    return (
      <div className={styles.page}>
        {header}
        <RestTimerDisplay
          remaining={timer.remaining}
          total={timer.total}
          upNext={upNext}
          coachLine={coachingLine(lastLogged, currentEx.type)}
          skipLabel={skipLabel}
          editLabel={lastLogged ? `Edit set ${lastLogged.setNumber}` : undefined}
          onSkip={timer.cancel}
          onAddTime={() => timer.extend(30)}
          onEdit={lastLogged ? reopenLastSet : undefined}
        />
        {abandonDialog}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.scroll}>
        <h1 className={styles.exName}>{currentEx.name}</h1>
        <div className={styles.exMeta}>
          {allSetsDone
            ? `${totalSetsForEx} of ${totalSetsForEx} sets logged`
            : `set ${currentSetNum} of ${totalSetsForEx}`}
          {(() => {
            const predSet =
              currentPred?.type === currentEx.type ? currentPred.sets[currentSetNum - 1] : null;
            if (!predSet) return null;
            if (currentEx.type === 'strength') {
              const p = predSet as StrengthSet;
              return ` · last time ${formatNumber(p.weight)}kg × ${p.reps} @ RIR ${p.rir}`;
            }
            const p = predSet as CardioSet;
            return ` · last time incline ${formatNumber(p.incline)} · speed ${formatNumber(p.speed)} · ${p.durationMinutes}min`;
          })()}
        </div>

        {!allSetsDone && (
          <div ref={activeSetRef}>
            {isStrength ? (
              <>
                <div className={styles.figures}>
                  <NumberInput
                    display
                    decimal
                    value={input.weight}
                    onChange={(v) => setInput((p) => ({ ...p, weight: v }))}
                    placeholder="0"
                    aria-label="Weight in kilograms"
                    style={{ width: figureWidth(input.weight) }}
                  />
                  <span className={styles.figureUnit}>kg</span>
                  <span className={styles.figureDivider} />
                  <NumberInput
                    display
                    value={input.reps}
                    onChange={(v) => setInput((p) => ({ ...p, reps: v }))}
                    placeholder="0"
                    aria-label="Reps"
                    style={{ width: figureWidth(input.reps) }}
                  />
                  <span className={styles.figureUnit}>reps</span>
                </div>

                <div className={styles.steppers}>
                  <div className={styles.stepperPair}>
                    <button
                      className={styles.stepBtn}
                      aria-label="Decrease weight"
                      onClick={() => {
                        const cur = parseFloat(input.weight) || 0;
                        setInput((p) => ({
                          ...p,
                          weight: String(Math.max(0, +(cur - weightStep).toFixed(2))),
                        }));
                      }}
                    >
                      −
                    </button>
                    <button
                      className={styles.stepBtn}
                      aria-label="Increase weight"
                      onClick={() => {
                        const cur = parseFloat(input.weight) || 0;
                        setInput((p) => ({ ...p, weight: String(+(cur + weightStep).toFixed(2)) }));
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.stepperDivider} />
                  <div className={styles.stepperPair}>
                    <button
                      className={styles.stepBtn}
                      aria-label="Decrease reps"
                      onClick={() => {
                        const cur = parseInt(input.reps) || 0;
                        setInput((p) => ({ ...p, reps: String(Math.max(0, cur - 1)) }));
                      }}
                    >
                      −
                    </button>
                    <button
                      className={styles.stepBtn}
                      aria-label="Increase reps"
                      onClick={() => {
                        const cur = parseInt(input.reps) || 0;
                        setInput((p) => ({ ...p, reps: String(cur + 1) }));
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.stepCaptions}>
                  <button
                    className={styles.stepToggle}
                    onClick={() => setWeightStep((s) => (s === 1 ? 1.25 : 1))}
                  >
                    step {weightStep === 1 ? '1.0' : '1.25'} kg
                  </button>
                  <span className={styles.stepCaptionRight}>reps</span>
                </div>

                <div className={styles.rir}>
                  <RirSelector
                    value={input.rir}
                    onChange={(v) => setInput((p) => ({ ...p, rir: v }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.figures}>
                  <NumberInput
                    display
                    value={input.durationMinutes}
                    onChange={(v) => setInput((p) => ({ ...p, durationMinutes: v }))}
                    placeholder="0"
                    aria-label="Duration in minutes"
                    style={{ width: figureWidth(input.durationMinutes) }}
                  />
                  <span className={styles.figureUnit}>min</span>
                </div>
                <div className={styles.cardioFields}>
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
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.setsList}>
          {exCompletedSets.map((set, i) => (
            <CompletedSetRow key={`done-${i}`} setNumber={i + 1} set={set} type={currentEx.type} />
          ))}
          {!allSetsDone &&
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
      </div>

      <div className="action-pad">
        <div className="action-pad-inner">
          {allSetsDone ? (
            isLastExercise ? (
              <Button fullWidth lead onClick={finishWorkout}>
                <Check size={18} />
                Finish workout
              </Button>
            ) : (
              <Button fullWidth lead onClick={nextExercise}>
                Next exercise
              </Button>
            )
          ) : (
            <Button fullWidth lead onClick={saveSet} disabled={!canSave}>
              <Check size={18} />
              Log set {currentSetNum} of {totalSetsForEx}
            </Button>
          )}
        </div>
      </div>

      {abandonDialog}
    </div>
  );
}
