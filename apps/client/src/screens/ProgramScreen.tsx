import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { trpc } from '../lib/trpc';
import { useToast } from '../hooks/useToast';
import { cloneExercises, copyTemplateName } from '../utils/templates';
import CycleEditor from '../components/program/CycleEditor';
import TemplateCard from '../components/templates/TemplateCard';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import PageHeader from '../components/layout/PageHeader';
import styles from './ProgramScreen.module.css';

export default function ProgramScreen() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { showError } = useToast();
  const {
    data: templates,
    isPending: templatesLoading,
    isError: templatesErrored,
    refetch: refetchTemplates,
  } = trpc.templates.list.useQuery();
  const {
    data: cycle,
    isPending: cycleLoading,
    isError: cycleErrored,
    refetch: refetchCycle,
  } = trpc.cycle.get.useQuery();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      utils.cycle.get.invalidate();
    },
    onError: () => showError('Failed to delete template. Please try again.'),
  });
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => utils.templates.list.invalidate(),
    onError: () => showError('Failed to duplicate template. Please try again.'),
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteTemplate.mutateAsync({ id: deleteTarget });
    setDeleteTarget(null);
  }

  async function handleDuplicate(templateId: string) {
    const template = templates?.find((item) => item.id === templateId);
    if (!template) return;

    await createTemplate.mutateAsync({
      name: copyTemplateName(template.name),
      exercises: cloneExercises(template.exercises),
    });
  }

  if (templatesLoading || cycleLoading) return <LoadingSpinner />;
  if (templatesErrored || cycleErrored) {
    return (
      <ErrorMessage
        message="Couldn't load your program."
        onRetry={() => {
          refetchTemplates();
          refetchCycle();
        }}
      />
    );
  }

  const rotationLength = cycle?.sequence.length ?? 0;
  const inRotation = new Set(cycle?.sequence ?? []);

  return (
    <div className="page">
      <PageHeader
        eyebrow={rotationLength > 0 ? `${rotationLength}-day rotation` : 'No rotation yet'}
      />

      <h1 className="page-title">Program</h1>

      <CycleEditor templates={templates ?? []} cycle={cycle ?? null} />

      <div className={`rule ${styles.rule}`} />

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="section-label">Workouts</h2>
          <span className={styles.count}>{templates?.length ?? 0}</span>
        </div>

        {templates && templates.length > 0 ? (
          <div className={styles.list}>
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                inRotation={inRotation.has(t.id)}
                onDelete={setDeleteTarget}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No workouts yet"
            description="A workout is a set of exercises you repeat — Upper A, Legs, and so on."
          />
        )}
      </section>

      <div className="action-pad">
        <div className="action-pad-inner">
          <Button fullWidth lead onClick={() => navigate('/program/new')}>
            <Plus size={17} />
            New workout
          </Button>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete workout?"
          message="This will permanently delete this workout and remove it from your rotation. Past sessions are kept."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
