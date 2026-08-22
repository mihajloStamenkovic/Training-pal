import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowsLeftRight,
  CheckCircle,
  DotsThree,
  ListChecks,
  Play,
  Plus,
} from '@phosphor-icons/react';
import { trpc } from '../lib/trpc';
import { useToast } from '../hooks/useToast';
import { addDays, compareDateStrings, todayString, formatDate, formatDuration } from '../utils/dates';
import { clearWorkoutDraft, getWorkoutDraftDate, loadWorkoutDraft } from '../utils/workoutDraft';
import { buildSessionExerciseSnapshot, isHandledSession } from '../utils/sessions';
import {
  exerciseMeta,
  formatNumber,
  formatTonnes,
  heaviest,
  plannedStats,
  rowFigure,
  sessionStats,
} from '../utils/workoutStats';
import type { Session, StrengthSet } from '@training-pal/shared';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import BottomSheet from '../components/common/BottomSheet';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import PageHeader from '../components/layout/PageHeader';
import styles from './TodayScreen.module.css';

export default function TodayScreen() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { showError } = useToast();
  const [isSyncingMissedDays, setIsSyncingMissedDays] = useState(false);
  const [showSkipOptions, setShowSkipOptions] = useState(false);
  const [showSwitchPicker, setShowSwitchPicker] = useState(false);
  const [showDiscardDraft, setShowDiscardDraft] = useState(false);
  const {
    data: cycle,
    isPending: cycleLoading,
    isError: cycleErrored,
    refetch: refetchCycle,
  } = trpc.cycle.get.useQuery();
  const {
    data: templates,
    isPending: templatesLoading,
    isError: templatesErrored,
    refetch: refetchTemplates,
  } = trpc.templates.list.useQuery();
  const {
    data: allSessions,
    isPending: sessionsLoading,
    isError: sessionsErrored,
    refetch: refetchSessions,
  } = trpc.sessions.list.useQuery();

  const createManySessions = trpc.sessions.createMany.useMutation();
  const createSession = trpc.sessions.create.useMutation({
    onError: () => showError('Failed to log workout. Please try again.'),
  });
  const updateCycle = trpc.cycle.update.useMutation({
    onError: () => showError('Failed to update your program cycle. Please try again.'),
  });

  const todaySessions = allSessions?.filter((s) => s.date === todayString());
  // allSessions is ordered by date desc server-side, so the first handled
  // entry is the most recent one.
  const lastHandledDate = allSessions ? allSessions.find(isHandledSession)?.date ?? null : undefined;

  const templateMap = new Map(templates?.map((t) => [t.id, t]) ?? []);
  const currentTemplateId = cycle?.sequence?.[cycle.currentIndex];
  const currentTemplate = currentTemplateId ? templateMap.get(currentTemplateId) : null;
  const draft = loadWorkoutDraft();
  const today = todayString();
  const draftDate = draft ? getWorkoutDraftDate(draft) : null;
  const resumableDraft =
    draft?.mode === 'today' &&
    draftDate === today &&
    draft.templateId === currentTemplateId
      ? draft
      : null;
  const handledTodaySessions = todaySessions?.filter(isHandledSession) ?? [];

  const doneToday = handledTodaySessions.length > 0;
  const todayOutcome =
    handledTodaySessions.find((session) => session.status === 'completed') ??
    handledTodaySessions[handledTodaySessions.length - 1] ??
    null;

  useEffect(() => {
    let cancelled = false;

    async function syncMissedDays() {
      if (!cycle || cycle.sequence.length === 0 || !templates || lastHandledDate === undefined) return;

      if (
        draft?.mode === 'today' &&
        draftDate &&
        (compareDateStrings(draftDate, today) < 0 || draft.templateId !== currentTemplateId)
      ) {
        clearWorkoutDraft();
      }

      const firstUnhandledDate = addDays(lastHandledDate ?? addDays(cycle.startDate, -1), 1);
      if (compareDateStrings(firstUnhandledDate, today) >= 0) {
        return;
      }

      if (!cancelled) {
        setIsSyncingMissedDays(true);
      }

      const lastMissedDate = addDays(today, -1);
      const existingSessions = (allSessions ?? []).filter(
        (s) => compareDateStrings(s.date, firstUnhandledDate) >= 0 && compareDateStrings(s.date, lastMissedDate) <= 0,
      );

      const handledDates = new Set(
        existingSessions.filter(isHandledSession).map((session) => session.date)
      );
      const templateById = new Map(templates.map((template) => [template.id, template]));
      const skippedSessions: Omit<Session, 'id'>[] = [];
      let nextIndex = cycle.currentIndex;

      for (
        let date = firstUnhandledDate;
        compareDateStrings(date, today) < 0;
        date = addDays(date, 1)
      ) {
        const templateId = cycle.sequence[nextIndex];

        if (!handledDates.has(date)) {
          const template = templateById.get(templateId);
          skippedSessions.push({
            templateId,
            templateName: template?.name ?? 'Unknown',
            date,
            status: 'skipped' as const,
            startedAt: null,
            finishedAt: null,
            durationSeconds: null,
            exerciseData: template ? buildSessionExerciseSnapshot(template.exercises) : [],
          });
        }

        nextIndex = (nextIndex + 1) % cycle.sequence.length;
      }

      if (skippedSessions.length > 0) {
        await createManySessions.mutateAsync(skippedSessions);
      }

      await updateCycle.mutateAsync({
        currentIndex: nextIndex,
        lastCompletedDate: lastMissedDate,
      });

      utils.sessions.invalidate();
      utils.cycle.get.invalidate();

      if (!cancelled) {
        setIsSyncingMissedDays(false);
      }
    }

    void syncMissedDays().finally(() => {
      if (!cancelled) {
        setIsSyncingMissedDays(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, currentTemplateId, draft, draftDate, lastHandledDate, templates, today, allSessions]);

  const { data: templateSessions } = trpc.sessions.listByTemplate.useQuery(
    { templateId: currentTemplateId! },
    { enabled: !!currentTemplateId },
  );
  const lastSession = templateSessions?.[0] ?? null;

  async function handleSkip(advance: boolean) {
    if (!cycle || cycle.sequence.length === 0) return;
    await createSession.mutateAsync({
      templateId: cycle.sequence[cycle.currentIndex],
      templateName: currentTemplate?.name ?? 'Unknown',
      date: todayString(),
      status: 'skipped',
      startedAt: null,
      finishedAt: null,
      durationSeconds: null,
      exerciseData: currentTemplate ? buildSessionExerciseSnapshot(currentTemplate.exercises) : [],
    });
    await updateCycle.mutateAsync({
      currentIndex: advance
        ? (cycle.currentIndex + 1) % cycle.sequence.length
        : cycle.currentIndex,
      lastCompletedDate: todayString(),
    });
    utils.sessions.invalidate();
    utils.cycle.get.invalidate();
    setShowSkipOptions(false);
  }

  // Picking a different day just moves the cycle pointer, so finishing this
  // workout still advances to whatever comes after it in the rotation.
  async function switchToDay(index: number) {
    if (!cycle || index === cycle.currentIndex) {
      setShowSwitchPicker(false);
      return;
    }
    clearWorkoutDraft();
    await updateCycle.mutateAsync({ currentIndex: index });
    utils.cycle.get.invalidate();
    setShowSwitchPicker(false);
  }

  function discardDraft() {
    clearWorkoutDraft();
    setShowDiscardDraft(false);
  }

  if (cycleLoading || templatesLoading || sessionsLoading || isSyncingMissedDays) {
    return <LoadingSpinner />;
  }
  if (cycleErrored || templatesErrored || sessionsErrored) {
    return (
      <ErrorMessage
        message="Couldn't load today's workout."
        onRetry={() => {
          refetchCycle();
          refetchTemplates();
          refetchSessions();
        }}
      />
    );
  }

  // No program set up
  if (!cycle || cycle.sequence.length === 0) {
    const hasTemplates = (templates?.length ?? 0) > 0;
    return (
      <div className="page">
        <PageHeader eyebrow={formatDate(today)} />
        <EmptyState
          title={hasTemplates ? 'No rotation yet' : 'No workouts yet'}
          description={
            hasTemplates
              ? 'Add your templates to a rotation and they will repeat in order.'
              : 'Build your first workout, then add it to your rotation.'
          }
          steps={[
            'Create a workout with its exercises and target sets',
            'Add it to the rotation, in the order you train',
            'Come back here and hit Start',
          ]}
        />
        <div className="action-pad">
          <div className="action-pad-inner">
            {hasTemplates ? (
              <>
                <Button variant="secondary" fullWidth onClick={() => navigate('/program/new')}>
                  <Plus size={16} />
                  New workout
                </Button>
                <Button fullWidth onClick={() => navigate('/program')}>
                  Build rotation
                </Button>
              </>
            ) : (
              <Button fullWidth lead onClick={() => navigate('/program/new')}>
                <Plus size={17} />
                Create your first workout
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Already trained today
  if (doneToday) {
    const nextTemplateId = cycle.sequence[cycle.currentIndex];
    const nextTemplate = templateMap.get(nextTemplateId);
    const outcomeExercises = todayOutcome?.exerciseData ?? [];
    const done = sessionStats(outcomeExercises);
    // "Progressed" compares today's heaviest set against the last time this
    // same workout was completed, which is the next entry down the date-desc
    // list.
    const previous = allSessions?.find(
      (s) =>
        s.templateId === todayOutcome?.templateId &&
        s.status === 'completed' &&
        s.id !== todayOutcome?.id &&
        compareDateStrings(s.date, todayOutcome?.date ?? today) < 0,
    );
    const previousBest = new Map(
      (previous?.exerciseData ?? [])
        .filter((ex) => ex.type === 'strength')
        .map((ex) => [ex.exerciseName, heaviest(ex.sets as StrengthSet[])?.weight ?? null]),
    );

    const liftRows = outcomeExercises
      .filter((ex) => ex.type === 'strength' && ex.sets.length > 0)
      .map((ex) => {
        const best = heaviest(ex.sets as StrengthSet[]);
        const before = previousBest.get(ex.exerciseName) ?? null;
        const delta = best && before !== null ? best.weight - before : 0;
        return { name: ex.exerciseName, weight: best?.weight ?? 0, delta };
      });
    const progressed = liftRows.filter((row) => row.delta > 0).length;

    return (
      <div className="page">
        <PageHeader
          eyebrow={`${formatDate(today)} · ${todayOutcome?.status === 'skipped' ? 'skipped' : 'done'}`}
        />

        <div className={styles.doneFlag}>
          <CheckCircle size={15} />
          {todayOutcome?.status === 'skipped'
            ? `${todayOutcome.templateName} skipped`
            : `${todayOutcome?.templateName ?? 'Workout'} logged`}
        </div>

        {todayOutcome?.status === 'completed' && (
          <>
            <div className={styles.tonnage}>
              <span className={styles.tonnageValue}>{formatTonnes(done.tonnes)}</span>
              <span className={styles.tonnageUnit}>tonnes moved</span>
            </div>

            <div className={`${styles.statStrip} ${styles.doneStats}`}>
              <div>
                <div className={styles.statValue}>{done.sets}</div>
                <div className={styles.statLabel}>sets</div>
              </div>
              <div className={styles.statDivider} />
              <div>
                <div className={styles.statValue}>
                  {Math.round((todayOutcome.durationSeconds ?? 0) / 60)}
                  <span className={styles.statUnit}>m</span>
                </div>
                <div className={styles.statLabel}>duration</div>
              </div>
              <div className={styles.statDivider} />
              <div>
                <div className={`${styles.statValue} ${styles.statAccent}`}>+{progressed}</div>
                <div className={styles.statLabel}>progressed</div>
              </div>
            </div>

            <div className={`rule ${styles.doneRule}`} />

            <div className={styles.rows}>
              {liftRows.map((row) => (
                <div key={row.name} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{row.name}</span>
                  </span>
                  <span className={styles.rowFigure}>
                    {formatNumber(row.weight)}
                    <span className={styles.rowUnit}>kg</span>
                  </span>
                  <span className={`${styles.rowDelta} ${row.delta > 0 ? styles.rowDeltaUp : ''}`}>
                    {row.delta > 0 ? `+${formatNumber(row.delta)}` : 'held'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.nextUp}>next up · {nextTemplate?.name ?? 'Unknown'}</div>
        <div className={styles.nextUpMeta}>
          Day {cycle.currentIndex + 1} of {cycle.sequence.length} — whenever you are back in.
        </div>

        <div className="action-pad">
          <div className="action-pad-inner">
            <Button variant="secondary" fullWidth onClick={() => navigate('/program')}>
              <ListChecks size={17} />
              Program
            </Button>
            <Button fullWidth onClick={() => navigate('/workout')}>
              <Play size={16} />
              Train again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show today's workout
  const exercises = currentTemplate?.exercises ?? [];
  const planned = plannedStats(exercises);

  // The one line of coaching Today gets: the first lift whose target has moved
  // up since the last time this workout ran.
  const lastBest = new Map(
    (lastSession?.exerciseData ?? [])
      .filter((ex) => ex.type === 'strength')
      .map((ex) => [ex.exerciseId, heaviest(ex.sets as StrengthSet[])?.weight ?? null]),
  );
  let movedUpName: string | null = null;
  let movedUpDelta = 0;
  for (const ex of exercises) {
    if (ex.type !== 'strength') continue;
    const before = lastBest.get(ex.id);
    if (before == null) continue;
    const target = heaviest(ex.sets)?.weight ?? null;
    if (target !== null && target > before) {
      movedUpName = ex.name;
      movedUpDelta = target - before;
      break;
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={`${formatDate(today)} · day ${cycle.currentIndex + 1} of ${cycle.sequence.length}`}
      />

      <h1 className="page-title">{currentTemplate?.name ?? 'Unknown'}</h1>

      <div className={styles.statStrip}>
        <div>
          <div className={styles.statValue}>{planned.sets}</div>
          <div className={styles.statLabel}>sets</div>
        </div>
        <div className={styles.statDivider} />
        <div>
          <div className={styles.statValue}>
            {formatTonnes(planned.tonnes)}
            <span className={styles.statUnit}>t</span>
          </div>
          <div className={styles.statLabel}>volume</div>
        </div>
        <div className={styles.statDivider} />
        <div>
          <div className={styles.statValue}>
            ~{planned.minutes}
            <span className={styles.statUnit}>m</span>
          </div>
          <div className={styles.statLabel}>est.</div>
        </div>
      </div>

      <div className={`rule ${styles.heroRule}`} />

      <div className={styles.rows}>
        {exercises.map((ex) => {
          const figure = rowFigure(ex);
          return (
            <div key={ex.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{ex.name}</span>
                <span className={styles.rowMeta}>{exerciseMeta(ex)}</span>
              </span>
              <span className={styles.rowFigure}>
                {figure.value}
                <span className={styles.rowUnit}>{figure.unit}</span>
              </span>
              <span className={styles.rowTrailing}>{figure.trailing}</span>
            </div>
          );
        })}
      </div>

      {resumableDraft ? (
        <div className={styles.resumeNote}>Workout in progress</div>
      ) : movedUpName ? (
        <div className={styles.note}>
          <ArrowUpRight size={13} className={styles.noteIcon} />
          {movedUpName} up {formatNumber(movedUpDelta)}kg on last time
        </div>
      ) : lastSession ? (
        <div className={styles.note}>
          Last time {formatDate(lastSession.date)}
          {lastSession.durationSeconds ? ` · ${formatDuration(lastSession.durationSeconds)}` : ''}
        </div>
      ) : null}

      <div className="action-pad">
        <div className="action-pad-inner">
          <Button fullWidth onClick={() => navigate('/workout')}>
            <Play size={17} />
            {resumableDraft ? 'Resume' : 'Start'}
          </Button>
          {cycle.sequence.length > 1 && (
            <Button
              variant="secondary"
              className={styles.iconAction}
              aria-label="Train something else today"
              onClick={() => setShowSwitchPicker(true)}
            >
              <ArrowsLeftRight size={18} />
            </Button>
          )}
          <Button
            variant="secondary"
            className={styles.iconAction}
            aria-label="More options"
            onClick={() => setShowSkipOptions(true)}
          >
            <DotsThree size={18} />
          </Button>
        </div>
      </div>

      {showSwitchPicker && (
        <BottomSheet
          title="Train something else today"
          hint={`Swapping today does not move your rotation — ${currentTemplate?.name ?? 'this workout'} stays next.`}
          onClose={() => setShowSwitchPicker(false)}
        >
          {cycle.sequence.map((templateId, i) => {
            const tmpl = templateMap.get(templateId);
            const isCurrent = i === cycle.currentIndex;
            return (
              <button
                key={`switch-${templateId}-${i}`}
                className={styles.sheetOption}
                onClick={() => switchToDay(i)}
              >
                <span className={`${styles.sheetDay} ${isCurrent ? styles.sheetDayCurrent : ''}`}>
                  {i + 1}
                </span>
                <span className={styles.sheetName}>{tmpl?.name ?? 'Deleted Template'}</span>
                {isCurrent ? (
                  <span className={styles.sheetBadge}>scheduled</span>
                ) : (
                  <span className={styles.sheetMeta}>
                    {tmpl?.exercises.length ?? 0} exercise
                    {(tmpl?.exercises.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </BottomSheet>
      )}

      {showSkipOptions && (
        <BottomSheet
          title="Not training today"
          hint="Skipping logs the day so your rotation stays in step with the calendar."
          onClose={() => setShowSkipOptions(false)}
        >
          <div className={styles.sheetActions}>
            <Button variant="secondary" fullWidth onClick={() => handleSkip(true)}>
              Skip and advance
            </Button>
            <Button variant="secondary" fullWidth onClick={() => handleSkip(false)}>
              Skip, keep this workout next
            </Button>
            {resumableDraft && (
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  setShowSkipOptions(false);
                  setShowDiscardDraft(true);
                }}
              >
                Discard in-progress workout
              </Button>
            )}
          </div>
        </BottomSheet>
      )}

      {showDiscardDraft && (
        <ConfirmDialog
          title="Discard workout?"
          message="This will remove your in-progress workout so you can start fresh."
          confirmLabel="Discard"
          cancelLabel="Keep it"
          danger
          onConfirm={discardDraft}
          onCancel={() => setShowDiscardDraft(false)}
        />
      )}
    </div>
  );
}
