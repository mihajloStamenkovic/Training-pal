import styles from './RirSelector.module.css';

interface RirSelectorProps {
  value: number | null;
  onChange: (value: number) => void;
}

/** What the digit means, so the scale reads without a legend. */
const WORDS = ['failure', 'hard', 'solid'];

export default function RirSelector({ value, onChange }: RirSelectorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Reps in reserve</div>
      <div className={styles.buttons}>
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            className={`${styles.btn} ${value === n ? styles.selected : ''}`}
            onClick={() => onChange(n)}
            type="button"
            aria-pressed={value === n}
          >
            {n}
            <span className={styles.word}>{WORDS[n]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
