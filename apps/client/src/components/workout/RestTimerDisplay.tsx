import { FastForward } from '@phosphor-icons/react';
import styles from './RestTimerDisplay.module.css';

const RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RestTimerDisplayProps {
  remaining: number;
  /** What the countdown started at. Zero means "no ring to draw". */
  total: number;
  upNext: string;
  coachLine?: string | null;
  skipLabel: string;
  editLabel?: string;
  onSkip: () => void;
  onAddTime: () => void;
  onEdit?: () => void;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RestTimerDisplay({
  remaining,
  total,
  upNext,
  coachLine,
  skipLabel,
  editLabel,
  onSkip,
  onAddTime,
  onEdit,
}: RestTimerDisplayProps) {
  // Driven off `remaining` rather than a CSS keyframe so the ring stays correct
  // after the hook re-syncs on wake.
  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className={styles.container}>
      <div className={styles.centre}>
        <div className={styles.ringWrap}>
          <svg width="238" height="238" viewBox="0 0 238 238" className={styles.ring}>
            <circle
              cx="119"
              cy="119"
              r={RADIUS}
              fill="none"
              stroke="rgba(233,233,237,0.1)"
              strokeWidth="2"
            />
            <circle
              cx="119"
              cy="119"
              r={RADIUS}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashoffset}
              className={styles.ringProgress}
            />
          </svg>
          <div className={styles.ringLabel}>
            <div className={styles.time}>{formatClock(remaining)}</div>
            <div className={styles.resting}>resting</div>
          </div>
        </div>

        <div className={styles.nextBlock}>
          <div className="rule" />
          <div className={styles.nextInner}>
            <div className={styles.nextLabel}>up next</div>
            <div className={styles.nextValue}>{upNext}</div>
            {coachLine && <div className={styles.coach}>{coachLine}</div>}
          </div>
        </div>
      </div>

      <div className={styles.pad}>
        <div className={styles.padRow}>
          <button className={styles.secondaryBtn} onClick={onAddTime}>
            +30s
          </button>
          {onEdit && (
            <button className={styles.secondaryBtn} onClick={onEdit}>
              {editLabel ?? 'Edit last set'}
            </button>
          )}
        </div>
        <button className={styles.skipBtn} onClick={onSkip}>
          <FastForward size={17} />
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
