import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { cloneExercises, copyTemplateName } from '../utils/templates';
import TemplateCard from '../components/templates/TemplateCard';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import styles from './TemplatesListScreen.module.css';

export default function TemplatesListScreen() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: templates, isPending, isError, refetch } = trpc.templates.list.useQuery();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      utils.cycle.get.invalidate();
    },
    onError: () => alert('Failed to delete template. Please try again.'),
  });
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => utils.templates.list.invalidate(),
    onError: () => alert('Failed to duplicate template. Please try again.'),
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

  if (isPending) return <LoadingSpinner />;
  if (isError) return <ErrorMessage message="Couldn't load templates." onRetry={() => refetch()} />;

  return (
    <div className="page">
      <div className={styles.header}>
        <h1 className="page-title">Templates</h1>
        <Button variant="secondary" onClick={() => navigate('/program')}>
          Cycle
        </Button>
      </div>

      {templates && templates.length > 0 ? (
        <div className={styles.list}>
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onDelete={setDeleteTarget}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No templates yet"
          description="Create your first workout template to get started."
        />
      )}

      <div className={styles.fab}>
        <Button fullWidth onClick={() => navigate('/templates/new')}>
          + New Template
        </Button>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Template"
          message="This will permanently delete this template. Any references in your program cycle will be removed."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
