import { useNavigate } from 'react-router-dom';
import { Copy, Trash } from '@phosphor-icons/react';
import type { Template } from '@training-pal/shared';
import styles from './TemplateCard.module.css';

interface TemplateCardProps {
  template: Template;
  inRotation?: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export default function TemplateCard({
  template,
  inRotation = true,
  onDelete,
  onDuplicate,
}: TemplateCardProps) {
  const navigate = useNavigate();
  const exerciseCount = template.exercises.length;
  const strengthCount = template.exercises.filter((e) => e.type === 'strength').length;
  const cardioCount = template.exercises.filter((e) => e.type === 'cardio').length;

  const summary = [
    strengthCount > 0 ? `${strengthCount} strength` : '',
    cardioCount > 0 ? `${cardioCount} cardio` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={styles.row} onClick={() => navigate(`/program/${template.id}`)}>
      <span className={styles.info}>
        <span className={`${styles.name} ${inRotation ? '' : styles.nameQuiet}`}>
          {template.name}
        </span>
        <span className={styles.meta}>
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
          {inRotation ? (summary ? ` · ${summary}` : '') : ' · not in rotation'}
        </span>
      </span>
      <button
        className={styles.actionBtn}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(template.id);
        }}
        aria-label="Duplicate template"
      >
        <Copy size={16} />
      </button>
      <button
        className={`${styles.actionBtn} ${styles.deleteBtn}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(template.id);
        }}
        aria-label="Delete template"
      >
        <Trash size={16} />
      </button>
    </div>
  );
}
