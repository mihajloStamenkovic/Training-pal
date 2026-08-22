import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext } from '../../hooks/useToast';
import styles from './ToastProvider.module.css';

/** How long a failure stays up before it retires itself. */
const VISIBLE_MS = 5000;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setMessage(null);
  }, []);

  const showError = useCallback((next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(next);
    timeoutRef.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  const api = useMemo(() => ({ showError }), [showError]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message && (
        <div className={styles.wrap} role="alert" aria-live="assertive">
          <div className={styles.toast}>
            <span className={styles.text}>{message}</span>
            <button className={styles.dismiss} onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
