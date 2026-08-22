import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Numbered "how this works" lines, rendered 01 / 02 / 03. */
  steps?: string[];
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, steps, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {steps && steps.length > 0 && (
        <>
          <div className={styles.accentRule} />
          <ol className={styles.steps}>
            {steps.map((step, i) => (
              <li key={step} className={styles.step}>
                <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
