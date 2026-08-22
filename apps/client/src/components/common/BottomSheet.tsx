import type { ReactNode } from 'react';
import { useDismissOnEscape } from '../../hooks/useDismissOnEscape';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  title: string;
  /** Optional line under the options explaining what the choice does. */
  hint?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ title, hint, onClose, children }: BottomSheetProps) {
  useDismissOnEscape(onClose);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.title}>{title}</div>
          <button className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {hint && <div className={styles.hint}>{hint}</div>}
      </div>
    </div>
  );
}
