import styles from './ExerciseProgress.module.css';

interface ExerciseProgressProps {
  current: number;
  total: number;
}

/** The hairline strip at the top of a live workout: a rule, then "2 / 5". */
export default function ExerciseProgress({ current, total }: ExerciseProgressProps) {
  return (
    <div className={styles.container}>
      <span className={styles.line} />
      <span className={styles.count}>
        {current + 1} / {total}
      </span>
    </div>
  );
}
