import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { addDays, compareDateStrings, todayString, formatDate, formatDuration } from '../utils/dates';
import { clearWorkoutDraft, getWorkoutDraftDate, loadWorkoutDraft } from '../utils/workoutDraft';
import { buildSessionExerciseSnapshot, isHandledSession } from '../utils/sessions';
import type { Session } from '../db/types';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import styles from './TodayScreen.module.css';

export default function TodayScreen() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
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
    onError: () => alert('Failed to log workout. Please try again.'),
  });
  const updateCycle = trpc.cycle.update.useMutation({
    onError: () => alert('Failed to update your program cycle. Please try again.'),
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
        <h1 className="page-title">Today</h1>
        <EmptyState
          title={hasTemplates ? 'No rotation yet' : 'No workouts yet'}
          description={
            hasTemplates
              ? 'Add your templates to a rotation and they will repeat in order.'
              : 'Build your first workout, then add it to your rotation.'
          }
          action={
            <div className={styles.emptyActions}>
              {hasTemplates ? (
                <>
                  <Button fullWidth onClick={() => navigate('/program')}>
                    Build Rotation
                  </Button>
                  <Button variant="secondary" fullWidth onClick={() => navigate('/program/new')}>
                    + New Workout
                  </Button>
                </>
              ) : (
                <Button fullWidth onClick={() => navigate('/program/new')}>
                  + Create Your First Workout
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  // Already trained today
  if (doneToday) {
    const nextTemplateId = cycle.sequence[cycle.currentIndex];
    const nextTemplate = templateMap.get(nextTemplateId);
    return (
      <div className="page">
        <h1 className="page-title">Today</h1>
        <div className={styles.doneCard}>
          <div className={styles.checkIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className={styles.doneTitle}>
            {todayOutcome?.status === 'skipped' ? 'Today is handled' : "You're done for today"}
          </h2>
          {todayOutcome && (
            <p className={styles.doneMeta}>
              {todayOutcome.status === 'completed'
                ? `Completed ${todayOutcome.templateName}${todayOutcome.durationSeconds ? ` in ${formatDuration(todayOutcome.durationSeconds)}` : ''}`
                : `Skipped ${todayOutcome.templateName}`}
            </p>
          )}
          <p className={styles.doneNext}>
            Next up: <strong>{nextTemplate?.name ?? 'Unknown'}</strong>
          </p>
        </div>
      </div>
    );
  }

  // Show today's workout
  return (
    <div className="page">
      <h1 className="page-title">Today</h1>

      <div className={styles.workoutCard}>
        <div className={styles.workoutHead}>
          <h2 className={styles.workoutName}>{currentTemplate?.name ?? 'Unknown'}</h2>
          {cycle.sequence.length > 1 && (
            <button
              className={styles.changeBtn}
              onClick={() => setShowSwitchPicker((open) => !open)}
            >
              {showSwitchPicker ? 'Close' : 'Change'}
            </button>
          )}
        </div>

        {showSwitchPicker && (
          <div className={styles.switchPicker}>
            <p className={styles.switchLabel}>Do this instead today</p>
            {cycle.sequence.map((templateId, i) => {
              const tmpl = templateMap.get(templateId);
              const isCurrent = i === cycle.currentIndex;
              return (
                <button
                  key={`switch-${templateId}-${i}`}
                  className={`${styles.switchOption} ${isCurrent ? styles.switchOptionCurrent : ''}`}
                  onClick={() => switchToDay(i)}
                >
                  <span className={styles.switchDay}>Day {i + 1}</span>
                  <span className={styles.switchName}>{tmpl?.name ?? 'Deleted Template'}</span>
                  {isCurrent && <span className={styles.switchBadge}>Today</span>}
                </button>
              );
            })}
            <p className={styles.switchHint}>
              The rotation carries on from whichever workout you pick.
            </p>
          </div>
        )}

        {resumableDraft && (
          <div className={styles.resumeBanner}>
            <span className={styles.resumeTitle}>Workout in progress</span>
            <span className={styles.resumeMeta}>Pick up where you left off.</span>
          </div>
        )}
        <p className={styles.workoutMeta}>
          {currentTemplate?.exercises.length ?? 0} exercise
          {(currentTemplate?.exercises.length ?? 0) !== 1 ? 's' : ''}
          {' · '}Day {cycle.currentIndex + 1} of {cycle.sequence.length}
        </p>

        {currentTemplate && (
          <div className={styles.exercisePreview}>
            {currentTemplate.exercises.map((ex, i) => (
              <div key={ex.id} className={styles.previewRow}>
                <span className={styles.previewNum}>{i + 1}</span>
                <span className={styles.previewName}>{ex.name}</span>
                <span className={styles.previewDetail}>
                  {ex.type === 'strength'
                    ? `${ex.sets.length} set${ex.sets.length !== 1 ? 's' : ''}`
                    : `${ex.durationMinutes}min`}
                </span>
              </div>
            ))}
          </div>
        )}

        {lastSession && (
          <div className={styles.lastSession}>
            <span className={styles.lastLabel}>Last session</span>
            <span className={styles.lastDate}>{formatDate(lastSession.date)}</span>
            {lastSession.durationSeconds && (
              <span className={styles.lastDuration}>
                {formatDuration(lastSession.durationSeconds)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {resumableDraft ? (
          <>
            <Button fullWidth onClick={() => navigate('/workout')}>
              Resume Workout
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setShowDiscardDraft(true)}>
              Discard In-Progress Workout
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth onClick={() => navigate('/workout')}>
              Start Workout
            </Button>
            {showSkipOptions ? (
              <div className={styles.skipOptions}>
                <Button variant="secondary" fullWidth onClick={() => handleSkip(true)}>
                  Skip And Advance
                </Button>
                <Button variant="secondary" fullWidth onClick={() => handleSkip(false)}>
                  Skip, Keep This Workout Next
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setShowSkipOptions(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => setShowSkipOptions(true)}>
                Skip Options
              </Button>
            )}
          </>
        )}
      </div>

      {showDiscardDraft && (
        <ConfirmDialog
          title="Discard Workout?"
          message="This will remove your in-progress workout so you can start fresh."
          confirmLabel="Discard"
          danger
          onConfirm={discardDraft}
          onCancel={() => setShowDiscardDraft(false)}
        />
      )}
    </div>
  );
}
